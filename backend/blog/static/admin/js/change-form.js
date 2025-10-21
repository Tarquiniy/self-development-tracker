// backend/blog/static/admin/js/change-form.js
(function(){
  'use strict';

  // safety stub for grp to avoid 'grp is not defined'
  if (typeof window.grp === 'undefined') {
    window.grp = { jQuery: window.jQuery || null };
  }

  const qs = s => document.querySelector(s);
  const qsa = s => Array.from(document.querySelectorAll(s));

  function getCSRF() {
    const m = document.cookie.match(/csrftoken=([^;]+)/);
    if (m) return m[1];
    const el = document.querySelector('input[name="csrfmiddlewaretoken"]');
    return el ? el.value : '';
  }

  // Slug helper
  function slugify(text){
    return (text||'').toString().normalize('NFKD').replace(/[\u0300-\u036f]/g,'')
      .replace(/[^\w\s-]/g,'').trim().replace(/\s+/g,'-').replace(/-+/g,'-').toLowerCase().slice(0,120);
  }

  // CKEditor upload adapter -> uploads file to server endpoint which stores to Supabase
  function CKSupabaseAdapter(loader){
    this.loader = loader;
  }
  CKSupabaseAdapter.prototype.upload = function(){
    const loader = this.loader;
    return loader.file.then(file => new Promise((resolve, reject) => {
      const fd = new FormData();
      fd.append('file', file);
      const xhr = new XMLHttpRequest();
      xhr.open('POST', '/admin/supabase-upload/', true);
      xhr.setRequestHeader('X-Requested-With', 'XMLHttpRequest');
      const csrftoken = getCSRF();
      if (csrftoken) xhr.setRequestHeader('X-CSRFToken', csrftoken);
      xhr.onload = function(){
        if (xhr.status >= 200 && xhr.status < 300){
          try {
            const resp = JSON.parse(xhr.responseText);
            if (resp.success && resp.attachment && resp.attachment.url){
              resolve({ default: resp.attachment.url });
            } else {
              reject(resp.message || 'Upload failed');
            }
          } catch(e){
            reject('Invalid JSON from upload endpoint');
          }
        } else {
          reject('Upload failed: ' + xhr.status);
        }
      };
      xhr.onerror = () => reject('Network error');
      xhr.send(fd);
    }));
  };
  CKSupabaseAdapter.prototype.abort = function(){};

  function MyUploadPlugin(editor){
    editor.plugins.get('FileRepository').createUploadAdapter = function(loader){
      return new CKSupabaseAdapter(loader);
    };
  }

  // Initialize CKEditor for content and excerpt (if you want WYSIWYG also in excerpt)
  function initCKEditor() {
    const contentEl = qs('#id_content') || qs('textarea[name="content"]');
    const excerptEl = qs('#id_excerpt') || qs('textarea[name="excerpt"]');
    if (window.ClassicEditor && contentEl) {
      ClassicEditor.create(contentEl, {
        extraPlugins: [MyUploadPlugin],
        toolbar: ['heading','|','bold','italic','link','bulletedList','numberedList','blockQuote','insertTable','imageUpload','undo','redo']
      }).then(ed => window.__pt_editor = ed).catch(e => console.error('CK init err', e));
    }
    // Optional: small editor for excerpt (short HTML) - uncomment if desired
    // if (window.ClassicEditor && excerptEl) { ... }
  }

  // Media Library modal functions
  function openMediaModal(){
    const modal = qs('#pt-media-modal');
    if (!modal) return;
    modal.setAttribute('aria-hidden','false');
    loadMediaGrid();
  }
  function closeMediaModal(){
    const modal = qs('#pt-media-modal');
    if (!modal) return;
    modal.setAttribute('aria-hidden','true');
  }

  function loadMediaGrid(){
    const grid = qs('#pt-media-grid');
    if (!grid) return;
    grid.innerHTML = '<div style="padding:16px">Загрузка...</div>';
    fetch('/admin/supabase-attachments/').then(r => r.json()).then(data => {
      if (!data.success){ grid.innerHTML = '<div style="padding:16px;color:#b00">Ошибка загрузки</div>'; return; }
      const files = data.files || [];
      if (!files.length) { grid.innerHTML = '<div style="padding:16px">Пусто</div>'; return; }
      grid.innerHTML = '';
      files.forEach(f => {
        const el = document.createElement('div');
        el.className = 'pt-thumb';
        el.innerHTML = `<img src="${f.url}" alt="${f.name}" /><div style="font-size:12px;margin-top:6px;word-break:break-word">${f.name}</div><div style="margin-top:6px"><button class="pt-btn pt-insert" data-url="${f.url}">Вставить</button></div>`;
        grid.appendChild(el);
      });
      // attach handlers
      qsa('.pt-insert').forEach(b => b.addEventListener('click', function(){
        const url = this.getAttribute('data-url');
        // If CKEditor present, insert image; else copy to clipboard or fill featured image input if exists
        if (window.__pt_editor){
          window.__pt_editor.model.change( writer => {
            const imageElement = writer.createElement( 'image', { src: url } );
            window.__pt_editor.model.insertContent( imageElement, window.__pt_editor.model.document.selection );
          } );
        } else {
          // try to set featured image field
          const f = qs('#id_featured_image') || qs('input[name="featured_image"]');
          if (f) f.value = url;
        }
        closeMediaModal();
      }));
    }).catch(err => { console.error(err); grid.innerHTML = '<div style="padding:16px;color:#b00">Ошибка</div>'; });
  }

  function uploadFilesToServer(files){
    if (!files || !files.length) return;
    const fd = new FormData();
    // send first file only in CKEditor flow; our endpoint accepts 'file'
    // but we support multiple uploads sequentially
    const csrftoken = getCSRF();
    Array.from(files).forEach(f => {
      const xhr = new XMLHttpRequest();
      const localFd = new FormData();
      localFd.append('file', f);
      xhr.open('POST', '/admin/supabase-upload/', true);
      xhr.setRequestHeader('X-Requested-With','XMLHttpRequest');
      if (csrftoken) xhr.setRequestHeader('X-CSRFToken', csrftoken);
      xhr.onload = function(){
        if (xhr.status >=200 && xhr.status < 300){
          try {
            const resp = JSON.parse(xhr.responseText);
            if (resp.success && resp.attachment && resp.attachment.url){
              // after success reload grid (or insert)
              loadMediaGrid();
            } else {
              alert('Upload failed: ' + (resp.message || 'unknown'));
            }
          } catch(e){ console.error(e); }
        } else {
          console.error('Upload failed', xhr.status);
        }
      };
      xhr.onerror = function(){ console.error('Upload network error'); };
      xhr.send(localFd);
    });
  }

  // Small helpers: slug button, seo fill, counters, modal wired to buttons
  function initUI(){
    const gen = qs('#pt-gen-slug') || qs('#generate-slug');
    const title = qs('#id_title') || qs('input[name="title"]');
    const slug = qs('#id_slug') || qs('input[name="slug"]');
    if (gen && title && slug){
      gen.addEventListener('click', () => { slug.value = slugify(title.value || ''); });
      title.addEventListener('blur', () => { if (!slug.value.trim()) slug.value = slugify(title.value || ''); });
    }

    const excerpt = qs('#id_excerpt');
    const exCount = qs('#pt-excerpt-count') || qs('#excerpt-counter');
    if (excerpt && exCount){
      const MAX=320;
      function up(){ const l=(excerpt.value||'').length; exCount.textContent=l; exCount.style.color = l>MAX? '#ef4444': (l>MAX*0.9? '#f59e0b' : ''); }
      excerpt.addEventListener('input', up); up();
    }

    const metaDesc = qs('#id_meta_description');
    const metaCnt = qs('#pt-meta-count');
    if (metaDesc && metaCnt){
      const MAX=160;
      function upm(){ const l=(metaDesc.value||'').length; metaCnt.textContent = l; metaCnt.style.color = l>MAX? '#ef4444': (l>MAX*0.9? '#f59e0b' : ''); }
      metaDesc.addEventListener('input', upm); upm();
    }

    const fill = qs('#pt-fill-seo') || qs('#fill-meta');
    if (fill){
      fill.addEventListener('click', () => {
        const t = title ? (title.value||'') : '';
        const ex = excerpt ? (excerpt.value||'') : '';
        const mt = qs('#id_meta_title') || qs('input[name="meta_title"]');
        const md = qs('#id_meta_description') || qs('textarea[name="meta_description"]');
        if (mt && !mt.value && t) mt.value = t;
        if (md && !md.value && ex) md.value = ex.substring(0,160);
      });
    }

    // modal
    qsa('#open-media-lib, #open-media-lib-2').forEach(b => { if (b) b.addEventListener('click', openMediaModal); });
    const modal = qs('#pt-media-modal');
    if (modal){
      modal.addEventListener('click', e => {
        if (e.target && e.target.dataset && e.target.dataset.close !== undefined) closeMediaModal();
      });
      qs('#pt-upload-btn').addEventListener('click', () => {
        const input = qs('#pt-upload-input');
        if (input && input.files && input.files.length) uploadFilesToServer(input.files);
      });
      qs('#pt-upload-input').addEventListener('change', () => {
        // optionally auto upload on select
      });
    }

    // form protection
    const form = qs('#post_form');
    if (form){
      form.addEventListener('submit', e => {
        const t = title ? (title.value||'').trim() : '';
        if (!t) { e.preventDefault(); alert('Заголовок обязателен'); title && title.focus(); return false; }
        // disable buttons
        qsa('button[type="submit"]').forEach(b => b.disabled = true);
      });
    }
  }

  // Init flow
  document.addEventListener('DOMContentLoaded', () => {
    // try to init CKEditor, then UI
    if (window.ClassicEditor) {
      initCKEditor();
      initUI();
    } else {
      // load CKEditor script and then init
      const s = document.createElement('script');
      s.src = 'https://cdn.ckeditor.com/ckeditor5/40.2.0/classic/ckeditor.js';
      s.onload = () => { initCKEditor(); initUI(); };
      s.onerror = () => { console.warn('CKEditor CDN failed'); initUI(); };
      document.head.appendChild(s);
    }
  });

})();
