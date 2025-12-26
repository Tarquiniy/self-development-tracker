// admin/js/post_media_picker.js
(function(){
  const grid = document.getElementById('mp-grid');
  const loading = document.getElementById('mp-loading');
  const statusEl = document.getElementById('mp-status');
  const refreshBtn = document.getElementById('mp-refresh');
  const searchInput = document.getElementById('mp-search');
  const onlyMineCheckbox = document.getElementById('mp-show-uploaded-only');
  const pendingInput = document.getElementById('id_featured_image_url_pending');

  // helper
  function csrf(){ const m = document.cookie.match(/(^|;)\s*csrftoken=([^;]+)/); return m ? decodeURIComponent(m[2]) : ''; }
  function el(tag, cls){ const d = document.createElement(tag); if(cls) d.className = cls; return d; }

  // detect post id from URL (/admin/.../post/<id>/change/)
  function currentPostId(){
    const m = window.location.pathname.match(/\/(\d+)\/change\/$/);
    return m ? m[1] : null;
  }
  const postId = currentPostId();

  // render tile
  function makeTile(a){
    const tile = el('div','media-tile');
    tile.dataset.id = a.id;
    tile.dataset.url = a.url || '';
    const img = el('img');
    img.src = a.thumb || a.url || '';
    img.alt = a.title || '';
    const meta = el('div','meta');
    meta.textContent = a.title || (a.url || '').split('/').pop() || ('#'+(a.id||''));
    tile.appendChild(img);
    tile.appendChild(meta);
    tile.addEventListener('click', ()=>onSelect(a));
    return tile;
  }

  function showStatus(t){ if(statusEl) statusEl.textContent = t; }

  async function fetchAttachments(){
    loading && (loading.style.display = 'block');
    showStatus('Загружаю...');
    try{
      // endpoint supports format=json/XHR
      const url = window.location.pathname.replace(/\/$/, '') + '?format=json';
      const res = await fetch(url, { credentials: 'same-origin', headers: {'X-Requested-With':'XMLHttpRequest'} });
      if(!res.ok) throw new Error('fetch failed ' + res.status);
      const payload = await res.json();
      const attachments = payload.attachments || [];
      return attachments;
    }catch(e){
      console.error('fetchAttachments error', e);
      return [];
    } finally {
      loading && (loading.style.display = 'none');
      showStatus('');
    }
  }

  function filterList(list){
    const q = (searchInput.value || '').trim().toLowerCase();
    const mine = onlyMineCheckbox.checked;
    if(!q && !mine) return list;
    return list.filter(a=>{
      if(!a) return false;
      if(mine && a.uploaded_by && window.ADMIN_USER_ID){ // uploaded_by expected to be user id if present
        if(String(a.uploaded_by) !== String(window.ADMIN_USER_ID)) return false;
      }
      if(!q) return true;
      const title = (a.title || '').toLowerCase();
      const name = (a.url || '').split('/').pop().toLowerCase();
      return title.includes(q) || name.includes(q);
    });
  }

  // on select tile
  async function onSelect(a){
    if(!a) return;
    // if editing existing post — try to attach server-side via admin endpoint
    if(postId){
      showStatus('Привязываю изображение к посту...');
      try{
        const res = await fetch('/admin/media-attach/', {
          method: 'POST',
          credentials: 'same-origin',
          headers: {'Content-Type':'application/json','X-CSRFToken':csrf()},
          body: JSON.stringify({ post_id: postId, attachment_id: a.id, field: 'featured_image' })
        });
        const data = await res.json().catch(()=>null);
        if(res.ok && data && data.success){
          // update preview in the change form: try to set preview image element id_featured_image_preview or create one
          const preview = document.getElementById('id_featured_image_preview') || document.getElementById('featured_image_preview') || null;
          if(preview){
            preview.src = data.url || a.url || preview.src;
          } else {
            // try to insert next to form field
            const fld = document.getElementById('id_featured_image') || document.querySelector('.form-row.field-featured_image');
            if(fld && fld.parentNode){
              const img = document.createElement('img');
              img.id = 'id_featured_image_preview';
              img.className = 'featured-preview';
              img.src = data.url || a.url || '';
              fld.parentNode.appendChild(img);
            }
          }
          showStatus('Изображение привязано');
          return;
        } else {
          console.warn('attach failed', data);
          showStatus('Не удалось привязать: ' + (data && data.error ? data.error : 'ошибка'));
        }
      }catch(e){
        console.error('attach exception', e);
        showStatus('Ошибка привязки');
      }
      return;
    }

    // else (new post): set pending url hidden field and show preview
    pendingInput.value = a.url || '';
    // set preview image in the form
    const fld = document.getElementById('id_featured_image') || document.querySelector('.form-row.field-featured_image');
    if(fld && fld.parentNode){
      let img = document.getElementById('id_featured_image_preview');
      if(!img){
        img = document.createElement('img');
        img.id = 'id_featured_image_preview';
        img.className = 'featured-preview';
        fld.parentNode.appendChild(img);
      }
      img.src = a.url || '';
    }
    showStatus('Выбрано (на сохранение)');
  }

  // initial render
  async function loadAndRender(){
    grid.innerHTML = '';
    loading && (loading.style.display = 'block');
    const list = await fetchAttachments();
    if(!list || list.length === 0){
      grid.innerHTML = '<div class="picker-loading">Нет загруженных файлов</div>';
      return;
    }
    const filtered = filterList(list);
    if(filtered.length === 0){
      grid.innerHTML = '<div class="picker-loading">Ничего не найдено</div>';
      return;
    }
    filtered.forEach(a=>{
      const t = makeTileFor(a);
      grid.appendChild(t);
    });
  }

  function makeTileFor(a){
    const tile = document.createElement('div');
    tile.className = 'media-tile';
    tile.dataset.id = a.id;
    tile.dataset.url = a.url || '';
    const img = document.createElement('img');
    img.src = a.thumb || a.url || '';
    img.alt = a.title || '';
    const meta = document.createElement('div');
    meta.className = 'meta';
    meta.textContent = a.title || (a.url || '').split('/').pop() || ('#'+(a.id||''));
    tile.appendChild(img);
    tile.appendChild(meta);
    tile.addEventListener('click', ()=>onSelect(a));
    return tile;
  }

  // events
  refreshBtn && refreshBtn.addEventListener('click', ()=>{ loadAndRender(); });
  searchInput && searchInput.addEventListener('input', ()=>{ loadAndRender(); });
  onlyMineCheckbox && onlyMineCheckbox.addEventListener('change', ()=>{ loadAndRender(); });

  // initial load
  document.addEventListener('DOMContentLoaded', function(){
    // attempt to obtain admin user id (if available on page via global)
    try {
      // set window.ADMIN_USER_ID on server-side in template if you want enhanced filtering
    } catch(e){}
    loadAndRender();
  });
})();
