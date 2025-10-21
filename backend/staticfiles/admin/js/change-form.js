// backend/blog/static/admin/js/change-form.js
// Global initializer for post change form
(function(){
  'use strict';

  // Expose init marker so inline fallback doesn't double-init
  window.__pt_changeform_init = true;

  function qs(sel){ return document.querySelector(sel); }
  function qsa(sel){ return Array.from(document.querySelectorAll(sel)); }

  // CSRF helper (Django)
  function getCSRF(){
    var cookieMatch = document.cookie.match(/csrftoken=([^;]*)/);
    return cookieMatch ? cookieMatch[1] : (document.querySelector('input[name="csrfmiddlewaretoken"]') ? document.querySelector('input[name="csrfmiddlewaretoken"]').value : '');
  }

  // Slug generator
  function generateSlug(text){
    return text.toString().toLowerCase().normalize('NFKD').replace(/[\u0300-\u036f]/g,'')
      .replace(/[^\w\s-]/g,'').trim().replace(/\s+/g,'-').replace(/-+/g,'-').slice(0,100);
  }

  // Upload adapter for CKEditor using /admin/media-library/ endpoint
  function CKUploadAdapter(loader){
    this.loader = loader;
  }
  CKUploadAdapter.prototype.upload = function(){
    var loader = this.loader;
    return loader.file.then(function(file){
      return new Promise(function(resolve, reject){
        var url = '/admin/media-library/';
        var data = new FormData();
        data.append('file', file);
        var xhr = new XMLHttpRequest();
        xhr.open('POST', url, true);
        xhr.setRequestHeader('X-Requested-With', 'XMLHttpRequest');
        var csrftoken = getCSRF();
        if (csrftoken) xhr.setRequestHeader('X-CSRFToken', csrftoken);

        xhr.onload = function(){
          if (xhr.status >= 200 && xhr.status < 300){
            try {
              var resp = JSON.parse(xhr.responseText);
              if (resp && resp.success && resp.attachment && resp.attachment.url){
                resolve({ default: resp.attachment.url });
              } else {
                reject((resp && resp.error) ? resp.error : 'Upload failed');
              }
            } catch(e){
              reject('Invalid server response');
            }
          } else {
            reject('Upload failed with status ' + xhr.status);
          }
        };
        xhr.onerror = function(){ reject('Network error'); };
        xhr.send(data);
      });
    });
  };
  CKUploadAdapter.prototype.abort = function(){ /* noop */ };

  // Plugin to integrate adapter
  function MyCustomUploadAdapterPlugin(editor){
    editor.plugins.get('FileRepository').createUploadAdapter = function(loader){
      return new CKUploadAdapter(loader);
    };
  }

  // Initialize CKEditor on #id_content or textarea[name="content"]
  function initEditor(){
    var el = qs('#id_content') || qs('textarea[name="content"]');
    if (!el) return Promise.resolve(null);

    // If ClassicEditor available (CDN), use it
    if (window.ClassicEditor){
      return ClassicEditor.create(el, {
        extraPlugins: [ MyCustomUploadAdapterPlugin ],
        toolbar: {
          items: [
            'heading','|',
            'bold','italic','link','bulletedList','numberedList','blockQuote','|',
            'insertTable','imageUpload','mediaEmbed','|',
            'undo','redo'
          ]
        },
        image: {
          toolbar: ['imageTextAlternative','imageStyle:full','imageStyle:side']
        },
        table: {
          contentToolbar: ['tableColumn','tableRow','mergeTableCells']
        }
      }).then(editorInstance=>{
        window.__pt_editor = editorInstance;
        return editorInstance;
      }).catch(err=>{
        console.error('CKEditor init error', err);
        return null;
      });
    } else {
      return Promise.resolve(null);
    }
  }

  // Init counters and UI
  function initUI(){
    // Slug generation
    var genBtn = qs('#pt-generate-slug');
    var titleField = qs('#id_title') || qs('input[name="title"]');
    var slugField = qs('#id_slug') || qs('input[name="slug"]');

    if (genBtn && titleField && slugField){
      genBtn.addEventListener('click', function(){
        var t = titleField.value.trim();
        if (!t){ alert('Введите заголовок'); return; }
        slugField.value = generateSlug(t);
      });
      // autopopulate slug on blur if empty
      titleField.addEventListener('blur', function(){
        if (slugField && !slugField.value.trim()){
          slugField.value = generateSlug(this.value.trim());
        }
      });
    }

    // excerpt counter
    var excerpt = qs('#id_excerpt, textarea[name="excerpt"]');
    var excerptCounter = qs('#pt-excerpt-count');
    if (excerpt && excerptCounter){
      var MAX = 320;
      function updateExcerpt(){
        var len = (excerpt.value||'').length;
        excerptCounter.textContent = len;
        excerptCounter.style.color = len > MAX ? '#ef4444' : (len > MAX*0.9 ? '#f59e0b' : '');
      }
      excerpt.addEventListener('input', updateExcerpt);
      updateExcerpt();
    }

    // meta description counter
    var metaDesc = qs('#id_meta_description');
    var metaDescCounter = qs('#pt-meta-desc-count');
    if (metaDesc && metaDescCounter){
      var MMAX = 160;
      function updateMeta(){
        var len = (metaDesc.value||'').length;
        metaDescCounter.textContent = len;
        metaDescCounter.style.color = len > MMAX ? '#ef4444' : (len > MMAX*0.9 ? '#f59e0b' : '');
      }
      metaDesc.addEventListener('input', updateMeta);
      updateMeta();
    }

    // fill SEO
    var fillBtn = qs('#pt-fill-seo');
    if (fillBtn){
      fillBtn.addEventListener('click', function(){
        var title = (titleField && titleField.value) || '';
        var excerptVal = (excerpt && excerpt.value) || '';
        var metaTitle = qs('#id_meta_title');
        var metaDescription = qs('#id_meta_description');
        if (metaTitle && !metaTitle.value && title) metaTitle.value = title;
        if (metaDescription && !metaDescription.value && excerptVal) metaDescription.value = excerptVal.substring(0,160);
        alert('SEO заполнено');
      });
    }

    // form submission: block double submit
    var form = qs('#post_form');
    if (form){
      form.addEventListener('submit', function(e){
        var btn = form.querySelector('button[type="submit"], input[type="submit"]');
        if (btn) btn.disabled = true;
      });
    }

    // preview button: open absolute url if present in template (original.get_absolute_url)
    var previewBtn = qs('#preview-btn');
    if (previewBtn){
      previewBtn.addEventListener('click', function(){
        if (window.__post_preview_url){
          window.open(window.__post_preview_url, '_blank');
        } else {
          alert('Сохраните запись, чтобы посмотреть предпросмотр');
        }
      });
    }
  }

  document.addEventListener('DOMContentLoaded', function(){
    initEditor().then(()=>{
      initUI();
    });
  });

})();
