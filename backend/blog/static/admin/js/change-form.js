// backend/blog/static/admin/js/change-form.js
(function(){
  'use strict';
  function qs(s){ return document.querySelector(s); }
  function qsa(s){ return Array.from(document.querySelectorAll(s)); }

  function getCSRF(){
    var m = document.cookie.match(/csrftoken=([^;]+)/);
    if (m) return m[1];
    var el = document.querySelector('input[name="csrfmiddlewaretoken"]');
    return el ? el.value : '';
  }

  function findField(names){
    for (var i=0;i<names.length;i++){
      var sel = '#'+names[i];
      var el = document.querySelector(sel);
      if (el) return el;
      el = document.querySelector('input[name="'+names[i]+'"], textarea[name="'+names[i]+'"], select[name="'+names[i]+'"]');
      if (el) return el;
    }
    return null;
  }

  function slugify(text){
    return (text||'').toString().normalize('NFKD').replace(/[\u0300-\u036f]/g,'')
      .replace(/[^\w\s-]/g,'').trim().replace(/\s+/g,'-').replace(/-+/g,'-').toLowerCase().slice(0,100);
  }

  // Upload adapter for CKEditor
  function CKAdapter(loader){
    this.loader = loader;
  }
  CKAdapter.prototype.upload = function(){
    var loader = this.loader;
    return loader.file.then(function(file){
      return new Promise(function(resolve, reject){
        var fd = new FormData();
        fd.append('file', file);
        var xhr = new XMLHttpRequest();
        xhr.open('POST', '/admin/media-library/', true);
        xhr.setRequestHeader('X-Requested-With','XMLHttpRequest');
        var csrftoken = getCSRF();
        if (csrftoken) xhr.setRequestHeader('X-CSRFToken', csrftoken);
        xhr.onreadystatechange = function(){
          if (xhr.readyState !== 4) return;
          if (xhr.status >= 200 && xhr.status < 300){
            try {
              var r = JSON.parse(xhr.responseText);
              if (r && r.success && r.attachment && r.attachment.url) {
                resolve({ default: r.attachment.url });
              } else {
                reject(r && r.message ? r.message : 'Invalid upload response');
              }
            } catch(e){
              reject('Invalid JSON response');
            }
          } else {
            reject('Upload failed: ' + xhr.status);
          }
        };
        xhr.onerror = function(){ reject('Upload network error'); };
        xhr.send(fd);
      });
    });
  };
  CKAdapter.prototype.abort = function(){};

  function MyUploadPlugin(editor){
    editor.plugins.get('FileRepository').createUploadAdapter = function(loader){
      return new CKAdapter(loader);
    };
  }

  function initCKEditorIfAvailable() {
    var textarea = findField(['id_content','content']);
    if (!textarea) return Promise.resolve(null);
    if (window.ClassicEditor) {
      return ClassicEditor.create(textarea, {
        extraPlugins: [ MyUploadPlugin ],
        toolbar: ['heading','|','bold','italic','link','bulletedList','numberedList','blockQuote','insertTable','imageUpload','undo','redo']
      }).then(ed => { window.__pt_editor = ed; return ed; })
        .catch(e => { console.error('CKEditor init error', e); return null; });
    } else {
      // Try to dynamically load CDN script and initialize
      return new Promise(function(resolve){
        var script = document.createElement('script');
        script.src = 'https://cdn.ckeditor.com/ckeditor5/40.2.0/classic/ckeditor.js';
        script.onload = function(){
          try {
            ClassicEditor.create(textarea, {
              extraPlugins: [ MyUploadPlugin ],
              toolbar: ['heading','|','bold','italic','link','bulletedList','numberedList','blockQuote','insertTable','imageUpload','undo','redo']
            }).then(ed => { window.__pt_editor = ed; resolve(ed); }).catch(function(e){ console.error(e); resolve(null); });
          } catch(e){ console.error(e); resolve(null); }
        };
        script.onerror = function(){ console.warn('CKEditor CDN failed to load'); resolve(null); };
        document.head.appendChild(script);
      });
    }
  }

  // UI: robust bindings for multiple possible ids/names
  function initUI(){
    // title and slug
    var title = findField(['id_title','title']);
    var slug = findField(['id_slug','slug']);
    var genBtn = qs('#pt-gen-slug') || qs('#generate-slug') || qs('[data-action="gen-slug"]');
    if (genBtn && title && slug){
      genBtn.addEventListener('click', function(){
        slug.value = slugify(title.value || title.textContent || '');
        showNotification('Slug сгенерирован', 'success');
      });
      title.addEventListener('blur', function(){ if (!slug.value.trim()) slug.value = slugify(title.value || title.textContent || ''); });
    }

    // excerpt counter
    var excerpt = findField(['id_excerpt','excerpt']);
    var exCounter = qs('#pt-excerpt-count') || qs('#excerpt-counter');
    if (excerpt && exCounter){
      function upd(){ var l = (excerpt.value||'').length; exCounter.textContent = l; exCounter.style.color = l>320?'#ef4444':(l>288?'#f59e0b':'' ); }
      excerpt.addEventListener('input', upd); upd();
    }

    // meta desc counter
    var metaDesc = findField(['id_meta_description','meta_description']);
    var metaCnt = qs('#pt-meta-count') || qs('#meta-count');
    if (metaDesc && metaCnt){
      function upm(){ var l = (metaDesc.value||'').length; metaCnt.textContent = l; metaCnt.style.color = l>160?'#ef4444':(l>144?'#f59e0b':''); }
      metaDesc.addEventListener('input', upm); upm();
    }

    // fill SEO button
    var fillBtn = qs('#pt-fill-seo') || qs('#fill-meta') || qs('[data-action="fill-seo"]');
    if (fillBtn){
      fillBtn.addEventListener('click', function(){
        var t = title ? (title.value || title.textContent || '') : '';
        var ex = excerpt ? (excerpt.value || '') : '';
        var mt = findField(['id_meta_title','meta_title']);
        var md = findField(['id_meta_description','meta_description']);
        if (mt && !mt.value && t) mt.value = t;
        if (md && !md.value && ex) md.value = ex.substring(0,160);
        showNotification('SEO заполнено', 'success');
      });
    }

    // preview button (if any)
    var previewBtn = qs('#preview-btn');
    if (previewBtn){
      previewBtn.addEventListener('click', function(){
        if (window.__pt_post_preview) window.open(window.__pt_post_preview,'_blank'); else showNotification('Сохраните пост для предпросмотра','warning');
      });
    }

    // prevent double submit
    var form = qs('#post_form');
    if (form){
      form.addEventListener('submit', function(e){
        var requiredTitle = title;
        if (requiredTitle && !(requiredTitle.value||'').trim()){
          e.preventDefault();
          showNotification('Заголовок обязателен','error');
          requiredTitle.focus();
          return false;
        }
        var submit = form.querySelector('button[type="submit"], input[type="submit"]');
        if (submit) submit.disabled = true;
      });
    }
  }

  // small notification function
  function showNotification(text,type='info',time=3000){
    try {
      var ex = document.querySelector('.pt-notify');
      if (ex) ex.remove();
      var el = document.createElement('div');
      el.className = 'pt-notify';
      el.style.cssText = 'position:fixed;top:18px;right:18px;background:#fff;padding:10px 12px;border-radius:8px;box-shadow:0 8px 22px rgba(2,6,23,0.12);z-index:99999;font-weight:700';
      el.textContent = text;
      document.body.appendChild(el);
      setTimeout(()=>el.remove(),time);
    } catch(e){ console.warn('notify',e); }
  }

  document.addEventListener('DOMContentLoaded', function(){
    initCKEditorIfAvailable().then(function(){ initUI(); });
  });

})();
