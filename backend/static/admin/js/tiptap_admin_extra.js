/* backend/static/admin/js/tiptap_admin_extra.js */
/* Lightweight fallback contenteditable WYSIWYG for Django Admin */

(function () {
  function qs(sel, ctx){ return (ctx || document).querySelector(sel); }
  function qsa(sel, ctx){ return Array.from((ctx || document).querySelectorAll(sel)); }
  function getCookie(name) {
    const v = document.cookie.match('(^|;)\\s*' + name + '\\s*=\\s*([^;]+)');
    return v ? v.pop() : '';
  }

  function makeBtn(label, title){
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'tiptap-btn';
    b.innerHTML = label;
    if(title) b.title = title;
    return b;
  }

  function exec(cmd, value) {
    try {
      document.execCommand(cmd, false, value);
    } catch (e) {
      console.warn('execCommand failed', cmd, e);
    }
  }

  function insertHtmlAtCaret(html) {
    const sel = window.getSelection();
    if (!sel || sel.rangeCount === 0) return;
    const range = sel.getRangeAt(0);
    const div = document.createElement('div');
    div.innerHTML = html;
    const frag = document.createDocumentFragment();
    let node;
    while ((node = div.firstChild)) frag.appendChild(node);
    range.deleteContents();
    range.insertNode(frag);
    sel.removeAllRanges();
    const newRange = document.createRange();
    newRange.setStartAfter(frag.lastChild || frag);
    newRange.collapse(true);
    sel.addRange(newRange);
  }

  function syncEditorToTextarea(editable, textarea) {
    textarea.value = editable.innerHTML;
    textarea.dispatchEvent(new Event('change', { bubbles: true }));
  }

  async function uploadImage(file, uploadUrl, csrfToken) {
    const fd = new FormData();
    fd.append('file', file, file.name);
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
    if (Array.isArray(data.uploaded) && data.uploaded.length) return data.uploaded[0].url || '';
    if (data.url) return data.url;
    if (data.uploaded && data.uploaded[0] && data.uploaded[0].url) return data.uploaded[0].url;
    throw new Error('No URL returned from upload');
  }

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

  function initEditor(wrapper) {
    try {
      const textarea = wrapper.previousElementSibling && wrapper.previousElementSibling.tagName === 'TEXTAREA'
        ? wrapper.previousElementSibling
        : wrapper.parentNode.querySelector('textarea');
      if (!textarea) return;

      const uploadUrl = wrapper.dataset.uploadUrl || '/api/blog/media/upload/';
      const previewTokenUrl = wrapper.dataset.previewTokenUrl || '/admin/posts/preview-token/';
      const csrfToken = getCookie('csrftoken');

      const toolbar = wrapper.querySelector('.tiptap-toolbar') || document.createElement('div');
      toolbar.className = 'tiptap-toolbar';
      const ed = wrapper.querySelector('.tiptap-editor') || document.createElement('div');
      ed.className = 'tiptap-editor';
      ed.contentEditable = 'true';
      ed.spellcheck = true;
      ed.innerHTML = textarea.value || '';

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
      buttons.push({ label: '🔗', cmd: () => {
        const url = prompt('Enter URL:');
        if (url) exec('createLink', url);
      }, title: 'Insert link' });

      const imageInput = document.createElement('input');
      imageInput.type = 'file';
      imageInput.accept = 'image/*';
      imageInput.style.display = 'none';
      imageInput.addEventListener('change', async function () {
        const f = (this.files && this.files[0]);
        if (!f) return;
        insertHtmlAtCaret('<p>Uploading image...</p>');
        try {
          const url = await uploadImage(f, uploadUrl, csrfToken);
          insertHtmlAtCaret(`<img src="${url}" alt="${f.name}" />`);
        } catch (err) {
          alert('Image upload failed: ' + err.message);
        }
      });
      wrapper.appendChild(imageInput);
      buttons.push({ label: '🖼️', cmd: () => imageInput.click(), title: 'Insert image' });

      buttons.push({ label: '↶', cmd: () => exec('undo'), title: 'Undo' });
      buttons.push({ label: '↷', cmd: () => exec('redo'), title: 'Redo' });

      buttons.push({ label: 'Preview', cmd: async () => {
        const payload = { title: (document.querySelector('#id_title') && document.querySelector('#id_title').value) || '', content: ed.innerHTML, excerpt: (document.querySelector('#id_excerpt') && document.querySelector('#id_excerpt').value) || '', featured_image: (document.querySelector('#id_featured_image') && document.querySelector('#id_featured_image').value) || '' };
        const res = await fetchPreviewToken(payload, previewTokenUrl, csrfToken);
        if (res && res.token) {
          const w = window.open('/preview/' + res.token + '/', '_blank');
          if (!w) alert('Popup blocked – open /preview/' + res.token + '/ manually');
        } else {
          alert('Preview token failed');
        }
      }, title: 'Preview post' });

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
      const existingToolbar = wrapper.querySelector('.tiptap-toolbar');
      if (existingToolbar) existingToolbar.replaceWith(toolbar);
      else wrapper.insertBefore(toolbar, ed);

      if (!wrapper.contains(ed)) wrapper.appendChild(ed);

      ed.addEventListener('input', () => syncEditorToTextarea(ed, textarea));
      ed.addEventListener('blur', () => syncEditorToTextarea(ed, textarea));

      const form = textarea.closest('form');
      if (form) {
        form.addEventListener('submit', () => syncEditorToTextarea(ed, textarea));
      }

      let autosaveTimer = null;
      const AUTOSAVE_INTERVAL = 30000;
      function scheduleAutosave() {
        if (autosaveTimer) clearTimeout(autosaveTimer);
        autosaveTimer = setTimeout(async () => {
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

      syncEditorToTextarea(ed, textarea);

      console.info('[tiptap_admin_extra] Initialized fallback contenteditable editor for', textarea.id || textarea.name);
    } catch (err) {
      console.warn('[tiptap_admin_extra] init failed, editor not available', err);
    }
  }

  function bootstrapAll() {
    const wrappers = qsa('.admin-tiptap-widget');
    if (!wrappers.length) {
      const tareas = qsa('textarea.admin-tiptap-textarea');
      tareas.forEach(t => {
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

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', bootstrapAll);
  } else {
    bootstrapAll();
  }

})();
