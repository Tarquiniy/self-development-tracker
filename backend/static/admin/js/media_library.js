// backend/blog/static/admin/js/media_library.js
// Aggressive attach + debug logging version
(function(){
  function $(sel, ctx){ return (ctx || document).querySelector(sel); }
  function $all(sel, ctx){ return Array.from((ctx || document).querySelectorAll(sel)); }

  const fileInput = document.getElementById('media-file-input');
  const visibleFileInput = document.getElementById('upload-file-visible');
  const uploadForm = document.getElementById('upload-form');
  const uploadStatus = document.getElementById('upload-status');
  const grid = document.getElementById('media-grid');

  // Try several attach endpoints (fallback list)
  const ATTACH_ENDPOINTS = [
    '/admin/media-attach/',
    '/admin/media/attach/',
    '/blog/media/attach/',
  ];

  function csrf() {
    const match = document.cookie.match(/(^|;)\s*csrftoken=([^;]+)/);
    return match ? decodeURIComponent(match[2]) : '';
  }

  function showStatus(text, isError){
    if(!uploadStatus){
      // fallback: console
      console.warn('uploadStatus element missing —', text);
      return;
    }
    uploadStatus.textContent = text || '';
    uploadStatus.classList.toggle('error', !!isError);
    if(!text) return;
    setTimeout(()=>{ uploadStatus.textContent = ''; uploadStatus.classList.remove('error'); }, 4500);
  }

  function getQueryParams(){
    try{ return new URLSearchParams(window.location.search); }catch(e){ return new URLSearchParams(); }
  }
  const q = getQueryParams();
  const attachTo = q.get('attach_to'); // 'post' or null
  const attachPostId = q.get('post_id');
  const attachField = q.get('field') || 'featured_image';

  console.debug('[media_library] init', { attachTo, attachPostId, attachField });

  function tempId() { return 't' + Date.now().toString(36) + Math.random().toString(36).slice(2,6); }
  function escapeHtml(s){ if(!s) return ''; return s.replace(/[&<>"']/g, function(m){ return ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'})[m]; }); }
  function truncate(s,n){ return s && s.length>n ? s.slice(0,n-1)+'…' : s||''; }

  function prependAttachmentToGrid(item, opts){
    if(!grid) return null;
    opts = opts || {};
    const isTemp = !!opts.tempId;
    const card = document.createElement('div');
    card.className = 'media-card';
    if(isTemp) card.dataset.tempId = opts.tempId;
    else if(item && item.id) card.dataset.id = item.id;

    const previewSrc = item && item._previewSrc;
    const imgSrc = previewSrc || item.url || (item.id ? `/admin/media-thumbnail/${item.id}/` : '');
    const escapedUrl = escapeHtml(item.url || '');
    const escapedTitle = escapeHtml(truncate(item.title || '', 28));
    const thumbHtml = imgSrc ? `<img src="${imgSrc}" alt="${escapedTitle}" loading="lazy" />` : '<div class="media-icon"></div>';
    card.innerHTML = `<div class="media-thumb">${thumbHtml}</div>
      <div class="media-meta">
        <div class="media-title" title="${escapedTitle}">${escapedTitle}</div>
        <div class="media-actions">
          ${ item.url ? `<a class="btn btn-small btn-copy" href="${escapedUrl}" target="_blank" rel="noopener noreferrer">Открыть</a>` : '' }
          <button class="btn btn-small btn-insert" data-url="${escapedUrl}">Вставить</button>
          <button class="btn btn-small btn-delete" data-id="${escapeHtml(item.id || '')}" data-temp-id="${isTemp ? opts.tempId : ''}">Удалить</button>
        </div>
      </div>`;
    grid.insertBefore(card, grid.firstChild);
    attachCardHandlers(card);
    return card;
  }

  function updateTempCardWithServerData(tempId, serverData){
    if(!grid) return;
    const card = grid.querySelector(`[data-temp-id="${CSS.escape(tempId)}"]`);
    if(!card) return;
    if(serverData.id) card.dataset.id = serverData.id;
    const img = card.querySelector('.media-thumb img');
    const newSrc = serverData.url || (serverData.id ? `/admin/media-thumbnail/${serverData.id}/` : '');
    if(img && newSrc){
      try { if(img.src && img.src.startsWith('blob:')) URL.revokeObjectURL(img.src); }catch(e){}
      img.src = newSrc;
    }
    const openLink = card.querySelector('.btn-copy');
    if(serverData.url){
      if(openLink) openLink.href = serverData.url;
      else {
        const actions = card.querySelector('.media-actions');
        const a = document.createElement('a'); a.className='btn btn-small btn-copy'; a.href=serverData.url; a.target="_blank"; a.rel="noopener noreferrer"; a.textContent="Открыть";
        actions.insertBefore(a, actions.firstChild);
      }
    }
    card.removeAttribute('data-temp-id');
    const delBtn = card.querySelector('.btn-delete');
    if(delBtn && serverData.id){ delBtn.dataset.id = serverData.id; delBtn.removeAttribute('data-temp-id'); }
  }

  function removeCardByIdentifier({id, tempId}){
    const selector = tempId ? `[data-temp-id="${CSS.escape(tempId)}"]` : `[data-id="${CSS.escape(id)}"]`;
    const card = grid.querySelector(selector);
    if(card && card.parentNode) card.parentNode.removeChild(card);
  }

  async function uploadFile(file, tempCardId){
    if(!file) return;
    const fd = new FormData(); fd.append('file', file);
    showStatus('Загрузка...');
    try{
      const res = await fetch(window.location.pathname, { method:'POST', body:fd, credentials:'same-origin', headers:{ 'X-CSRFToken': csrf() }});
      const data = await res.json().catch(()=>({success:false}));
      console.debug('[media_library] upload response', data);
      if(!res.ok || !data.success){ showStatus('Ошибка при загрузке', true); console.error('upload failed', data); return; }
      updateTempCardWithServerData(tempCardId, data); showStatus('Загружено');
    }catch(e){ console.error(e); showStatus('Ошибка при загрузке', true); }
  }

  async function tryAttachToPost(endpointList, attachmentId){
    for(const ep of endpointList){
      try{
        const payload = { post_id: attachPostId, attachment_id: attachmentId, field: attachField };
        const res = await fetch(ep, { method:'POST', credentials:'same-origin', headers:{ 'Content-Type':'application/json','X-CSRFToken':csrf() }, body: JSON.stringify(payload) });
        const data = await res.json().catch(()=>null);
        console.debug('[media_library] attach try', ep, res.status, data);
        if(res.ok && data && data.success) return data;
      }catch(e){ console.warn('attach endpoint failed', ep, e); }
    }
    return null;
  }

  async function deleteAttachment(id, cardEl){
    if(!confirm('Удалить файл?')) return;
    const fd = new FormData(); fd.append('action','delete'); fd.append('id', id);
    try{
      const res = await fetch(window.location.pathname, { method:'POST', body:fd, credentials:'same-origin', headers:{ 'X-CSRFToken': csrf() }});
      const data = await res.json();
      if(res.ok && data.success){ if(cardEl && cardEl.parentNode) cardEl.parentNode.removeChild(cardEl); showStatus('Удалено'); }
      else { showStatus('Ошибка при удалении', true); }
    }catch(e){ console.error(e); showStatus('Ошибка при удалении', true); }
  }

  // Fetch server list of attachments (absolute admin path) and return array
  async function fetchAttachmentsList(){
    try{
      const listUrl = '/admin/media-library/?format=json';
      const res = await fetch(listUrl, { credentials:'same-origin', headers: {'X-Requested-With':'XMLHttpRequest'} });
      if(!res.ok) { console.warn('[media_library] attachments list failed', res.status); return []; }
      const payload = await res.json().catch(()=>({attachments:[]}));
      console.debug('[media_library] attachments list', payload);
      return payload.attachments || [];
    }catch(e){ console.warn('fetchAttachmentsList error', e); return []; }
  }

  async function resolveAttachmentIdByUrl(url){
    if(!url) return null;
    try{
      const attachments = await fetchAttachmentsList();
      for(const a of attachments){
        if(!a) continue;
        if(a.url && a.url === url) return a.id;
      }
      const target = url.split('/').pop();
      if(target){
        for(const a of attachments){
          if(a.url && a.url.split('/').pop() === target) return a.id;
          if(a.title && a.title.split('/').pop() === target) return a.id;
        }
      }
      // as a last resort try case-insensitive includes
      for(const a of attachments){
        if(a.url && url && a.url.toLowerCase().includes(target.toLowerCase())) return a.id;
        if(a.title && target && a.title.toLowerCase().includes(target.toLowerCase())) return a.id;
      }
      return null;
    }catch(e){ console.error('resolveAttachmentIdByUrl error', e); return null; }
  }

  function attachCardHandlers(card){
    const del = card.querySelector('.btn-delete');
    if(del) del.addEventListener('click', (e)=>{
      const temp = del.dataset.tempId; const id = del.dataset.id;
      if(temp){ removeCardByIdentifier({tempId: temp}); return; }
      const cardEl = del.closest('.media-card'); deleteAttachment(id, cardEl);
    });
    const ins = card.querySelector('.btn-insert');
    if(ins) ins.addEventListener('click', async (e)=>{
      const cardEl = ins.closest('.media-card');
      const attachmentId = (cardEl && cardEl.dataset && cardEl.dataset.id) ? cardEl.dataset.id : null;
      const tempId = cardEl && cardEl.dataset ? cardEl.dataset.tempId : null;
      const url = ins.dataset.url || (cardEl.querySelector('.media-thumb img') && cardEl.querySelector('.media-thumb img').src) || '';
      console.debug('[media_library] insert clicked', { attachmentId, tempId, url, attachTo, attachPostId });

      if(attachTo === 'post' && attachPostId){
        if(tempId && !attachmentId){
          showStatus('Файл ещё загружается — подождите, затем нажмите снова', true);
          return;
        }

        let usedId = attachmentId || null;
        if(!usedId && url){
          showStatus('Поиск файла на сервере...');
          usedId = await resolveAttachmentIdByUrl(url);
          console.debug('[media_library] resolved id by url ->', usedId);
        }

        if(usedId){
          showStatus('Привязка изображения...');
          const result = await tryAttachToPost(ATTACH_ENDPOINTS, usedId);
          if(result){
            try {
              window.opener.postMessage({
                type: 'media-library-selected',
                kind: 'attachment-attached',
                field: attachField,
                post_id: attachPostId,
                attachment_id: result.attachment_id || result.id,
                url: result.url || url
              }, '*');
            } catch (e){ console.warn('postMessage failed', e); }
            showStatus('Изображение привязано');
            try { window.close(); } catch(e){}
            return;
          } else {
            showStatus('Не удалось привязать — сервер вернул ошибку', true);
            return;
          }
        }

        // if still no id
        console.warn('[media_library] no attachment id found for url', url);
        showStatus('Не удалось найти id файла на сервере. Проверьте, завершилась ли загрузка и обновите страницу медиатеки.', true);
        return;
      }

      // default behavior: copy URL to clipboard
      if(window.opener && typeof window.opener.insertMedia === 'function'){
        window.opener.insertMedia(url);
      } else {
        navigator.clipboard && navigator.clipboard.writeText(url).then(()=> showStatus('Ссылка скопирована в буфер'), ()=> showStatus('Не удалось скопировать', true));
      }
    });
  }

  document.addEventListener('DOMContentLoaded', function(){
    $all('.media-card').forEach(attachCardHandlers);

    if(fileInput){
      fileInput.addEventListener('change', function(e){
        const f = this.files && this.files[0];
        if(f){
          const tId = tempId(); const previewUrl = URL.createObjectURL(f);
          const previewItem = { title: f.name || 'file', url: '', _previewSrc: previewUrl };
          prependAttachmentToGrid(previewItem, { tempId: tId });
          uploadFile(f, tId);
        }
        this.value = '';
      });
    }
    if(visibleFileInput){
      visibleFileInput.addEventListener('change', function(e){
        const f = this.files && this.files[0];
        if(f){
          const tId = tempId(); const previewUrl = URL.createObjectURL(f);
          const previewItem = { title: f.name || 'file', url: '', _previewSrc: previewUrl };
          prependAttachmentToGrid(previewItem, { tempId: tId });
          uploadFile(f, tId);
        }
        this.value = '';
      });
    }

    if(uploadForm){
      uploadForm.addEventListener('submit', function(ev){
        const f = visibleFileInput && visibleFileInput.files && visibleFileInput.files[0];
        if(!f) { ev.preventDefault(); showStatus('Выберите файл для загрузки', true); return; }
        ev.preventDefault();
        const tId = tempId(); const previewUrl = URL.createObjectURL(f);
        const previewItem = { title: f.name || 'file', url: '', _previewSrc: previewUrl };
        prependAttachmentToGrid(previewItem, { tempId: tId });
        uploadFile(f, tId);
      });
    }

    const container = document.querySelector('.media-lib-container');
    if(container){
      container.addEventListener('dragover', (ev)=>{ ev.preventDefault(); container.classList.add('dragover'); });
      container.addEventListener('dragleave', (ev)=>{ container.classList.remove('dragover'); });
      container.addEventListener('drop', (ev)=>{ ev.preventDefault(); container.classList.remove('dragover'); const f = ev.dataTransfer.files && ev.dataTransfer.files[0]; if(f){
          const tId = tempId(); const previewUrl = URL.createObjectURL(f);
          const previewItem = { title: f.name || 'file', url: '', _previewSrc: previewUrl };
          prependAttachmentToGrid(previewItem, { tempId: tId });
          uploadFile(f, tId);
      } });
    }
  });
})();
