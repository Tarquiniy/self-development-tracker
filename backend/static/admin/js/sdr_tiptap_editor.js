// static/admin/js/sdr_tiptap_admin_extra.js
(function () {
  if (window._sdr_tiptap_loader) return;
  window._sdr_tiptap_loader = true;

  function qsa(sel, ctx) { return Array.from((ctx || document).querySelectorAll(sel)); }
  function qs(sel, ctx) { return (ctx || document).querySelector(sel); }
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

  function normalizeCandidates(raw) {
    // produce candidate representations for an export:
    // raw (as is), raw.default, raw() if function, raw.configure() if has configure
    const res = [];
    if (!raw && raw !== 0) return res;
    res.push(raw);
    if (raw.default && raw.default !== raw) res.push(raw.default);
    try { if (typeof raw === 'function') res.push(raw); } catch(e) {}
    try { if (typeof raw === 'function') { let inst = raw(); if (inst) res.push(inst); } } catch(e) {}
    try { if (raw && typeof raw.configure === 'function') res.push(raw.configure()); } catch(e) {}
    // unique
    return res.filter((v,i,arr)=>v!=null && arr.indexOf(v)===i);
  }

  function tryCreateEditorWithExtensions(extensions) {
    // try to construct a short-lived Editor to validate schema
    try {
      const Editor = (window.tiptap && window.tiptap.Editor) || (window.tiptapCore && window.tiptapCore.Editor) || (window['@tiptap/core'] && window['@tiptap/core'].Editor);
      if (!Editor) { return { ok: false, err: new Error('Editor not found') }; }
      // ephemeral element not attached to DOM
      const el = document.createElement('div');
      const inst = new Editor({ element: el, content: '', extensions: extensions });
      // validate schema has top node 'doc'
      const hasDoc = inst && inst.schema && inst.schema.nodes && inst.schema.nodes.doc;
      // destroy editor if possible to avoid leaks
      try { inst.destroy && inst.destroy(); } catch(e){/*ignore*/ }
      return { ok: !!hasDoc, err: hasDoc ? null : new Error('schema missing doc') };
    } catch (e) {
      return { ok: false, err: e };
    }
  }

  function buildExtensionCandidates(StarterKitRaw, ImageRaw) {
    const starterCands = normalizeCandidates(StarterKitRaw);
    const imageCands = normalizeCandidates(ImageRaw);

    const combos = [];

    // produce combinations: [starter, image], [starter], []
    starterCands.forEach(s => {
      // try with image variants
      if (imageCands.length) {
        imageCands.forEach(img => combos.push([s, img]));
      }
      combos.push([s]);
    });

    // final fallback: no starter (probably won't work)
    combos.push([]);

    // unique combos by JSON-ish fingerprint (not perfect but ok)
    const seen = new Set();
    const uniq = combos.filter(c => {
      const key = c.map(x => (x && x.name) || (x && x.constructor && x.constructor.name) || String(x)).join('|');
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });

    return uniq;
  }

  // attempt to find working extensions set and return it (or null)
  function detectWorkingExtensions(StarterKitRaw, ImageRaw) {
    const combos = buildExtensionCandidates(StarterKitRaw, ImageRaw);
    for (let i = 0; i < combos.length; i++) {
      const candidate = combos[i];
      try {
        const res = tryCreateEditorWithExtensions(candidate);
        console.debug('Trying candidate', i, candidate, '=>', res.ok, res.err && res.err.message);
        if (res.ok) {
          console.info('Found working TipTap extensions candidate at index', i);
          return candidate;
        }
      } catch (e) {
        console.warn('Candidate test error', e);
      }
    }
    return null;
  }

  function initFallback(textarea, widget) {
    try {
      const ed = widget.querySelector('.tiptap-editor') || (function(){ const d=document.createElement('div'); d.className='tiptap-editor'; widget.appendChild(d); return d; })();
      ed.contentEditable = 'true';
      ed.innerHTML = textarea.value || '';
      function sync() { textarea.value = ed.innerHTML; textarea.dispatchEvent(new Event('change', { bubbles: true })); }
      ed.addEventListener('input', sync);
      widget.dataset._inited_for = textarea.id;
      console.warn('TipTap fallback initialized (contentEditable).');
      return true;
    } catch (e) { console.warn('fallback failed', e); return false; }
  }

  function initTipTapWithGivenExtensions(textarea, widget, extensions) {
    try {
      const Editor = (window.tiptap && window.tiptap.Editor) || (window.tiptapCore && window.tiptapCore.Editor) || (window['@tiptap/core'] && window['@tiptap/core'].Editor);
      if (!Editor) return false;
      const el = widget.querySelector('.tiptap-editor') || (function(){ const d=document.createElement('div'); d.className='tiptap-editor'; widget.appendChild(d); return d; })();
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
      console.info('TipTap initialized successfully (live).');
      return true;
    } catch (e) {
      console.warn('TipTap live init failed', e);
      return false;
    }
  }

  async function bootstrapOne(textarea) {
    let widget = textarea.nextElementSibling && textarea.nextElementSibling.classList && textarea.nextElementSibling.classList.contains('admin-tiptap-widget')
      ? textarea.nextElementSibling
      : (textarea.parentNode ? textarea.parentNode.querySelector('.admin-tiptap-widget') : null);

    if (!widget) return;
    if (widget.dataset._inited_for === textarea.id) return;

    // try if already available
    try {
      if (window.tiptap && (window.tiptap.Editor || (window.tiptapCore && window.tiptapCore.Editor))) {
        // detect best candidate on the fly
        const StarterKitRaw = (window.tiptap && window.tiptap.StarterKit) || (window.TipTap && window.TipTap.StarterKit);
        const ImageRaw = (window.tiptap && window.tiptap.Image) || (window.TipTap && window.TipTap.Image);
        if (StarterKitRaw || ImageRaw) {
          const good = detectWorkingExtensions(StarterKitRaw, ImageRaw);
          if (good) {
            if (initTipTapWithGivenExtensions(textarea, widget, good)) return;
          }
        } else {
          // try generic init with whatever exists
          if (initTipTapWithGivenExtensions(textarea, widget, [ (window.tiptap && window.tiptap.StarterKit) || (window.TipTap && window.TipTap.StarterKit) ])) {
            return;
          }
        }
      }
    } catch (e) {
      console.warn('Preload init attempt failed', e);
    }

    // load UMD if needed
    try {
      await loadScript(LOCAL_UMD, 10000);
    } catch (e) {
      console.warn('UMD load failed', e);
    }

    // after load, attempt detection again
    try {
      const StarterKitRaw = (window.tiptap && window.tiptap.StarterKit) || (window.TipTap && window.TipTap.StarterKit);
      const ImageRaw = (window.tiptap && window.tiptap.Image) || (window.TipTap && window.TipTap.Image);
      const good = detectWorkingExtensions(StarterKitRaw, ImageRaw);
      if (good) {
        if (initTipTapWithGivenExtensions(textarea, widget, good)) return;
      }
    } catch (e) {
      console.warn('Post-load detection failed', e);
    }

    // final fallback
    initFallback(textarea, widget);
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
