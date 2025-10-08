/* backend/static/admin/js/tiptap_admin_extra.js
   Robust TipTap loader + powerful contentEditable fallback.
   - Tries to load TipTap UMD (core + starter-kit) from CDN (jsDelivr/unpkg).
   - If TipTap available, initializes it.
   - If not, uses a full-featured contentEditable fallback (bold/italic/headings/lists/codeblock/image/undo/redo/preview/autosave).
   - Uses same upload endpoint logic as before (wrapper.dataset.uploadUrl or fallback /api/blog/media/upload/).
*/

(function () {
  "use strict";

  // ---------- helpers ----------
  function qs(sel, ctx) { return (ctx || document).querySelector(sel); }
  function qsa(sel, ctx) { return Array.from((ctx || document).querySelectorAll(sel)); }
  function getCookie(name) {
    const m = document.cookie.match('(^|;)\\s*' + name + '\\s*=\\s*([^;]+)');
    return m ? m.pop() : '';
  }

  function loadScript(url, opts) {
    opts = opts || {};
    return new Promise(function (resolve, reject) {
      try {
        const s = document.createElement('script');
        s.src = url;
        if (opts.crossorigin) s.crossOrigin = opts.crossorigin;
        s.async = !!opts.async;
        s.onload = function () { resolve({ url: url }); };
        s.onerror = function (e) { reject(new Error("Failed to load " + url)); };
        document.head.appendChild(s);
      } catch (e) {
        reject(e);
      }
    });
  }

  async function tryLoadTipTap() {
    // These two have worked in your logs earlier — keep versions that are known to be accessible.
    // If you want a different version, update these URLs to the exact UMD bundle versions you host or trust.
    const urls = [
      // tiptap core UMD
      "https://cdn.jsdelivr.net/npm/@tiptap/core@2.0.0-beta.153/dist/tiptap-core.umd.min.js",
      // starter-kit UMD
      "https://cdn.jsdelivr.net/npm/@tiptap/starter-kit@2.0.0-beta.143/dist/tiptap-starter-kit.umd.min.js"
    ];
    for (const u of urls) {
      try {
        await loadScript(u, { crossorigin: "anonymous", async: false });
      } catch (e) {
        console.warn("[tiptap_admin_extra] could not load", u, e);
        return false;
      }
    }
    // Check expected globals — TipTap UMD usually exposes window["@tiptap/core"] or window.tiptapCore/Editor depending on build.
    // We try a few fallbacks:
    const Core = window.TiptapCore || window['@tiptap/core'] || window.tiptapCore || window.tiptap || null;
    const StarterKit = window.TiptapStarterKit || window['@tiptap/starter-kit'] || window.tiptapStarterKit || null;
    if (!Core || !StarterKit) {
      // not present
      console.warn("[tiptap_admin_extra] TipTap globals not found after loading UMDs", !!Core, !!StarterKit);
      return false;
    }
    // Some UMDs expose Editor under Core.Editor or window.tiptap.Editor, try to pick the Editor constructor:
    let Editor = null;
    if (Core && Core.Editor) Editor = Core.Editor;
    if (!Editor && Core && Core.default && Core.default.Editor) Editor = Core.default.Editor;
    if (!Editor && window.tiptap && window.tiptap.Editor) Editor = window.tiptap.Editor;
    if (!Editor) Editor = window.Editor || null;

    if (!Editor) {
      console.warn("[tiptap_admin_extra] Editor constructor not found in TipTap globals");
      return false;
    }

    // store references for later use
    window.__tiptap_loaded = {
      Core: Core,
      StarterKit: StarterKit,
      Editor: Editor
    };
    return true;
  }

  // ---------- basic utils ----------
  function makeBtn(label, title) {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'tiptap-btn';
    b.innerHTML = label;
    if (title) b.title = title;
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

  async function uploadImage(file, uploadUrl, csrfToken) {
    const fd = new FormData();
    fd.append('file', file, file.name);
    const resp = await fetch(uploadUrl, {
      method: 'POST',
      body: fd,
      credentials: 'same-origin',
      headers: { 'X-CSRFToken': csrfToken },
    });
    if (!resp.ok) {
      const txt = await resp.text();
      throw new Error('Upload failed: ' + resp.status + ' ' + txt);
    }
    const data = await resp.json();
    if (!data) throw new Error('Empty upload response');
    if (data.url) return data.url;
    if (Array.isArray(data.uploaded) && data.uploaded.length) return data.uploaded[0].url || '';
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

  // ---------- fallback contentEditable editor (enhanced) ----------
  function initFallbackEditor(wrapper) {
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
      // sanitize naive: if textarea contains raw HTML, show it; safer sanitization can be added later.
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
        const payload = {
          title: (document.querySelector('#id_title') && document.querySelector('#id_title').value) || '',
          content: ed.innerHTML,
          excerpt: (document.querySelector('#id_excerpt') && document.querySelector('#id_excerpt').value) || '',
          featured_image: (document.querySelector('#id_featured_image') && document.querySelector('#id_featured_image').value) || ''
        };
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
          try { bdata.cmd(); } catch (e) { console.error(e); }
          ed.focus();
        });
        toolbar.appendChild(b);
      });
      const existingToolbar = wrapper.querySelector('.tiptap-toolbar');
      if (existingToolbar) existingToolbar.replaceWith(toolbar);
      else wrapper.insertBefore(toolbar, ed);

      if (!wrapper.contains(ed)) wrapper.appendChild(ed);

      function syncEditorToTextarea() {
        textarea.value = ed.innerHTML;
        textarea.dispatchEvent(new Event('change', { bubbles: true }));
      }

      ed.addEventListener('input', syncEditorToTextarea);
      ed.addEventListener('blur', syncEditorToTextarea);

      const form = textarea.closest('form');
      if (form) form.addEventListener('submit', syncEditorToTextarea);

      // autosave
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
            const resp = await autosavePost(payload, '/admin/posts/autosave/', getCookie('csrftoken'));
            if (resp && resp.success && resp.id) textarea.dataset.postId = resp.id;
          } catch (e) {
            console.debug('autosave error', e);
          } finally {
            scheduleAutosave();
          }
        }, AUTOSAVE_INTERVAL);
      }
      scheduleAutosave();

      syncEditorToTextarea();

      console.info('[tiptap_admin_extra] Initialized fallback contentEditable editor for', textarea.id || textarea.name);
    } catch (err) {
      console.warn('[tiptap_admin_extra] fallback init failure', err);
    }
  }

  // ---------- TipTap init (best-effort) ----------
  function initTipTapEditor(wrapper) {
    try {
      const cfg = window.__tiptap_loaded;
      if (!cfg || !cfg.Editor || !cfg.StarterKit) {
        console.warn('[tiptap_admin_extra] TipTap not fully loaded; skipping TipTap initialization');
        return false;
      }
      // Get textarea
      const textarea = wrapper.previousElementSibling && wrapper.previousElementSibling.tagName === 'TEXTAREA'
        ? wrapper.previousElementSibling
        : wrapper.parentNode.querySelector('textarea');
      if (!textarea) return false;

      // Build the editor — this part depends on the UMD's exact API surface.
      // We try the most common Beta 2.x surface (Editor constructor, extensions: [StarterKit.default ? StarterKit.default() : StarterKit()]).
      const Editor = cfg.Editor;
      const StarterKit = cfg.StarterKit;
      let starterInstance = null;
      try {
        starterInstance = typeof StarterKit === 'function' ? StarterKit() : (StarterKit && StarterKit.default ? StarterKit.default() : StarterKit).call ? (StarterKit.default ? StarterKit.default() : StarterKit)() : null;
      } catch (e) {
        // last resort: try calling StarterKit.default()
        try { starterInstance = StarterKit.default(); } catch (e2) { starterInstance = null; }
      }

      // create editor
      const editor = new Editor({
        element: wrapper.querySelector('.tiptap-editor') || wrapper.appendChild(document.createElement('div')),
        extensions: starterInstance ? [starterInstance] : [],
        content: textarea.value || '',
        onUpdate: ({ editor: ed }) => {
          textarea.value = ed.getHTML ? ed.getHTML() : ed.getHTML && typeof ed.getHTML === 'function' ? ed.getHTML() : ed.getJSON ? JSON.stringify(ed.getJSON()) : textarea.value;
          textarea.dispatchEvent(new Event('change', { bubbles: true }));
        }
      });

      // toolbar — we reuse similar toolbar UI (but call editor.chain()... if available)
      const toolbar = wrapper.querySelector('.tiptap-toolbar') || document.createElement('div');
      toolbar.className = 'tiptap-toolbar';
      const addBtn = (label, fn, title) => {
        const b = makeBtn(label, title);
        b.addEventListener('click', (ev) => { ev.preventDefault(); try { fn(); } catch (e) { console.warn(e); } });
        toolbar.appendChild(b);
      };

      // small set of actions
      addBtn('<b>B</b>', () => { try { editor.chain().focus().toggleBold().run(); } catch (e) { exec('bold'); } }, 'Bold');
      addBtn('<i>I</i>', () => { try { editor.chain().focus().toggleItalic().run(); } catch (e) { exec('italic'); } }, 'Italic');
      addBtn('H1', () => { try { editor.chain().focus().toggleHeading({ level: 1 }).run(); } catch (e) { insertHtmlAtCaret('<h1>'+ (window.getSelection().toString()||'Heading')+'</h1>'); } }, 'H1');
      addBtn('H2', () => { try { editor.chain().focus().toggleHeading({ level: 2 }).run(); } catch (e) { insertHtmlAtCaret('<h2>'+ (window.getSelection().toString()||'Heading')+'</h2>'); } }, 'H2');
      addBtn('• List', () => { try { editor.chain().focus().toggleBulletList().run(); } catch (e) { exec('insertUnorderedList'); } }, 'Bulleted');
      addBtn('1. List', () => { try { editor.chain().focus().toggleOrderedList().run(); } catch (e) { exec('insertOrderedList'); } }, 'Numbered');
      addBtn('Preview', async () => {
        const payload = { title: (document.querySelector('#id_title') && document.querySelector('#id_title').value) || '', content: editor.getHTML ? editor.getHTML() : textarea.value, excerpt: (document.querySelector('#id_excerpt') && document.querySelector('#id_excerpt').value) || '' };
        const res = await fetchPreviewToken(payload, '/admin/posts/preview-token/', getCookie('csrftoken'));
        if (res && res.token) {
          const w = window.open('/preview/' + res.token + '/', '_blank');
          if (!w) alert('Popup blocked – open /preview/' + res.token + '/ manually');
        } else alert('Preview failed');
      }, 'Preview post');

      const existingToolbar = wrapper.querySelector('.tiptap-toolbar');
      if (existingToolbar) existingToolbar.replaceWith(toolbar); else wrapper.insertBefore(toolbar, wrapper.querySelector('.tiptap-editor'));

      // sync on submit
      const form = textarea.closest('form');
      if (form) form.addEventListener('submit', () => { if (editor.getHTML) { textarea.value = editor.getHTML(); } });

      console.info('[tiptap_admin_extra] TipTap editor initialized for', textarea.id || textarea.name);
      return true;
    } catch (err) {
      console.warn('[tiptap_admin_extra] TipTap init error', err);
      return false;
    }
  }

  // ---------- bootstrap ----------
  async function bootstrapAll() {
    // Query every textarea that should become an editor (class admin-tiptap-textarea)
    const tareas = qsa('textarea.admin-tiptap-textarea');
    if (!tareas.length) return;

    // Try to load TipTap libraries first (best-effort); if fails — skip to fallback
    let tiptapAvailable = false;
    try {
      tiptapAvailable = await tryLoadTipTap();
    } catch (e) {
      tiptapAvailable = false;
    }

    tareas.forEach(t => {
      // create wrapper
      let wrap = t.parentNode.querySelector('.admin-tiptap-widget');
      if (!wrap) {
        wrap = document.createElement('div');
        wrap.className = 'admin-tiptap-widget';
        // allow config via data- attributes on the textarea (upload url, preview token url)
        wrap.dataset.uploadUrl = t.getAttribute('data-upload-url') || t.dataset.uploadUrl || '/api/blog/media/upload/';
        wrap.dataset.previewTokenUrl = t.getAttribute('data-preview-token-url') || t.dataset.previewTokenUrl || '/admin/posts/preview-token/';
        // ensure editor placeholder
        wrap.innerHTML = '<div class="tiptap-toolbar"></div><div class="tiptap-editor"></div>';
        t.parentNode.insertBefore(wrap, t.nextSibling);
      }

      // Prefer TipTap if available, else fallback
      if (tiptapAvailable) {
        const ok = initTipTapEditor(wrap);
        if (!ok) initFallbackEditor(wrap);
      } else {
        initFallbackEditor(wrap);
      }
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', bootstrapAll);
  } else {
    bootstrapAll();
  }

})();
