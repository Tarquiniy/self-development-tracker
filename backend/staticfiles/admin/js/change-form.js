// backend/static/admin/js/change-form.js
(function(){
  // config from template
  const cfg = window.__PT_CONFIG || {};
  const MEDIA_UPLOAD_URL = cfg.MEDIA_UPLOAD_URL || '/api/media/upload/';
  const MEDIA_LIST_URL = cfg.MEDIA_LIST_URL || '/api/media/list/';

  // helper
  function qs(sel, root){ root = root || document; return root.querySelector(sel); }
  function qsa(sel, root){ root = root || document; return Array.from((root || document).querySelectorAll(sel)); }
  function getCSRF(){
    const el = document.querySelector('input[name="csrfmiddlewaretoken"]');
    return el ? el.value : null;
  }

  // map editors -> name
  window.editorMap = window.editorMap || {};

  // CKEditor upload adapter that POSTs to MEDIA_UPLOAD_URL and expects JSON { url: "..." }
  class SupabaseUploadAdapter {
    constructor(loader){ this.loader = loader; }
    upload(){
      return this.loader.file.then(file => new Promise((resolve, reject) => {
        const fd = new FormData();
        fd.append('file', file);
        fetch(MEDIA_UPLOAD_URL, {
          method: 'POST',
          credentials: 'same-origin',
          headers: { 'X-CSRFToken': getCSRF() || '' },
          body: fd
        }).then(async res => {
          if(!res.ok){ const t = await res.text().catch(()=>res.statusText); reject(t || 'Upload failed'); return; }
          const json = await res.json().catch(()=>null);
          if(json && json.url) resolve({ default: json.url });
          else reject('Invalid upload response');
        }).catch(err => reject(err.message || String(err)));
      }));
    }
    abort(){}
  }

  function SupabaseAdapterPlugin(editor){
    editor.plugins.get('FileRepository').createUploadAdapter = function(loader){
      return new SupabaseUploadAdapter(loader);
    };
  }

  // init CKEditor for a given textarea (bound field)
  function initEditorForTextarea(ta){
    if(!ta) return Promise.resolve(null);
    if(ta.getAttribute('data-pt-ck-inited')) return Promise.resolve(window.editorMap[ta.name] || null);
    ta.setAttribute('data-pt-ck-inited', '1');

    // ensure textarea visible (CKEditor will replace it)
    // create editor
    if(typeof ClassicEditor === 'undefined'){
      console.warn('ClassicEditor not available');
      return Promise.resolve(null);
    }

    return ClassicEditor.create(ta, {
      extraPlugins: [ SupabaseAdapterPlugin ],
      toolbar: [
        'heading','|','bold','italic','underline','strikethrough','|',
        'link','bulletedList','numberedList','blockQuote','|',
        'insertTable','mediaEmbed','imageUpload','|','undo','redo'
      ],
      language: 'ru'
    }).then(editor => {
      window.editorMap[ta.name] = editor;
      return editor;
    }).catch(err => {
      console.error('CKEditor init error for', ta.name, err);
      return null;
    });
  }

  // initialize editors by candidate names
  const CANDIDATES = ['content','excerpt','short_description','body','description','summary'];

  function initAllEditors(){
    CANDIDATES.forEach(name => {
      const ta = qs('textarea[name="'+name+'"]');
      if(ta) initEditorForTextarea(ta);
    });
  }

  // open media library in popup (uses admin-media-library route)
  function openMediaLibraryPopup(){
    const url = (function(){
      try { return new URL('{% static "" }', location.href); } catch(e) { return null; }
    })();
    // We use named admin route from template; fallback:
    const base = (window.__PT_CONFIG && window.__PT_CONFIG.ADMIN_MEDIA_LIBRARY_URL) || '/admin/media-library/';
    window.open(base, 'media_library', 'width=1000,height=700,scrollbars=yes');
    return false;
  }

  // insert media URL into the best editor
  window.__insertMediaToEditor = function(url, preferField){
    try {
      preferField = preferField || 'content';
      if(window.editorMap && window.editorMap[preferField]){
        const ed = window.editorMap[preferField];
        ed.model.change(writer => {
          const imageElement = writer.createElement('image', { src: url });
          ed.model.insertContent(imageElement, ed.model.document.selection);
        });
        return true;
      }
      for(const k in window.editorMap){
        const ed = window.editorMap[k];
        if(ed){
          ed.model.change(writer => {
            const imageElement = writer.createElement('image', { src: url });
            ed.model.insertContent(imageElement, ed.model.document.selection);
          });
          return true;
        }
      }
      // fallback: append to first textarea
      const ta = document.querySelector('textarea[name="'+(preferField||'')+'"]') || document.querySelector('textarea');
      if(ta){ ta.value = (ta.value || '') + "\n<img src='" + url + "' alt=''/> \n"; return true; }
    } catch(e){ console.warn('insertMediaToEditor failed', e); }
    return false;
  };

  // sync editors into textarea before submit
  function syncEditorsToTextarea(){
    for(const name in window.editorMap){
      try{
        const ed = window.editorMap[name];
        if(ed && typeof ed.getData === 'function'){
          const ta = document.querySelector('textarea[name="'+name+'"]');
          if(ta) ta.value = ed.getData();
        }
      }catch(e){}
    }
  }

  // attach buttons: save, continue
  function attachButtons(){
    const form = document.getElementById('post_form');
    if(!form) return;

    function submitWithFlag(name){
      syncEditorsToTextarea();
      const inp = document.createElement('input'); inp.type='hidden'; inp.name = name; inp.value='1';
      form.appendChild(inp);
      form.submit();
    }

    const saveBtn = document.getElementById('pt-save-btn');
    const contBtn = document.getElementById('pt-continue-btn');
    if(saveBtn) saveBtn.addEventListener('click', function(){ submitWithFlag('_save'); });
    if(contBtn) contBtn.addEventListener('click', function(){ submitWithFlag('_continue'); });

    // keyboard shortcut: Ctrl+S / Cmd+S
    document.addEventListener('keydown', function(e){
      if((e.ctrlKey||e.metaKey) && e.key.toLowerCase()==='s'){
        e.preventDefault();
        if(saveBtn) saveBtn.click();
      }
      if((e.ctrlKey||e.metaKey) && e.key.toLowerCase()==='k'){
        // focus search
        const s = document.querySelector('.search-input');
        if(s){ e.preventDefault(); s.focus(); }
      }
    });

    // preview: open new window with current content
    const previewBtn = document.getElementById('preview-btn') || document.getElementById('preview-post-btn');
    if(previewBtn){
      previewBtn.addEventListener('click', function(){
        syncEditorsToTextarea();
        const title = (form.querySelector('[name=title]')||{}).value || '';
        const content = (window.editorMap['content'] && window.editorMap['content'].getData()) || (form.querySelector('[name=content]') || {}).value || '';
        const short = (window.editorMap['excerpt'] && window.editorMap['excerpt'].getData()) || (form.querySelector('[name=excerpt]') || {}).value || '';
        const w = window.open('', '_blank');
        if(!w) { alert('Пожалуйста, разрешите всплывающие окна для предпросмотра'); return; }
        const html = `
          <!doctype html>
          <html><head><meta charset="utf-8"><title>Предпросмотр — ${escapeHtml(title)}</title>
          <meta name="viewport" content="width=device-width,initial-scale=1">
          <link rel="stylesheet" href="${window.location.origin + '{% static "admin/css/main.css" %}'}">
          </head><body><article style="max-width:900px;margin:20px auto;padding:20px;background:#fff;">
          <h1>${escapeHtml(title)}</h1>
          <section>${short}</section>
          <section>${content}</section>
          </article></body></html>`;
        w.document.open(); w.document.write(html); w.document.close();
      });
    }

    // generate slug button
    const gen = document.getElementById('pt-gen-slug');
    const title = document.getElementById('id_title');
    const slug = document.getElementById('id_slug');
    if(gen && title && slug){
      gen.addEventListener('click', function(){
        const s = title.value.toLowerCase().replace(/[^\w\s-]/g,'').replace(/[\s_-]+/g,'-').replace(/^-+|-+$/g,'').substring(0,60);
        slug.value = s;
      });
    }
  }

  function escapeHtml(s){ return (s||'').replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;'); }

  // excerpt counter
  function attachExcerptCounter(){
    const ex = document.getElementById('id_excerpt');
    const counter = document.getElementById('pt-excerpt-count');
    if(!ex || !counter) return;
    function upd(){ counter.textContent = ex.value.length; }
    upd();
    ex.addEventListener('input', upd);
  }

  // wire media buttons
  function attachMediaButtons(){
    qsa('#open-media-lib, #open-media-lib-2').forEach(btn => {
      if(!btn) return;
      btn.addEventListener('click', function(e){
        e.preventDefault();
        const url = '/admin/media-library/'; // admin_media_library_view route
        window.open(url, 'media_library', 'width=1000,height=700,scrollbars=yes');
      });
    });
  }

  // on DOM ready
  document.addEventListener('DOMContentLoaded', function(){
    // init editors for any candidate fields
    try { initAllEditors(); } catch(e){ console.error(e); }
    attachButtons();
    attachExcerptCounter();
    attachMediaButtons();

    // ensure editors synced on form submit (in case other submit methods)
    const form = document.getElementById('post_form');
    if(form){
      form.addEventListener('submit', function(){ syncEditorsToTextarea(); }, true);
    }
  });

})();
