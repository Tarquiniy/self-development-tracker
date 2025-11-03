// static/admin/js/ckeditor_restore.js
(function () {
  if (typeof window === 'undefined') return;
  if (window._ckeditor_restore_loaded) return;
  window._ckeditor_restore_loaded = true;

  const CDN = 'https://cdn.jsdelivr.net/npm/@ckeditor/ckeditor5-build-classic@47.0.0/build/ckeditor.js';
  const TARGET_NAMES = ['content','short_description','excerpt','body','description'];

  function findTextareas(){
    const res = [];
    TARGET_NAMES.forEach(n=>{
      const el = document.querySelector('textarea[name="'+n+'"]');
      if(el) res.push(el);
    });
    document.querySelectorAll('textarea.admin-ckeditor').forEach(e => { if(!res.includes(e)) res.push(e); });
    if(res.length === 0){
      const f = document.querySelector('textarea');
      if(f) res.push(f);
    }
    return res;
  }

  function initEditorOn(ta){
    if(!ta || ta._ckeditor_inited) return;
    ta._ckeditor_inited = true;
    const cfg = {
      language: 'ru',
      toolbar: [
        'heading','|','bold','italic','underline','strikethrough','|',
        'link','bulletedList','numberedList','blockQuote','|',
        'fontFamily','fontSize','fontColor','fontBackgroundColor','highlight','|',
        'insertTable','imageUpload','mediaEmbed','|','undo','redo'
      ],
      image: { toolbar: ['imageTextAlternative'] }
    };
    try {
      window.ClassicEditor.create(ta, cfg)
      .then(editor=>{
        const form = ta.closest('form');
        if(form){
          form.addEventListener('submit', function(){
            try { ta.value = editor.getData(); } catch(e){ console.warn(e); }
          }, true);
        }
        console.log('CKEditor initialized for', ta.name || ta);
      })
      .catch(err=>{
        console.error('CKEditor init failed for', ta, err);
        ta._ckeditor_inited = false;
      });
    } catch(e){
      console.error('ClassicEditor.create threw', e);
      ta._ckeditor_inited = false;
    }
  }

  function initAll(){
    const tas = findTextareas();
    tas.forEach(initEditorOn);
  }

  if(window.ClassicEditor){
    setTimeout(initAll, 50);
    return;
  }

  if(window._ckeditor_restore_loadingPromise){
    window._ckeditor_restore_loadingPromise.then(initAll).catch(console.error);
    return;
  }

  window._ckeditor_restore_loadingPromise = new Promise(function(resolve,reject){
    const s = document.createElement('script');
    s.src = CDN;
    s.defer = true;
    s.onload = function(){ resolve(); setTimeout(initAll, 50); };
    s.onerror = function(){ reject(new Error('Failed to load CKEditor from CDN')); };
    (document.head || document.documentElement).appendChild(s);
  });

  window._ckeditor_restore_loadingPromise.catch(function(e){ console.error(e); });

})();
