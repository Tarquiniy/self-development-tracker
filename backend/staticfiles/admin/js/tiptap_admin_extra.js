// backend/static/admin/js/tiptap_admin_extra.js
(function () {
  if (window._admin_tiptap_extra_inited) return;
  window._admin_tiptap_extra_inited = true;

  // Utility
  function qs(sel, ctx) { return (ctx || document).querySelector(sel); }
  function qsa(sel, ctx) { return Array.from((ctx || document).querySelectorAll(sel)); }
  function getCookie(name) {
    const v = document.cookie.match('(^|;)\\s*' + name + '\\s*=\\s*([^;]+)');
    return v ? v.pop() : '';
  }

  // Default path for local UMD bundle
  const LOCAL_UMD_PATH = (window.ADMIN_TIPTAP_UMD_PATH || '/static/admin/vendor/tiptap/tiptap-umd.js');

  // Loader for local UMD script (returns Promise)
  function loadLocalUMD(src, timeout = 8000) {
    return new Promise((resolve, reject) => {
      // If already loaded (script present and window objects present) resolve quickly
      if (window.tiptap || window.tiptapCore || window['@tiptap/core'] || window.TipTap) {
        return resolve(true);
      }
      const s = document.createElement('script');
      s.src = src;
      s.async = true;
      s.crossOrigin = 'anonymous';
      let done = false;
      function cleanup() {
        s.removeEventListener('load', onload);
        s.removeEventListener('error', onerror);
      }
      function onload() {
        cleanup();
        done = true;
        // small delay to allow UMD init to set globals
        setTimeout(() => {
          if (window.tiptap || window.tiptapCore || window['@tiptap/core'] || window.TipTap) {
            resolve(true);
          } else {
            // UMD loaded but didn't expose expected globals
            reject(new Error('UMD loaded but TipTap globals not found'));
          }
        }, 20);
      }
      function onerror(e) {
        cleanup();
        if (!done) reject(new Error('Failed to load local UMD: ' + src));
      }
      s.addEventListener('load', onload);
      s.addEventListener('error', onerror);
      document.head.appendChild(s);
      // timeout
      setTimeout(() => {
        if (!done) {
          cleanup();
          reject(new Error('Timeout loading UMD: ' + src));
        }
      }, timeout);
    });
  }

  // Fallback editor (robust contentEditable) (improved version drawn from widget fallback)
  function initFallback(textarea, widget) {
    try {
      let toolbar = widget.querySelector('.tiptap-toolbar');
      let ed = widget.querySelector('.tiptap-editor');
      if (!ed) {
        ed = document.createElement('div');
        ed.className = 'tiptap-editor';
        ed.contentEditable = 'true';
        ed.spellcheck = true;
        widget.appendChild(ed);
      }
      // set initial content
      ed.innerHTML = textarea.value || '';

      // Build minimal toolbar if not present
      if (!toolbar || toolbar.children.length === 0) {
        toolbar = toolbar || document.createElement('div');
        toolbar.className = 'tiptap-toolbar';
        const btns = [
          {label:'B', title:'Bold', cmd: () => document.execCommand('bold')},
          {label:'I', title:'Italic', cmd: () => document.execCommand('italic')},
          {label:'U', title:'Underline', cmd: () => document.execCommand('underline')},
          {label:'H1', title:'H1', cmd: () => insertHtml('<h1>' + (window.getSelection().toString() || 'Heading') + '</h1>')},
          {label:'•', title:'Bulleted', cmd: () => document.execCommand('insertUnorderedList')},
          {label:'1.', title:'Numbered', cmd: () => document.execCommand('insertOrderedList')},
          {label:'🔗', title:'Link', cmd: () => {
            const u = prompt('Enter URL:' );
            if (u) document.execCommand('createLink', false, u);
          }},
          {label:'🖼', title:'Image', cmd: () => imageInput.click()},
          {label:'Undo', title:'Undo', cmd: () => document.execCommand('undo')},
          {label:'Redo', title:'Redo', cmd: () => document.execCommand('redo')}
        ];
        btns.forEach(b => {
          const btn = document.createElement('button');
          btn.type = 'button';
          btn.className = 'tiptap-btn';
          btn.innerHTML = b.label;
          btn.title = b.title;
          btn.addEventListener('click', (e) => { e.preventDefault(); try { b.cmd(); } catch (er) { console.warn(er); } ed.focus(); });
          toolbar.appendChild(btn);
        });
        widget.insertBefore(toolbar, ed);
      }

      // hidden file input for images
      let imageInput = widget._imageInput;
      if (!imageInput) {
        imageInput = document.createElement('input');
        imageInput.type = 'file';
        imageInput.accept = 'image/*';
        imageInput.style.display = 'none';
        imageInput.addEventListener('change', async function () {
          const f = this.files && this.files[0];
          if (!f) return;
          const placeholder = document.createElement('p');
          placeholder.textContent = 'Uploading image...';
          ed.appendChild(placeholder);
          try {
            const uploadUrl = widget.dataset.uploadUrl || '/api/blog/media/upload/';
            const csrf = getCookie('csrftoken');
            const fd = new FormData();
            fd.append('file', f, f.name);
            const resp = await fetch(uploadUrl, {
              method: 'POST',
              body: fd,
              credentials: 'same-origin',
              headers: { 'X-CSRFToken': csrf }
            });
            if (!resp.ok) throw new Error('Upload failed ' + resp.status);
            const json = await resp.json();
            const url = json.url || (json.attachment && json.attachment.url) || (Array.isArray(json.uploaded) && json.uploaded[0] && json.uploaded[0].url);
            if (!url) throw new Error('No URL returned from upload');
            placeholder.outerHTML = '<img src="' + url + '" alt="' + (f.name || 'image') + '" />';
            sync();
          } catch (err) {
            placeholder.remove();
            alert('Image upload failed: ' + err.message);
          }
        });
        widget.appendChild(imageInput);
        widget._imageInput = imageInput;
      }

      function insertHtml(html) {
        const sel = window.getSelection();
        if (!sel || sel.rangeCount === 0) return;
        const range = sel.getRangeAt(0);
        range.deleteContents();
        const div = document.createElement('div');
        div.innerHTML = html;
        const frag = document.createDocumentFragment();
        while (div.firstChild) frag.appendChild(div.firstChild);
        range.insertNode(frag);
      }

      function sync() {
        textarea.value = ed.innerHTML;
        textarea.dispatchEvent(new Event('change', { bubbles: true }));
      }

      ed.addEventListener('input', sync);
      ed.addEventListener('blur', sync);

      const form = textarea.closest('form');
      if (form) form.addEventListener('submit', sync);

      // autosave if admin endpoint exists (best-effort)
      (function autosave() {
        const INTERVAL = 30000;
        let timer = null;
        function schedule() {
          if (timer) clearTimeout(timer);
          timer = setTimeout(async () => {
            try {
              const payload = {
                id: textarea.dataset.postId || null,
                title: (document.querySelector('#id_title') && document.querySelector('#id_title').value) || '',
                excerpt: (document.querySelector('#id_excerpt') && document.querySelector('#id_excerpt').value) || '',
                content: ed.innerHTML
              };
              await fetch('/admin/posts/autosave/', {
                method: 'POST',
                credentials: 'same-origin',
                headers: { 'Content-Type': 'application/json', 'X-CSRFToken': getCookie('csrftoken') },
                body: JSON.stringify(payload)
              });
            } catch (e) { /* ignore */ }
            schedule();
          }, INTERVAL);
        }
        schedule();
      })();

      // initial sync
      sync();

      // mark widget as inited
      widget.dataset._inited_for = textarea.id;

      return true;
    } catch (e) {
      console.warn('fallback init failed', e);
      return false;
    }
  }

  // Proper TipTap init using globals (if present)
  function initTipTapWithGlobals(textarea, widget) {
    try {
      // detect editor constructor across exposed names
      const CoreEditor = (window.tiptap && window.tiptap.Editor) ||
                         (window.tiptapCore && window.tiptapCore.Editor) ||
                         (window['@tiptap/core'] && window['@tiptap/core'].Editor) ||
                         (window.TipTap && window.TipTap.Editor) ||
                         null;
      const StarterKit = (window.tiptap && window.tiptap.StarterKit) || (window.tiptapStarterKit && window.tiptapStarterKit.StarterKit) || (typeof window.StarterKit !== 'undefined' ? window.StarterKit : null);
      const Image = (window.tiptap && window.tiptap.Image) || (window.tiptapImage && window.tiptapImage.Image) || null;
      const Link = (window.tiptap && window.tiptap.Link) || null;

      if (!CoreEditor) return false;

      const el = widget.querySelector('.tiptap-editor') || (function(){ const d = document.createElement('div'); d.className='tiptap-editor'; widget.appendChild(d); return d; })();

      // Build extensions list conservatively
      const extensions = [];
      try { if (StarterKit) extensions.push(StarterKit); } catch(e){}
      try { if (Image) extensions.push(Image); } catch(e){}
      try { if (Link) extensions.push(Link); } catch(e){}

      // instantiate editor
      const editor = new CoreEditor({
        element: el,
        content: textarea.value || '',
        extensions: extensions.length ? extensions : undefined,
        onUpdate: ({ editor: e }) => {
          // try common API names
          let html = '';
          try { html = typeof e.getHTML === 'function' ? e.getHTML() : (e.getHTML ? e.getHTML() : ''); } catch(e){}
          // fallback: look at element
          if (!html) html = el.innerHTML;
          textarea.value = html || '';
          textarea.dispatchEvent(new Event('change', { bubbles: true }));
        }
      });

      // store reference for potential debugging
      widget._tiptap_editor = editor;
      widget.dataset._inited_for = textarea.id;
      return true;
    } catch (e) {
      console.warn('TipTap init error', e);
      return false;
    }
  }

  // Bootstrap one textarea -> widget pair
  async function bootstrapOne(textarea) {
    try {
      // find widget: next sibling or in parent
      let widget = textarea.nextElementSibling && textarea.nextElementSibling.classList && textarea.nextElementSibling.classList.contains('admin-tiptap-widget')
        ? textarea.nextElementSibling
        : (textarea.parentNode && textarea.parentNode.querySelector ? textarea.parentNode.querySelector('.admin-tiptap-widget') : null);

      if (!widget) return;

      if (widget.dataset && widget.dataset._inited_for === textarea.id) return; // already inited

      // priority: if tiptap globals available, init immediately
      if (window.tiptap || window.tiptapCore || window['@tiptap/core'] || window.TipTap) {
        const ok = initTipTapWithGlobals(textarea, widget);
        if (ok) return;
      }

      // else try to load local UMD and init
      try {
        await loadLocalUMD(LOCAL_UMD_PATH, 9000);
        if (window.tiptap || window.tiptapCore || window['@tiptap/core'] || window.TipTap) {
          const ok2 = initTipTapWithGlobals(textarea, widget);
          if (ok2) return;
        }
      } catch (e) {
        console.warn('Local UMD load failed or TipTap not exposed', e);
      }

      // final fallback
      initFallback(textarea, widget);

    } catch (e) {
      console.warn('bootstrapOne failed', e);
    }
  }

  function bootstrapAll() {
    qsa('textarea.admin-tiptap-textarea').forEach(bootstrapOne);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', bootstrapAll);
  } else {
    bootstrapAll();
  }

})();
