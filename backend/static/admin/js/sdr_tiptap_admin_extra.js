// static/admin/js/sdr_tiptap_admin_extra.js
(function () {
  'use strict';

  if (window._sdr_tiptap_loader) return;
  window._sdr_tiptap_loader = true;

  function qsa(sel, ctx) { return Array.from((ctx || document).querySelectorAll(sel)); }
  function qs(sel, ctx) { return (ctx || document).querySelector(sel); }

  // Paths (override these from templates if needed)
  var LOCAL_UMD = window.ADMIN_TIPTAP_UMD_PATH || '/static/admin/vendor/tiptap/tiptap-umd.js';
  var STARTER_UMD_LOCAL = window.ADMIN_TIPTAP_STARTER_UMD_PATH || '/static/admin/vendor/tiptap/starter-kit-umd.js';

  // CDN fallbacks for @tiptap/starter-kit (try several likely variants)
  var STARTER_CDN_CANDIDATES = [
    // prefer jsdelivr minified pattern (works for many setups)
    'https://cdn.jsdelivr.net/npm/@tiptap/starter-kit@2/dist/tiptap-starter-kit.umd.min.js',
    // unpkg variant (non-minified)
    'https://unpkg.com/@tiptap/starter-kit@2/dist/tiptap-starter-kit.umd.js',
    // specific v2.0.0 variant (if your core is v2.x, adjust if you know exact version)
    'https://cdn.jsdelivr.net/npm/@tiptap/starter-kit@2.0.0/dist/tiptap-starter-kit.umd.min.js'
  ];

  var SCRIPT_LOAD_TIMEOUT = 10000;

  function loadScript(src, timeout) {
    timeout = typeof timeout === 'number' ? timeout : SCRIPT_LOAD_TIMEOUT;
    return new Promise(function (resolve, reject) {
      try {
        // quick check: if StarterKit already present in globals, resolve
        if ((window.tiptap && window.tiptap.StarterKit) || (window.TipTap && window.TipTap.StarterKit) || (window['@tiptap/starter-kit'])) {
          return resolve({ ok: true, src: 'already-present' });
        }
        // avoid adding duplicate <script> tags for same src
        var existing = Array.from(document.scripts).find(function(s){ return s && s.src && s.src.indexOf(src) !== -1; });
        if (existing) {
          // wait a bit for it to initialize
          var waited = 0;
          var interval = setInterval(function(){
            waited += 50;
            if ((window.tiptap && window.tiptap.StarterKit) || (window.TipTap && window.TipTap.StarterKit) || (window['@tiptap/starter-kit'])) {
              clearInterval(interval);
              resolve({ ok: true, src: src });
            } else if (waited > Math.min(timeout, 5000)) {
              clearInterval(interval);
              reject(new Error('StarterKit not registered after existing script load: ' + src));
            }
          }, 50);
          return;
        }
        var s = document.createElement('script');
        s.src = src;
        s.async = true;
        s.crossOrigin = 'anonymous';
        var done = false;
        s.onload = function () { done = true; setTimeout(function(){ resolve({ ok: true, src: src }); }, 20); };
        s.onerror = function (e) { if (!done) reject(new Error('Failed to load script ' + src)); };
        document.head.appendChild(s);
        setTimeout(function () { if (!done) reject(new Error('Timeout loading script ' + src)); }, timeout);
      } catch (e) {
        reject(e);
      }
    });
  }

  function normalizeCandidates(raw) {
    var res = [];
    if (raw === null || raw === undefined) return res;
    res.push(raw);
    try { if (raw.default && raw.default !== raw) res.push(raw.default); } catch(e){}
    try { if (typeof raw === 'function') res.push(raw); } catch(e){}
    try { if (typeof raw.configure === 'function') res.push(raw.configure()); } catch(e){}
    return res.filter(function(v,i,arr){ return v != null && arr.indexOf(v) === i; });
  }

  function tryCreateEditorWithExtensions(extensions) {
    try {
      var Editor = (window.tiptap && window.tiptap.Editor) || (window.tiptapCore && window.tiptapCore.Editor) || (window['@tiptap/core'] && window['@tiptap/core'].Editor);
      if (!Editor) return { ok: false, err: new Error('Editor not found') };
      var el = document.createElement('div');
      var inst = new Editor({ element: el, content: '', extensions: extensions });
      var hasDoc = inst && inst.schema && inst.schema.nodes && inst.schema.nodes.doc;
      try { inst.destroy && inst.destroy(); } catch (e) { /* ignore */ }
      return { ok: !!hasDoc, err: hasDoc ? null : new Error('schema missing doc') };
    } catch (e) {
      return { ok: false, err: e };
    }
  }

  function buildExtensionCandidates(StarterRaw, ImageRaw) {
    var starterCands = normalizeCandidates(StarterRaw);
    var imageCands = normalizeCandidates(ImageRaw);
    var combos = [];
    starterCands.forEach(function(s){
      if (imageCands.length) {
        imageCands.forEach(function(img){ combos.push([s, img]); });
      }
      combos.push([s]);
    });
    combos.push([]);
    // unique by fingerprint
    var seen = {};
    var uniq = combos.filter(function(c){
      var key = c.map(function(x){ return (x && x.name) || (x && x.constructor && x.constructor.name) || String(x); }).join('|');
      if (seen[key]) return false;
      seen[key] = true;
      return true;
    });
    return uniq;
  }

  function detectWorkingExtensions(StarterRaw, ImageRaw) {
    var combos = buildExtensionCandidates(StarterRaw, ImageRaw);
    for (var i = 0; i < combos.length; i++) {
      var candidate = combos[i];
      try {
        var res = tryCreateEditorWithExtensions(candidate);
        if (res.ok) {
          console.debug('[sdr] working extensions found at index', i);
          return candidate;
        }
      } catch (e) {
        console.debug('[sdr] candidate test error', e && e.message);
      }
    }
    return null;
  }

  function initFallback(textarea, widget) {
    try {
      var ed = widget.querySelector('.tiptap-editor') || (function(){ var d = document.createElement('div'); d.className='tiptap-editor'; widget.appendChild(d); return d; })();
      ed.contentEditable = 'true';
      ed.spellcheck = true;
      ed.innerHTML = textarea.value || '';
      function sync(){ textarea.value = ed.innerHTML; textarea.dispatchEvent(new Event('change', { bubbles: true })); }
      ed.addEventListener('input', sync);
      ed.addEventListener('blur', sync);
      var f = textarea.closest('form');
      if (f) { f.addEventListener('submit', sync); }
      widget.dataset._inited_for = textarea.id;
      console.info('[sdr] TipTap fallback initialized (contentEditable).');
      return true;
    } catch (e) { console.warn('[sdr] fallback failed', e); return false; }
  }

  function initTipTapWithGivenExtensions(textarea, widget, extensions) {
    try {
      var Editor = (window.tiptap && window.tiptap.Editor) || (window.tiptapCore && window.tiptapCore.Editor) || (window['@tiptap/core'] && window['@tiptap/core'].Editor);
      if (!Editor) return false;
      var el = widget.querySelector('.tiptap-editor') || (function(){ var d = document.createElement('div'); d.className='tiptap-editor'; widget.appendChild(d); return d; })();
      var editor = new Editor({
        element: el,
        content: textarea.value || '',
        extensions: extensions,
        onUpdate: function (payload) {
          var e = payload && payload.editor ? payload.editor : payload;
          var html = '';
          try { html = typeof e.getHTML === 'function' ? e.getHTML() : (e && e.getHTML ? e.getHTML() : ''); } catch (err) {}
          if (!html) html = el.innerHTML;
          textarea.value = html || '';
          textarea.dispatchEvent(new Event('change', { bubbles: true }));
        }
      });
      widget._tiptap_editor = editor;
      widget.dataset._inited_for = textarea.id;
      console.info('[sdr] TipTap initialized successfully (live).');
      return true;
    } catch (e) {
      console.warn('[sdr] TipTap live init failed', e);
      return false;
    }
  }

  // Try to ensure StarterKit exists; return true if available after attempts.
  async function ensureStarterKitAvailable() {
    // quick check
    if ((window.tiptap && window.tiptap.StarterKit) || (window.TipTap && window.TipTap.StarterKit) || (window['@tiptap/starter-kit'])) {
      console.debug('[sdr] StarterKit already present');
      return true;
    }

    // Try local starter UMD first
    try {
      await loadScript(STARTER_UMD_LOCAL, 7000);
      if ((window.tiptap && window.tiptap.StarterKit) || (window.TipTap && window.TipTap.StarterKit) || (window['@tiptap/starter-kit'])) {
        console.info('[sdr] StarterKit loaded from local path:', STARTER_UMD_LOCAL);
        return true;
      }
    } catch (e) {
      console.debug('[sdr] local starter UMD load failed', e && e.message);
    }

    // Try CDN candidates sequentially
    for (var i = 0; i < STARTER_CDN_CANDIDATES.length; i++) {
      var url = STARTER_CDN_CANDIDATES[i];
      try {
        await loadScript(url, 8000);
        if ((window.tiptap && window.tiptap.StarterKit) || (window.TipTap && window.TipTap.StarterKit) || (window['@tiptap/starter-kit'])) {
          console.info('[sdr] StarterKit loaded from CDN:', url);
          return true;
        }
      } catch (e) {
        console.debug('[sdr] starter CDN candidate failed', url, e && e.message);
      }
    }

    console.warn('[sdr] StarterKit could not be loaded by loader (tried local + CDN). Please ensure starter-kit UMD with matching tiptap major version is available.');
    return false;
  }

  async function bootstrapOne(textarea) {
    try {
      if (!textarea || !textarea.classList || !textarea.classList.contains('admin-tiptap-textarea')) return;
      var widget = textarea.nextElementSibling && textarea.nextElementSibling.classList && textarea.nextElementSibling.classList.contains('admin-tiptap-widget')
        ? textarea.nextElementSibling
        : (textarea.parentNode ? textarea.parentNode.querySelector('.admin-tiptap-widget') : null);
      if (!widget) return;
      if (widget.dataset._inited_for === textarea.id) return;

      // Try preloaded TipTap first (may be included in your page)
      try {
        if (window.tiptap && (window.tiptap.Editor || (window.tiptapCore && window.tiptapCore.Editor) || (window['@tiptap/core'] && window['@tiptap/core'].Editor))) {
          var StarterRaw = (window.tiptap && window.tiptap.StarterKit) || (window.TipTap && window.TipTap.StarterKit) || (window['@tiptap/starter-kit'] && window['@tiptap/starter-kit'].default) || null;
          var ImageRaw = (window.tiptap && window.tiptap.Image) || (window.TipTap && window.TipTap.Image) || null;

          // first detection attempt
          var good = detectWorkingExtensions(StarterRaw, ImageRaw);
          if (good) {
            var ok = initTipTapWithGivenExtensions(textarea, widget, good);
            if (ok) return;
          }

          // If Editor exists but schema missing doc (common when core loaded without starter),
          // attempt to load StarterKit and re-attempt init.
          try {
            // quick probe: try to create a transient editor with no extensions to see schema state
            var probe = tryCreateEditorWithExtensions([]);
            if (probe && !probe.ok && probe.err && probe.err.message && probe.err.message.indexOf('schema missing doc') !== -1) {
              console.warn('[sdr] Detected schema missing doc in current TipTap core — attempting to load StarterKit and retry');
              var starterOk = await ensureStarterKitAvailable();
              if (starterOk) {
                // re-evaluate Starter export possibilities
                var StarterRaw2 = (window.tiptap && window.tiptap.StarterKit) || (window.TipTap && window.TipTap.StarterKit) || (window['@tiptap/starter-kit'] && window['@tiptap/starter-kit'].default) || null;
                var ImageRaw2 = (window.tiptap && window.tiptap.Image) || (window.TipTap && window.TipTap.Image) || null;
                var good2 = detectWorkingExtensions(StarterRaw2, ImageRaw2);
                if (good2 && initTipTapWithGivenExtensions(textarea, widget, good2)) return;
                // If still not good, attempt generic init using StarterRaw2 directly
                if (StarterRaw2 && initTipTapWithGivenExtensions(textarea, widget, [StarterRaw2])) return;
              }
            }
          } catch (e) {
            console.debug('[sdr] probe error', e && e.message);
          }
        }
      } catch (e) {
        console.debug('[sdr] preload attempt error', e && e.message);
      }

      // If we reached here, try loading core UMD if needed (local)
      try {
        if (!(window.tiptap && window.tiptap.Editor) && !(window.tiptapCore && window.tiptapCore.Editor) && !(window['@tiptap/core'] && window['@tiptap/core'].Editor)) {
          try { await loadScript(LOCAL_UMD, 10000); } catch(e) { console.warn('[sdr] local tiptap UMD load failed', e && e.message); }
        }
      } catch (e) { /* ignore */ }

      // Ensure StarterKit exists (load local or CDN)
      var starterPresent = !!((window.tiptap && window.tiptap.StarterKit) || (window.TipTap && window.TipTap.StarterKit) || (window['@tiptap/starter-kit']));
      if (!starterPresent) {
        await ensureStarterKitAvailable();
      }

      // Final detection and init attempt after loads
      try {
        var StarterRaw3 = (window.tiptap && window.tiptap.StarterKit) || (window.TipTap && window.TipTap.StarterKit) || (window['@tiptap/starter-kit'] && window['@tiptap/starter-kit'].default) || null;
        var ImageRaw3 = (window.tiptap && window.tiptap.Image) || (window.TipTap && window.TipTap.Image) || null;
        var good3 = detectWorkingExtensions(StarterRaw3, ImageRaw3);
        if (good3 && initTipTapWithGivenExtensions(textarea, widget, good3)) return;
        // try generic starter raw if exists
        if (StarterRaw3 && initTipTapWithGivenExtensions(textarea, widget, [StarterRaw3])) return;
      } catch (e) {
        console.debug('[sdr] post-load detection failed', e && e.message);
      }

      // last resort: fallback
      initFallback(textarea, widget);
    } catch (err) {
      console.warn('[sdr] bootstrapOne unexpected error', err);
      try { initFallback(textarea, widget); } catch(e) {}
    }
  }

  function bootstrapAll() {
    qsa('textarea.admin-tiptap-textarea').forEach(function(t){ try { bootstrapOne(t); } catch(e) { console.warn('[sdr] bootstrapOne failed for textarea', e); } });
  }

  // Expose API (for inline widget script to call)
  try {
    window._sdr_tiptap_bootstrapOne = bootstrapOne;
    window._sdr_tiptap_bootstrapAll = bootstrapAll;
  } catch (e) { /* ignore */ }

  // Listen to widget-ready events from inline scripts
  document.addEventListener('sdr_tiptap_widget_ready', function (ev) {
    try {
      var id = ev && ev.detail && ev.detail.textareaId;
      if (id) {
        var ta = document.getElementById(id);
        if (ta) setTimeout(function(){ try { bootstrapOne(ta); } catch(e){ console.warn(e); } }, 0);
      }
    } catch (e) { /* ignore */ }
  });

  // DOM ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () {
      setTimeout(function () {
        try { bootstrapAll(); } catch (e) { console.warn('[sdr] bootstrapAll failed', e); }
        try { document.dispatchEvent(new CustomEvent('sdr_tiptap_ready')); } catch(e){/*ignore*/ }
      }, 20);
    });
  } else {
    setTimeout(function () {
      try { bootstrapAll(); } catch (e) { console.warn('[sdr] bootstrapAll failed', e); }
      try { document.dispatchEvent(new CustomEvent('sdr_tiptap_ready')); } catch(e){/*ignore*/ }
    }, 20);
  }

})();
