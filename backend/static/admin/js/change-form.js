// change-form.js - post editor features
(function(){
  function qs(sel) { return document.querySelector(sel); }
  function qsa(sel) { return Array.from(document.querySelectorAll(sel)); }

  // Safe wrappers
  function safe(fn){ try{ fn(); } catch(e){ console.error(e); } }

  document.addEventListener('DOMContentLoaded', function(){
    safe(initSlugGeneration);
    safe(initCKEditor);
    safe(initCharacterCounters);
    safe(initAutoSave);
    safe(initPreview);
    safe(initMediaModal);
    safe(initSEOTools);
    safe(initFormSubmitGuard);
  });

  // CKEditor init with fallback
  function initCKEditor(){
    const textarea = qs('textarea[name="content"]');
    if(!textarea) return;

    // If CKEDITOR global exists, initialize
    if(window.CKEDITOR && window.CKEDITOR.replace){
      try {
        const config = {
          extraPlugins: 'uploadimage,codesnippet,autogrow',
          removePlugins: 'stylesheetparser',
          autoGrow_maxHeight: 800,
          height: 420,
          toolbarGroups: [
            { name: 'clipboard', groups: [ 'clipboard', 'undo' ] },
            { name: 'basicstyles', groups: [ 'basicstyles', 'cleanup' ] },
            { name: 'paragraph', groups: [ 'list', 'indent', 'blocks', 'align' ] },
            { name: 'links' }, { name: 'insert' }, { name: 'styles' }, { name: 'tools' }
          ]
        };
        window.editorInstance = CKEDITOR.replace(textarea.id || 'id_content', config);

        // Ensure images uploaded via CKEditor go to /ckeditor/upload/ if django-ckeditor used.
        // If you use custom upload url, set config.filebrowserUploadUrl accordingly server-side.

      } catch(e){ console.warn('CKEditor init failed', e); textarea.style.display=''; }
    } else {
      // Fallback: simple contentEditable area that syncs to textarea
      textarea.style.display = 'none';
      const wrapper = document.createElement('div');
      wrapper.className = 'tiptap-editor-wrapper';
      const editorContainer = document.createElement('div');
      editorContainer.contentEditable = true;
      editorContainer.className = 'editor-fallback';
      editorContainer.style.minHeight = '220px';
      editorContainer.innerHTML = textarea.value || '';
      editorContainer.addEventListener('input', function(){ textarea.value = editorContainer.innerHTML; });
      textarea.parentNode.insertBefore(wrapper, textarea.nextSibling);
      wrapper.appendChild(editorContainer);
      console.info('CKEditor not found — using fallback editable div');
    }
  }

  // Slug generation
  function initSlugGeneration(){
    const title = qs('#id_title');
    const slug = qs('#id_slug');
    const genBtn = qs('#generate-slug');
    const preview = qs('#slug-preview');

    function makeSlug(s){
      return s.toLowerCase()
        .normalize('NFKD').replace(/[^\w\s-]/g,'')
        .trim().replace(/\s+/g,'-').replace(/--+/g,'-').substring(0,60);
    }
    if(title && slug){
      title.addEventListener('input', ()=> {
        if(!slug.value.trim()){
          const s = makeSlug(title.value||'');
          slug.value = s;
          if(preview) preview.textContent = s;
        } else {
          if(preview) preview.textContent = slug.value;
        }
      });
    }
    if(genBtn && title && slug){
      genBtn.addEventListener('click', ()=> {
        const s = makeSlug(title.value||'');
        slug.value = s; if(preview) preview.textContent = s;
        showToast('Slug сгенерирован', 'success');
      });
    }
  }

  // Character counters
  function initCharacterCounters(){
    const excerpt = qs('#id_excerpt');
    const metaTitle = qs('#id_meta_title');
    const metaDesc = qs('#id_meta_description');

    function bindCounter(el, counterId, max){
      if(!el) return;
      const c = qs('#' + counterId);
      function update(){ if(c) { c.textContent = el.value.length; c.parentElement.classList.toggle('error', el.value.length > max); } }
      el.addEventListener('input', update);
      update();
    }

    bindCounter(excerpt, 'excerpt-counter', 320);
    bindCounter(metaTitle, 'meta-title-counter', 70);
    bindCounter(metaDesc, 'meta-desc-counter', 160);
  }

  // Auto-save to localStorage and optional AJAX
  function initAutoSave(){
    const toggle = qs('#auto-save-toggle');
    const form = qs('#post_form');
    const keyPrefix = 'pt_autosave_';
    let enabled = true;
    const formId = (qs('[name="_save"]') ? window.location.pathname : 'new_post').replace(/\W+/g,'_');

    try {
      const saved = localStorage.getItem('pt_autosave_enabled');
      if(saved!==null) enabled = JSON.parse(saved);
    } catch(e){}

    function start(){
      if(!enabled) return;
      setInterval(()=> {
        if(!enabled) return;
        try {
          const data = {};
          qsa('input,textarea,select').forEach(i => {
            if(i.type === 'file') return;
            data[i.name] = i.value;
          });
          localStorage.setItem(keyPrefix + formId, JSON.stringify({ts:Date.now(), data}));
          // Optionally: do AJAX save to server: fetch('/admin/blog/draft-save/', {method:'POST', body: formData})
          console.log('Autosave -> localStorage');
        } catch(e){ console.warn(e); }
      }, 15000);
    }

    function stop(){ /* noop: toggling handled by enabled */ }

    if(toggle){
      toggle.textContent = enabled ? '💾 Вкл' : '⏸️ Выкл';
      toggle.addEventListener('click', ()=> {
        enabled = !enabled;
        localStorage.setItem('pt_autosave_enabled', JSON.stringify(enabled));
        toggle.textContent = enabled ? '💾 Вкл' : '⏸️ Выкл';
        showToast('Автосохранение ' + (enabled ? 'включено' : 'выключено'), 'success');
      });
    }
    // Try to restore if present
    try{
      const raw = localStorage.getItem(keyPrefix + formId);
      if(raw){
        const obj = JSON.parse(raw);
        if(confirm('Найдено автосохранение. Загрузить?')) {
          Object.entries(obj.data || {}).forEach(([k,v])=>{
            const el = qs('[name="'+k+'"]');
            if(el) el.value = v;
          });
          showToast('Автосохранение загружено', 'success');
        }
      }
    }catch(e){}
    start();
  }

  // Preview button
  function initPreview(){
    const btn = qs('#preview-btn');
    if(!btn) return;
    btn.addEventListener('click', function(){
      // If object has pk in URL => preview by id. If no pk => warn user.
      const match = window.location.pathname.match(/\/admin\/.+\/(\d+)\/change/);
      if(match && match[1]){
        const id = match[1];
        window.open('/posts/preview/' + id + '/', '_blank');
      } else {
        alert('Сохраните пост прежде чем просмотреть (или используйте "Сохранить и продолжить")');
      }
    });
  }

  // Simple SEO check & autofill
  function initSEOTools(){
    const fill = qs('#fill-meta');
    const check = qs('#check-seo');
    const title = qs('#id_title');
    const excerpt = qs('#id_excerpt');
    const metaT = qs('#id_meta_title');
    const metaD = qs('#id_meta_description');

    if(fill){
      fill.addEventListener('click', function(){
        if(title && metaT && !metaT.value.trim()) metaT.value = title.value.trim();
        if(excerpt && metaD && !metaD.value.trim()) metaD.value = excerpt.value.trim().substring(0,160);
        showToast('SEO данные заполнены', 'success');
      });
    }

    if(check){
      check.addEventListener('click', function(){
        const issues = [];
        if(!title || !title.value.trim()) issues.push('Заголовок не заполнен');
        if(metaT && metaT.value.length > 70) issues.push('Meta title длиннее 70 символов');
        if(metaD && metaD.value.length > 160) issues.push('Meta description длиннее 160 символов');
        if(issues.length) showToast('SEO: ' + issues.join('; '), 'error', 5000);
        else showToast('SEO проверка пройдена', 'success', 2500);
      });
    }
  }

  // Simple media modal
  function initMediaModal(){
    const openBtn = qs('#open-media-lib');
    const modal = qs('#pt-media-modal');
    if(!openBtn || !modal) return;
    openBtn.addEventListener('click', ()=> { modal.style.display='block'; });
    modal.addEventListener('click', (e)=>{
      if(e.target.dataset.close !== undefined || e.target.classList.contains('pt-close')) modal.style.display='none';
    });
    const uploadBtn = qs('#pt-upload-btn');
    const input = qs('#pt-upload-input');
    const grid = qs('#pt-media-grid');

    if(uploadBtn && input && grid){
      uploadBtn.addEventListener('click', async ()=>{
        if(!input.files.length) return showToast('Выберите файлы', 'error');
        const fd = new FormData();
        for(const f of input.files) fd.append('files', f);
        try {
          const res = await fetch('/admin/media/upload/', { method:'POST', body: fd });
          if(!res.ok) throw new Error('upload failed');
          const json = await res.json();
          renderGrid(json);
          showToast('Файлы загружены', 'success');
        } catch(e){ showToast('Ошибка загрузки', 'error'); console.error(e); }
      });
      function renderGrid(items){
        grid.innerHTML = '';
        (items || []).forEach(it=>{
          const d = document.createElement('div'); d.className='pt-med-item';
          d.style.margin='6px';
          d.innerHTML = `<img src="${it.url}" style="max-width:120px;max-height:80px;object-fit:cover"><div style="font-size:12px">${it.name}</div>`;
          d.addEventListener('click', ()=> {
            // insert into editor if CKEditor is present
            try {
              if(window.editorInstance && typeof window.editorInstance.insertHtml === 'function'){
                window.editorInstance.insertHtml(`<img src="${it.url}" alt="">`);
              } else if (window.CKEDITOR && window.CKEDITOR.instances){
                const inst = window.CKEDITOR.instances[Object.keys(window.CKEDITOR.instances)[0]];
                if(inst) inst.insertHtml(`<img src="${it.url}" alt="">`);
                else {
                  const ta = qs('textarea[name="content"]'); ta.value += `\n<img src="${it.url}" alt="">\n`;
                }
              } else {
                const ta = qs('textarea[name="content"]'); ta.value += `\n<img src="${it.url}" alt="">\n`;
              }
              modal.style.display='none';
            } catch(e){ console.error(e); alert('Вставка не удалась'); }
          });
          grid.appendChild(d);
        });
      }
    }
  }

  // Ensure title is present on submit
  function initFormSubmitGuard(){
    const form = qs('#post_form');
    if(!form) return;
    form.addEventListener('submit', function(e){
      const title = qs('#id_title');
      if(title && !title.value.trim()){
        e.preventDefault();
        alert('Заголовок обязателен');
        title.focus();
        return false;
      }
      // sync CKEditor to textarea if needed
      if(window.CKEDITOR && window.CKEDITOR.instances){
        for(const name in CKEDITOR.instances){
          CKEDITOR.instances[name].updateElement();
        }
      } else if(window.editorInstance && typeof window.editorInstance.getData === 'function'){
        const ta = qs('textarea[name="content"]');
        if(ta) ta.value = window.editorInstance.getData();
      }
      return true;
    }, {passive:false});
  }

})();
