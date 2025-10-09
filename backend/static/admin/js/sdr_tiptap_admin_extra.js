cat > static/admin/js/sdr_tiptap_admin_extra.js <<'JS'
(function () {
  if (window._sdr_tiptap_loader) return;
  window._sdr_tiptap_loader = true;

  function qsa(sel, ctx) { return Array.from((ctx || document).querySelectorAll(sel)); }
  function getCookie(name) {
    const v = document.cookie.match('(^|;)\\s*' + name + '\\s*=\\s*([^;]+)');
    return v ? v.pop() : '';
  }
  const LOCAL_UMD = window.ADMIN_TIPTAP_UMD_PATH || '/static/admin/vendor/tiptap/tiptap-umd.js';

  function loadScript(src, timeout = 8000) {
    return new Promise((resolve, reject) => {
      if (window.tiptap && window.tiptap.Editor) return resolve(true);
      const s = document.createElement('script');
      s.src = src;
      s.async = true;
      s.crossOrigin = 'anonymous';
      let done = false;
      s.onload = () => { done = true; setTimeout(() => resolve(true), 20); };
      s.onerror = (e) => { if (!done) reject(new Error('Failed to load ' + src)); };
      document.head.appendChild(s);
      setTimeout(() => { if (!done) reject(new Error('Timeout loading ' + src)); }, timeout);
    });
  }

  function initFallback(textarea, widget) {
    try {
      const ed = widget.querySelector('.tiptap-editor') || (function(){ const d=document.createElement('div'); d.className='tiptap-editor'; widget.appendChild(d); return d; })();
      ed.contentEditable = 'true';
      ed.innerHTML = textarea.value || '';
      function sync() { textarea.value = ed.innerHTML; textarea.dispatchEvent(new Event('change', { bubbles: true })); }
      ed.addEventListener('input', sync);
      widget.dataset._inited_for = textarea.id;
      return true;
    } catch(e){ console.warn('fallback failed', e); return false; }
  }

  function initTipTap(textarea, widget) {
    try {
      const Editor = window.tiptap && window.tiptap.Editor;
      const StarterKit = window.tiptap && window.tiptap.StarterKit;
      const Image = window.tiptap && window.tiptap.Image;
      if (!Editor) return false;
      const el = widget.querySelector('.tiptap-editor') || (function(){ const d=document.createElement('div'); d.className='tiptap-editor'; widget.appendChild(d); return d; })();
      const extensions = [];
      if (StarterKit) extensions.push(StarterKit);
      if (Image) extensions.push(Image);
      const editor = new Editor({
        element: el,
        content: textarea.value || '',
        extensions: extensions,
        onUpdate: ({ editor: e }) => {
          let html = '';
          try { html = typeof e.getHTML === 'function' ? e.getHTML() : (e.getHTML ? e.getHTML() : ''); } catch (err) {}
          if (!html) html = el.innerHTML;
          textarea.value = html || '';
          textarea.dispatchEvent(new Event('change', { bubbles: true }));
        },
      });
      widget._tiptap_editor = editor;
      widget.dataset._inited_for = textarea.id;
      return true;
    } catch(e){ console.warn('TipTap init error', e); return false; }
  }

  async function bootstrapOne(textarea) {
    let widget = textarea.nextElementSibling && textarea.nextElementSibling.classList && textarea.nextElementSibling.classList.contains('admin-tiptap-widget')
      ? textarea.nextElementSibling
      : (textarea.parentNode ? textarea.parentNode.querySelector('.admin-tiptap-widget') : null);
    if (!widget) return;
    if (widget.dataset._inited_for === textarea.id) return;
    if (window.tiptap && window.tiptap.Editor) { if (initTipTap(textarea, widget)) return; }
    try { await loadScript(LOCAL_UMD, 10000); if (window.tiptap && window.tiptap.Editor) { if (initTipTap(textarea, widget)) return; } } catch(e){ console.warn('UMD load failed', e); }
    initFallback(textarea, widget);
  }

  function bootstrapAll() { qsa('textarea.admin-tiptap-textarea').forEach(bootstrapOne); }
  if (document.readyState === 'loading') { document.addEventListener('DOMContentLoaded', bootstrapAll); } else { bootstrapAll(); }

})();
