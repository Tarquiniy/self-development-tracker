// static/admin/js/sdr_tiptap_admin_extra.js
(function () {
  'use strict';

  if (window._sdr_tiptap_loader) return;
  window._sdr_tiptap_loader = true;

  function qsa(sel, ctx) { return Array.from((ctx || document).querySelectorAll(sel)); }
  function qs(sel, ctx) { return (ctx || document).querySelector(sel); }

  // configurable paths (can be overridden by templates or global vars)
  var LOCAL_UMD = window.ADMIN_TIPTAP_UMD_PATH || '/static/admin/vendor/tiptap/tiptap-umd.js';
  var STARTER_UMD = window.ADMIN_TIPTAP_STARTER_UMD_PATH || '/static/admin/vendor/tiptap/starter-kit-umd.js';
  // CDN fallback for starter-kit (best-effort; version may be adjusted)
  var STARTER_CDN = window.ADMIN_TIPTAP_STARTER_UMD_CDN || 'https://cdn.jsdelivr.net/npm/@tiptap/starter-kit@2.0.0/dist/tiptap-starter-kit.umd.min.js';
  var SCRIPT_LOAD_TIMEOUT = 10000;

  function loadScript(src, timeout) {
    timeout = typeof timeout === 'number' ? timeout : SCRIPT_LOAD_TIMEOUT;
    return new Promise(function (resolve, reject) {
      try {
        // if the script already seems loaded (some globals exist), resolve early
        if (window.tiptap && window.tiptap.Editor) return resolve(true);

        var s = document.createElement('script');
        s.src = src;
        s.async = true;
        s.crossOrigin = 'anonymous';
        var done = false;
        s.onload = function () { done = true; setTimeout(function(){ resolve(true); }, 10); };
        s.onerror = function (e) { if (!done) reject(new Error('Failed to load ' + src)); };
        document.head.appendChild(s);
        setTimeout(function () { if (!done) reject(new Error('Timeout loading ' + src)); }, timeout);
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
    // unique
    return res.filter(function(v,i,arr){ return v != null && arr.indexOf(v) === i; });
  }

  function tryCreateEditorWithExtensions(extensions) {
    try {
      var Editor = (window.tiptap && window.tiptap.Editor) || (window.tiptapCore && window.tiptapCore.Editor) || (window['@tiptap/core'] && window['@tiptap/core'].Editor);
      if (!Editor) { return { ok: false, err: new Error('Editor not found') }; }
      var el = document.createElement('div');
      var inst = new Editor({ element: el, content: '', extensions: extensions });
      var hasDoc = inst && inst.schema && inst.schema.nodes && inst.schema.nodes.doc;
      try { inst.destroy && inst.destroy(); } catch (e) {}
      return { ok: !!hasDoc, err: hasDoc ? null : new Error('schema missing doc') };
    } catch (e) {
      return { ok: false, err: e };
    }
  }

  function buildExtensionCandidates(StarterKitRaw, ImageRaw) {
    var starterCands = normalizeCandidates(StarterKitRaw);
    var imageCands = normalizeCandidates(ImageRaw);
    var combos = [];

    starterCands.forEach(function(s){
      if (imageCands.length) {
        imageCands.forEach(function(img){ combos.push([s, img]); });
      }
      combos.push([s]);
    });
    combos.push([]);
    // unique by simple fingerprint
    var seen = {};
    var uniq = combos.filter(function(c){
      var key = c.map(function(x){ return (x && x.name) || (x && x.constructor && x.constructor.name) || String(x); }).join('|');
      if (seen[key]) return false;
      seen[key] = true;
      return true;
    });
    return uniq;
  }

  function detectWorkingExtensions(StarterKitRaw, ImageRaw) {
    var combos = buildExtensionCandidates(StarterKitRaw, ImageRaw);
    for (var i = 0; i < combos.length; i++) {
      var candidate = combos[i];
      try {
        var res = tryCreateEditorWithExtensions(candidate);
        if (res.ok) {
          return candidate;
        }
      } catch (e) {
        // continue
      }
    }
    return null;
  }

  function initFallback(textarea, widget) {
    try {
      var ed = widget.querySelector('.tiptap-editor') || (function(){ var d = document.createElement('div'); d.className = 'tiptap-editor'; widget.appendChild(d); return d; })();
      ed.contentEditable = 'true';
      ed.spellcheck = true;
      ed.innerHTML = textarea.value || '';
      function sync(){ textarea.value = ed.innerHTML; textarea.dispatchEvent(new Event('change', { bubbles: true })); }
      ed.addEventListener('input', sync);
      ed.addEventListener('blur', sync);
      var f = textarea.closest('form');
      if (f) { f.addEventListener('submit', sync); }
      widget.dataset._inited_for = textarea.id;
      console.info('TipTap fallback initialized (contentEditable).');
      return true;
    } catch (e) {
      console.warn('fallback failed', e);
      return false;
    }
  }

  function initTipTapWithGivenExtensions(textarea, widget, extensions) {
    try {
      var Editor = (window.tiptap && window.tiptap.Editor) || (window.tiptapCore && window.tiptapCore.Editor) || (window['@tiptap/core'] && window['@tiptap/core'].Editor);
      if (!Editor) return false;
      var el = widget.querySelector('.tiptap-editor') || (function(){ var d = document.createElement('div'); d.className = 'tiptap-editor'; widget.appendChild(d); return d; })();
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
      console.info('TipTap initialized successfully (live).');
      return true;
    } catch (e) {
      console.warn('TipTap live init failed', e);
      return false;
    }
  }

  // bootstrapOne: try preloaded TipTap, else try load UMD(s), else fallback
  async function bootstrapOne(textarea) {
    try {
      if (!textarea || !textarea.classList || !textarea.classList.contains('admin-tiptap-textarea')) return;
      var widget = textarea.nextElementSibling && textarea.nextElementSibling.classList && textarea.nextElementSibling.classList.contains('admin-tiptap-widget')
        ? textarea.nextElementSibling
        : (textarea.parentNode ? textarea.parentNode.querySelector('.admin-tiptap-widget') : null);
      if (!widget) return;
      if (widget.dataset._inited_for === textarea.id) return;

      // first attempt: if tiptap core + starter already present, try to detect correct extensions
      try {
        if (window.tiptap && (window.tiptap.Editor || (window.tiptapCore && window.tiptapCore.Editor) || (window['@tiptap/core'] && window['@tiptap/core'].Editor))) {
          var StarterRaw = (window.tiptap && window.tiptap.StarterKit) || (window.TipTap && window.TipTap.StarterKit) || (window['@tiptap/starter-kit'] && window['@tiptap/starter-kit'].default) || null;
          var ImageRaw = (window.tiptap && window.tiptap.Image) || (window.TipTap && window.TipTap.Image) || null;
          if (StarterRaw || ImageRaw) {
            var good = detectWorkingExtensions(StarterRaw, ImageRaw);
            if (good && initTipTapWithGivenExtensions(textarea, widget, good)) return;
          } else {
            // try generic init with whatever starter reference exists
            if (initTipTapWithGivenExtensions(textarea, widget, [StarterRaw])) return;
          }
        }
      } catch (e) {
        // continue to attempt load
        console.debug('preload attempt error', e && e.message);
      }

      // attempt to load core UMD (if not already present)
      try {
        if (!(window.tiptap && window.tiptap.Editor) && !(window.tiptapCore && window.tiptapCore.Editor) && !(window['@tiptap/core'] && window['@tiptap/core'].Editor)) {
          await loadScript(LOCAL_UMD, 10000).catch(function(err){ console.warn('Local tiptap UMD load failed', err); });
        }
      } catch (e) { /* ignore */ }

      // now try to ensure StarterKit exists: many builds provide it separately
      try {
        var starterPresent = !!((window.tiptap && window.tiptap.StarterKit) || (window.TipTap && window.TipTap.StarterKit) || (window['@tiptap/starter-kit']));
        if (!starterPresent) {
          // try local starter-umd first
          try {
            await loadScript(STARTER_UMD, 7000).catch(function(){ /* swallow */ });
          } catch(e){}
          // re-evaluate
          starterPresent = !!((window.tiptap && window.tiptap.StarterKit) || (window.TipTap && window.TipTap.StarterKit) || (window['@tiptap/starter-kit']));
          if (!starterPresent) {
            // try CDN fallback
            try {
              await loadScript(STARTER_CDN, 8000).catch(function(){ /* swallow */ });
            } catch(e){}
          }
        }
      } catch (e) {
        console.warn('starter load attempts failed', e && e.message);
      }

      // detection after loads
      try {
        var StarterRaw2 = (window.tiptap && window.tiptap.StarterKit) || (window.TipTap && window.TipTap.StarterKit) || (window['@tiptap/starter-kit'] && window['@tiptap/starter-kit'].default) || null;
        var ImageRaw2 = (window.tiptap && window.tiptap.Image) || (window.TipTap && window.TipTap.Image) || null;
        var good2 = detectWorkingExtensions(StarterRaw2, ImageRaw2);
        if (good2 && initTipTapWithGivenExtensions(textarea, widget, good2)) return;
      } catch (e) {
        console.warn('post-load detection failed', e && e.message);
      }

      // final fallback
      initFallback(textarea, widget);
    } catch (err) {
      console.warn('bootstrapOne unexpected error', err);
      try { initFallback(textarea, widget); } catch(e) {}
    }
  }

  function bootstrapAll() {
    qsa('textarea.admin-tiptap-textarea').forEach(function(t){ try { bootstrapOne(t); } catch(e) { console.warn('bootstrapOne failed for textarea', e); } });
  }

  // expose small api for inline widget script to call directly
  try {
    window._sdr_tiptap_bootstrapOne = bootstrapOne;
    window._sdr_tiptap_bootstrapAll = bootstrapAll;
  } catch (e) {
    // ignore if assignment to window fails (very unusual)
  }

  // listen to individual widget ready events from inline snippets
  document.addEventListener('sdr_tiptap_widget_ready', function (ev) {
    try {
      var id = ev && ev.detail && ev.detail.textareaId;
      if (id) {
        var ta = document.getElementById(id);
        if (ta) {
          // schedule so multiple synchronous events are batched
          setTimeout(function(){ try { bootstrapOne(ta); } catch(e){ console.warn(e); } }, 0);
        }
      }
    } catch (e) { /* ignore */ }
  });

  // run on DOM ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () {
      setTimeout(function () {
        try { bootstrapAll(); } catch (e) { console.warn('bootstrapAll failed', e); }
        try { document.dispatchEvent(new CustomEvent('sdr_tiptap_ready')); } catch(e){/*ignore*/ }
      }, 20);
    });
  } else {
    setTimeout(function () {
      try { bootstrapAll(); } catch (e) { console.warn('bootstrapAll failed', e); }
      try { document.dispatchEvent(new CustomEvent('sdr_tiptap_ready')); } catch(e){/*ignore*/ }
    }, 20);
  }

})();
