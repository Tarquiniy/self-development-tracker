/**
 * tiptap_admin_extra.js
 * Lightweight, robust WYSIWYG fallback editor for Django Admin.
 *
 * Features:
 *  - contenteditable editor with toolbar (bold/italic/underline, headings, lists, link, image upload, code, quote)
 *  - sync to hidden textarea on submit
 *  - image upload using admin media_upload endpoint (multipart/form-data)
 *  - autosave via admin/autosave endpoint
 *  - preview token generation via admin/preview-token endpoint
 *  - resilient: works without any external CDN
 *
 * Requires:
 *  - template puts textarea with id attr and wrapper .admin-tiptap-widget (see widget template)
 */

(function () {
  // Utilities
  function qs(sel, ctx){ return (ctx || document).querySelector(sel); }
  function qsa(sel, ctx){ return Array.from((ctx || document).querySelectorAll(sel)); }
  function safeText(s){ return (s===null||s===undefined) ? '' : String(s); }
  function getCookie(name) {
    const v = document.cookie.match('(^|;)\\s*' + name + '\\s*=\\s*([^;]+)');
    return v ? v.pop() : '';
  }

  // Build toolbar button
  function makeBtn(label, title){
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'tiptap-btn';
    b.innerHTML = label;
    if(title) b.title = title;
    return b;
  }

  // Exec helper (fallback uses execCommand where possible)
  function exec(cmd, value) {
    try {
      document.execCommand(cmd, false, value);
    } catch (e) {
      console.warn('execCommand failed', cmd, e);
    }
  }

  // Insert HTML at caret
  function insertHtmlAtCaret(html) {
    const sel = window.getSelection();
    if (!sel || sel.rangeCount === 0) return;
    const range = sel.getRangeAt(0);
    // create node
    const div = document.createElement('div');
    div.innerHTML = html;
    const frag = document.createDocumentFragment();
    let node;
    while ((node = div.firstChild)) frag.appendChild(node);
    range.deleteContents();
    range.insertNode(frag);
    // place caret after inserted
    sel.removeAllRanges();
    const newRange = document.createRange();
    newRange.setStartAfter(frag.lastChild || frag);
    newRange.collapse(true);
    sel.addRange(newRange);
  }

  // Sync contenteditable -> textarea
  function syncEditorToTextarea(editable, textarea) {
    textarea.value = editable.innerHTML;
    // trigger change events for Django (if any)
    textarea.dispatchEvent(new Event('change', { bubbles: true }));
  }

  // Upload image via media_upload endpoint
  async function uploadImage(file, uploadUrl, csrfToken) {
    const fd = new FormData();
    fd.append('file', file, file.name);
    // If API expects additional fields, add them here.
    const resp = await fetch(uploadUrl, {
      method: 'POST',
      body: fd,
      credentials: 'same-origin',
      headers: {
        'X-CSRFToken': csrfToken,
      },
    });
    if (!resp.ok) {
      const text = await resp.text();
      throw new Error('Upload failed: ' + resp.status + ' ' + text);
    }
    const data = await resp.json();
    if (!data.success) {
      throw new Error('Upload response error: ' + JSON.stringify(data));
    }
    // data.uploaded: array or uploaded single item
    if (Array.isArray(data.uploaded) && data.uploaded.length) return data.uploaded[0].url || '';
    if (data.url) return data.url;
    // some endpoints return `uploaded[0].url` or `attachment.url`
    if (data.uploaded && data.uploaded[0] && data.uploaded[0].url) return data.uploaded[0].url;
    throw new Error('No URL returned from upload');
  }

  // Autosave (POST to admin/autosave)
  async function autosavePost(payload, url, csrfToken) {
    try {
      const resp = await fetch(url, {
        method: 'POST',
        credentials: 'same-origin',
        headers: {
          'Content-Type': 'application/json',
          'X-CSRFToken': csrfToken,
        },
        body: JSON.stringify(payload),
      });
      return await resp.json();
    } catch (e) {
      console.debug('autosave failed', e);
      return { success: false, error: String(e) };
    }
  }

  // Preview token (POST)
  async function fetchPreviewToken(payload, url, csrfToken) {
    try {
      const resp = await fetch(url, {
        method: 'POST',
        credentials: 'same-origin',
        headers: {
          'Content-Type': 'application/json',
          'X-CSRFToken': csrfToken,
        },
        body: JSON.stringify(payload),
      });
      return await resp.json();
    } catch (e) {
      console.debug('preview token failed', e);
      return null;
    }
  }

  // Initialize editor for a single wrapper
  function initEditor(wrapper) {
    try {
      const textareaId = wrapper.previousElementSibling && wrapper.previousElementSibling.tagName === 'TEXTAREA'
        ? wrapper.previousElementSibling.id
        : null;
      if (!textareaId) {
        console.warn('[tiptap_admin_extra] missing textarea sibling; aborting');
        return;
      }
      const textarea = document.getElementById(textareaId);
      if (!textarea) {
        console.warn('[tiptap_admin_extra] textarea not found by id', textareaId);
        return;
      }

      // read data attributes
      const uploadUrl = wrapper.dataset.uploadUrl || '/api/blog/media/upload/';
      const previewTokenUrl = wrapper.dataset.previewTokenUrl || '/api/blog/preview-token/';
      const csrfToken = getCookie('csrftoken');

      // create editor area
      const toolbar = wrapper.querySelector('.tiptap-toolbar') || document.createElement('div');
      toolbar.className = 'tiptap-toolbar';
      const ed = wrapper.querySelector('.tiptap-editor') || document.createElement('div');
      ed.className = 'tiptap-editor';
      ed.contentEditable = 'true';
      ed.spellcheck = true;
      // initial content from textarea
      ed.innerHTML = textarea.value || '';

      // Basic toolbar buttons
      const buttons = [];

      buttons.push({ label: '<b>B</b>', cmd: () => exec('bold'), title: 'Bold' });
      buttons.push({ label: '<i>I</i>', cmd: () => exec('italic'), title: 'Italic' });
      buttons.push({ label: '<u>U</u>', cmd: () => exec('underline'), title: 'Underline' });
      buttons.push({ label: 'H1', cmd: () => insertHtmlAtCaret('<h1>' + (window.getSelection().toString() || 'Heading') + '</h1>'), title: 'Heading 1' });
      buttons.push({ label: 'H2', cmd: () => insertHtmlAtCaret('<h2>' + (window.getSelection().toString() || 'Heading') + '</h2>'), title: 'Heading 2' });
      buttons.push({ label: '• List', cmd: () => exec('insertUnorderedList'), title: 'Bulleted list' });
      buttons.push({ label: '1. List', cmd: () => exec('insertOrderedList'), title: 'Numbered list' });
      buttons.push({ label: '</> Code', cmd: () => insertHtmlAtCaret('<pre><code>' + (window.getSelection().toString() || '') + '</code></pre>'), title: 'Code block' });
      buttons.push({ label: '❝ Quote', cmd: () => insertHtmlAtCaret('<blockquote>' + (window.getSelection().toString() || '') + '</blockquote>'), title: 'Blockquote' });
      // link button (prompt)
      buttons.push({ label: '🔗', cmd: () => {
        const url = prompt('Enter URL:');
        if (url) exec('createLink', url);
      }, title: 'Insert link' });
      // image upload input
      const imageInput = document.createElement('input');
      imageInput.type = 'file';
      imageInput.accept = 'image/*';
      imageInput.style.display = 'none';
      imageInput.addEventListener('change', async function () {
        const f = (this.files && this.files[0]);
        if (!f) return;
        const placeholder = '<p>Uploading image...</p>';
        insertHtmlAtCaret(placeholder);
        try {
          const url = await uploadImage(f, uploadUrl, csrfToken);
          insertHtmlAtCaret(`<img src="${url}" alt="${f.name}" />`);
        } catch (err) {
          alert('Image upload failed: ' + err.message);
        }
      });
      wrapper.appendChild(imageInput);
      buttons.push({ label: '🖼️', cmd: () => imageInput.click(), title: 'Insert image' });

      // undo/redo
      buttons.push({ label: '↶', cmd: () => exec('undo'), title: 'Undo' });
      buttons.push({ label: '↷', cmd: () => exec('redo'), title: 'Redo' });

      // preview token
      buttons.push({ label: 'Preview', cmd: async () => {
        const payload = { title: document.querySelector('#id_title') ? document.querySelector('#id_title').value : '', content: ed.innerHTML, excerpt: document.querySelector('#id_excerpt') ? document.querySelector('#id_excerpt').value : '', featured_image: document.querySelector('#id_featured_image') ? document.querySelector('#id_featured_image').value : '' };
        const res = await fetchPreviewToken(payload, previewTokenUrl, csrfToken);
        if (res && res.token) {
          const w = window.open('/preview/' + res.token + '/', '_blank');
          if (!w) alert('Popup blocked – open /preview/' + res.token + '/ manually');
        } else {
          alert('Preview token failed');
        }
      }, title: 'Preview post' });

      // attach buttons to toolbar
      toolbar.innerHTML = '';
      buttons.forEach(bdata => {
        const b = makeBtn(bdata.label, bdata.title);
        b.addEventListener('click', (ev) => {
          ev.preventDefault();
          try { bdata.cmd(); } catch(e){ console.error(e); }
          ed.focus();
        });
        toolbar.appendChild(b);
      });
      // clear existing and append
      const existingToolbar = wrapper.querySelector('.tiptap-toolbar');
      if (existingToolbar) existingToolbar.replaceWith(toolbar);
      else wrapper.insertBefore(toolbar, ed);

      // append editor if needed
      if (!wrapper.contains(ed)) wrapper.appendChild(ed);

      // Sync on input/blur
      ed.addEventListener('input', () => syncEditorToTextarea(ed, textarea));
      ed.addEventListener('blur', () => syncEditorToTextarea(ed, textarea));

      // Ensure sync before form submission
      const form = textarea.closest('form');
      if (form) {
        form.addEventListener('submit', () => syncEditorToTextarea(ed, textarea));
      }

      // Autosave every X seconds if configured
      let autosaveTimer = null;
      const AUTOSAVE_INTERVAL = 30000; // 30s
      function scheduleAutosave() {
        if (autosaveTimer) clearTimeout(autosaveTimer);
        autosaveTimer = setTimeout(async () => {
          // build minimal payload
          const payload = {
            id: textarea.dataset.postId || null,
            title: (document.querySelector('#id_title') && document.querySelector('#id_title').value) || '',
            excerpt: (document.querySelector('#id_excerpt') && document.querySelector('#id_excerpt').value) || '',
            content: ed.innerHTML,
            content_json: null,
            published_at: (document.querySelector('#id_published_at') && document.querySelector('#id_published_at').value) || null,
            featured_image: (document.querySelector('#id_featured_image') && document.querySelector('#id_featured_image').value) || '',
          };
          try {
            const resp = await autosavePost(payload, '/admin/posts/autosave/', csrfToken);
            if (resp && resp.success && resp.id) {
              textarea.dataset.postId = resp.id;
            }
          } catch (e) {
            console.debug('autosave error', e);
          } finally {
            scheduleAutosave();
          }
        }, AUTOSAVE_INTERVAL);
      }
      scheduleAutosave();

      // initial sync
      syncEditorToTextarea(ed, textarea);

      console.info('[tiptap_admin_extra] Initialized fallback contenteditable editor for', textareaId);
    } catch (err) {
      console.warn('[tiptap_admin_extra] init failed, editor not available', err);
    }
  }

  // Boot: for every wrapper on page
  function bootstrapAll() {
    const wrappers = qsa('.admin-tiptap-widget');
    if (!wrappers.length) {
      // legacy: find by class on textarea
      const tareas = qsa('textarea.admin-tiptap-textarea');
      tareas.forEach(t => {
        // create wrapper after textarea
        const wrap = document.createElement('div');
        wrap.className = 'admin-tiptap-widget';
        wrap.innerHTML = '<div class="tiptap-toolbar"></div><div class="tiptap-editor"></div>';
        t.parentNode.insertBefore(wrap, t.nextSibling);
        initEditor(wrap);
      });
      return;
    }
    wrappers.forEach(w => initEditor(w));
  }

  // Run on DOMContentLoaded
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', bootstrapAll);
  } else {
    bootstrapAll();
  }

})();
