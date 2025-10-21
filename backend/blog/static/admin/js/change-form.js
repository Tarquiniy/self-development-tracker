// backend/blog/static/admin/js/change-form.js
(function(){
  'use strict';
  function qs(sel){ return document.querySelector(sel); }
  function qsa(sel){ return Array.from(document.querySelectorAll(sel)); }

  function getCSRF() {
    var cookie = document.cookie.match(/csrftoken=([^;]+)/);
    if (cookie) return cookie[1];
    var el = document.querySelector('input[name="csrfmiddlewaretoken"]');
    return el ? el.value : '';
  }

  function slugify(text){
    return (text||'').toString().normalize('NFKD').replace(/[\u0300-\u036f]/g,'')
      .replace(/[^\w\s-]/g,'').trim().replace(/\s+/g,'-').replace(/-+/g,'-').toLowerCase().slice(0,100);
  }

  // CKEditor upload adapter for /admin/media-library/
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
        xhr.setRequestHeader('X-Requested-With', 'XMLHttpRequest');
        var csrftoken = getCSRF();
        if (csrftoken) xhr.setRequestHeader('X-CSRFToken', csrftoken);

        xhr.onload = function(){
          if (xhr.status >= 200 && xhr.status < 300) {
            try {
              var r = JSON.parse(xhr.responseText);
              if (r && r.success && r.attachment && r.attachment.url) {
                resolve({ default: r.attachment.url });
              } else {
                reject(r && r.message ? r.message : 'Upload error');
              }
            } catch(e){ reject('Invalid response'); }
          } else { reject('Upload failed: ' + xhr.status); }
        };
        xhr.onerror = function(){ reject('Network error'); };
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

  // Init editor safely
  function initEditor(){
    var textarea = qs('#id_content') || qs('textarea[name="content"]');
    if (!textarea) return;
    if (window.ClassicEditor) {
      ClassicEditor.create(textarea, {
        extraPlugins: [ MyUploadPlugin ],
        toolbar: ['heading','|','bold','italic','link','bulletedList','numberedList','blockQuote','insertTable','imageUpload','undo','redo']
      }).then(function(editor){ window.__pt_editor = editor; }).catch(function(e){ console.error(e); });
    }
  }

  // UI: slug, counters, seo fill
  function initUI(){
    var title = qs('#id_title');
    var slug = qs('#id_slug');
    var gen = qs('#pt-gen-slug');
    if (gen && title && slug){
      gen.addEventListener('click', function(){ slug.value = slugify(title.value || ''); });
      title.addEventListener('blur', function(){ if (!slug.value.trim()) slug.value = slugify(title.value || ''); });
    }

    var excerpt = qs('#id_excerpt');
    var exCount = qs('#pt-excerpt-count');
    if (excerpt && exCount){
      var MAX=320;
      function upd(){ exCount.textContent = (excerpt.value||'').length; exCount.style.color = (excerpt.value.length>MAX)?'#ef4444':((excerpt.value.length>MAX*0.9)?'#f59e0b':''); }
      excerpt.addEventListener('input', upd); upd();
    }

    var metaDesc = qs('#id_meta_description');
    var metaCount = qs('#pt-meta-count');
    if (metaDesc && metaCount){
      var MMAX=160;
      function upm(){ metaCount.textContent = (metaDesc.value||'').length; metaCount.style.color = (metaDesc.value.length>MMAX)?'#ef4444':((metaDesc.value.length>MMAX*0.9)?'#f59e0b':''); }
      metaDesc.addEventListener('input', upm); upm();
    }

    var fill = qs('#pt-fill-seo');
    if (fill){
      fill.addEventListener('click', function(){
        var t = title ? title.value.trim() : '';
        var ex = excerpt ? excerpt.value.trim() : '';
        var mtitle = qs('#id_meta_title');
        var mdesc = qs('#id_meta_description');
        if (mtitle && !mtitle.value && t) mtitle.value = t;
        if (mdesc && !mdesc.value && ex) mdesc.value = ex.substring(0,160);
        alert('SEO: заполнено');
      });
    }

    // prevent double submit
    var form = qs('#post_form');
    if (form){
      form.addEventListener('submit', function(){
        var but = form.querySelector('button[type="submit"], input[type="submit"]');
        if (but) but.disabled = true;
      });
    }
  }

  document.addEventListener('DOMContentLoaded', function(){
    try { initEditor(); } catch(e){ console.warn('editor init error', e); }
    try { initUI(); } catch(e){ console.warn('ui init error', e); }
  });
})();
