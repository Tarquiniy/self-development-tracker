// backend/blog/static/admin/js/media_library.js
// media_library.js — updated: immediate preview + attach fallback lookup when id missing
(function(){
  function $(sel, ctx){ return (ctx || document).querySelector(sel); }
  function $all(sel, ctx){ return Array.from((ctx || document).querySelectorAll(sel)); }

  const fileInput = document.getElementById('media-file-input');
  const visibleFileInput = document.getElementById('upload-file-visible');
  const uploadForm = document.getElementById('upload-form');
  const uploadStatus = document.getElementById('upload-status');
  const grid = document.getElementById('media-grid');

  // Endpoint used to attach an attachment to a post (admin-side)
  const ATTACH_ENDPOINT = '/admin/media-attach/';

  function csrf() {
    const match = document.cookie.match(/(^|;)\s*csrftoken=([^;]+)/);
    return match ? decodeURIComponent(match[2]) : '';
  }

  function showStatus(text, isError){
    if(!uploadStatus) return;
    uploadStatus.textContent = text || '';
    uploadStatus.classList.toggle('error', !!isError);
    if(!text) return;
    setTimeout(()=>{ uploadStatus.textContent = ''; uploadStatus.classList.remove('error'); }, 4500);
  }

  // Query params helper
  function getQueryParams(){
    try{ return new URLSearchParams(window.location.search); }catch(e){ return new URLSearchParams(); }
  }
  const q = getQueryParams();
  const attachTo = q.get('attach_to'); // 'post' or null
  const attachPostId = q.get('post_id');
  const attachField = q.get('field') || 'featured_image';

  // build a temporary unique id for preview cards
  function tempId() { return 't' + Date.now().toString(36) + Math.random().toString(36).slice(2,6); }

  function escapeHtml(s){
    if(!s) return '';
    return s.replace(/[&<>"']/g, function(m){ return ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'})[m]; });
  }
  function truncate(s,n){ return s && s.length>n ? s.slice(0,n-1)+'…' : s||''; }

  // create card and return element; if previewUrl provided, card is temporary and gets data-temp-id
  function prependAttachmentToGrid(item, opts){
    if(!grid) return null;
    opts = opts || {};
    const isTemp = !!opts.tempId;
    const card = document.createElement('div');
    card.className = 'media-card';
    if(isTemp) {
      card.dataset.tempId = opts.tempId;
    } else if (item && item.id) {
      card.dataset.id = item.id;
    }
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

  // update temporary card (identified by tempId) with server response (set proper data-id and real src)
  function updateTempCardWithServerData(tempId, serverData){
    if(!grid) return;
    const card = grid.querySelector(`[data-temp-id="${CSS.escape(tempId)}"]`);
    if(!card) return;
    if(serverData.id){
      card.dataset.id = serverData.id;
    }
    const img = card.querySelector('.media-thumb img');
    const newSrc = serverData.url || (serverData.id ? `/admin/media-thumbnail/${serverData.id}/` : '');
    if(img && newSrc){
      const oldSrc = img.src || '';
      try { if(oldSrc && oldSrc.startsWith('blob:')) URL.revokeObjectURL(oldSrc); } catch(e){}
      img.src = newSrc;
    }
    const openLink = card.querySelector('.btn-copy');
    if(serverData.url){
      if(openLink){
        openLink.href = serverData.url;
      } else {
        const actions = card.querySelector('.media-actions');
        const a = document.createElement('a');
        a.className = 'btn btn-small btn-copy';
        a.href = serverData.url;
        a.target = "_blank";
        a.rel = "noopener noreferrer";
        a.textContent = "Открыть";
        actions.insertBefore(a, actions.firstChild);
      }
    }
    card.removeAttribute('data-temp-id');
    const delBtn = card.querySelector('.btn-delete');
    if(delBtn && serverData.id){
      delBtn.dataset.id = serverData.id;
      delBtn.removeAttribute('data-temp-id');
    }
  }

  // remove a card by tempId or id
  function removeCardByIdentifier({id, tempId}){
    const selector = tempId ? `[data-temp-id="${CSS.escape(tempId)}"]` : `[data-id="${CSS.escape(id)}"]`;
    const card = grid.querySelector(selector);
    if(card && card.parentNode) card.parentNode.removeChild(card);
  }

  async function uploadFile(file, tempCardId){
    if(!file) return;
    const fd = new FormData();
    fd.append('file', file);
    showStatus('Загрузка...');
    try{
      const res = await fetch(window.location.pathname, {
        method: 'POST',
        body: fd,
        credentials: 'same-origin',
        headers: { 'X-CSRFToken': csrf() },
      });
      const data = await res.json().catch(()=>({success:false}));
      if(!res.ok || !data.success){
        showStatus('Ошибка при загрузке', true);
        console.error('upload failed', data);
        return;
      }
      updateTempCardWithServerData(tempCardId, data);
      showStatus('Загружено');
    }catch(e){
      console.error(e);
      showStatus('Ошибка при загрузке', true);
    }
  }

  // Attach attachment to a post via admin endpoint; callback(err, data)
  async function attachToPost(attachmentId, callback){
    if(!attachPostId) {
      return callback && callback({success:false, error:'missing_post_id'});
    }
    try{
      const payload = { post_id: attachPostId, attachment_id: attachmentId, field: attachField };
      const res = await fetch(ATTACH_ENDPOINT, {
        method: 'POST',
        credentials: 'same-origin',
        headers: {
          'Content-Type': 'application/json',
          'X-CSRFToken': csrf()
        },
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      if(res.ok && data && data.success){
        return callback && callback(null, data);
      } else {
        return callback && callback(data || {success:false});
      }
    }catch(e){
      console.error('attachToPost error', e);
      return callback && callback({success:false, error:String(e)});
    }
  }

  async function deleteAttachment(id, cardEl){
    if(!confirm('Удалить файл?')) return;
    const fd = new FormData();
    fd.append('action','delete');
    fd.append('id', id);
    try{
      const res = await fetch(window.location.pathname, {
        method: 'POST',
        body: fd,
        credentials: 'same-origin',
        headers: { 'X-CSRFToken': csrf() },
      });
      const data = await res.json();
      if(res.ok && data.success){
        if(cardEl && cardEl.parentNode) cardEl.parentNode.removeChild(cardEl);
        showStatus('Удалено');
      } else {
        showStatus('Ошибка при удалении', true);
      }
    }catch(e){
      console.error(e);
      showStatus('Ошибка при удалении', true);
    }
  }

  // Try to resolve attachment id by its URL via XHR to the same media-library view (format=json)
  async function resolveAttachmentIdByUrl(url){
    try{
      // Request attachments list (view supports format=json/XHR)
      const listUrl = window.location.pathname + (window.location.search ? window.location.search + '&format=json' : '?format=json');
      const res = await fetch(listUrl, { credentials: 'same-origin', headers: {'X-Requested-With':'XMLHttpRequest'} });
      if(!res.ok) return null;
      const payload = await res.json();
      const attachments = payload.attachments || [];
      // try exact match
      for(const a of attachments){
        if(!a) continue;
        if(a.url && a.url === url) return a.id;
      }
      // try matching by filename (basename)
      const target = url ? url.split('/').pop() : '';
      if(target){
        for(const a of attachments){
          if(a.url && a.url.split('/').pop() === target) return a.id;
          if(a.title && a.title.split('/').pop() === target) return a.id;
        }
      }
      return null;
    }catch(e){
      console.error('resolveAttachmentIdByUrl error', e);
      return null;
    }
  }

  function attachCardHandlers(card){
    const del = card.querySelector('.btn-delete');
    if(del) del.addEventListener('click', (e)=>{
      const temp = del.dataset.tempId;
      const id = del.dataset.id;
      if(temp){
        removeCardByIdentifier({tempId: temp});
        return;
      }
      const cardEl = del.closest('.media-card');
      deleteAttachment(id, cardEl);
    });
    const ins = card.querySelector('.btn-insert');
    if(ins) ins.addEventListener('click', async (e)=>{
      const cardEl = ins.closest('.media-card');
      const attachmentId = (cardEl && cardEl.dataset && cardEl.dataset.id) ? cardEl.dataset.id : null;
      const tempId = cardEl && cardEl.dataset ? cardEl.dataset.tempId : null;
      const url = ins.dataset.url || (cardEl.querySelector('.media-thumb img') && cardEl.querySelector('.media-thumb img').src) || '';

      // If media library opened for attaching to a post, use attach flow
      if(attachTo === 'post' && attachPostId){
        // If card is temporary and upload not finished
        if(tempId && !attachmentId){
          showStatus('Файл ещё загружается — подождите, затем нажмите снова', true);
          return;
        }

        // If we have attachmentId — good, just attach
        if(attachmentId){
          showStatus('Привязка изображения...');
          attachToPost(attachmentId, function(err, data){
            if(err || !data || !data.success){
              showStatus('Ошибка привязки', true);
              console.error('attach error', err || data);
              return;
            }
            try {
              window.opener.postMessage({
                type: 'media-library-selected',
                kind: 'attachment-attached',
                field: attachField,
                post_id: attachPostId,
                attachment_id: data.attachment_id || data.id,
                url: data.url || url
              }, '*');
            } catch (e) { console.warn('postMessage failed', e); }
            showStatus('Изображение привязано');
            try { window.close(); } catch(e){}
          });
          return;
        }

        // No attachmentId present — try to resolve by URL via server list
        if(url){
          showStatus('Поиск файла на сервере...');
          const foundId = await resolveAttachmentIdByUrl(url);
          if(foundId){
            showStatus('Привязка изображения...');
            attachToPost(foundId, function(err, data){
              if(err || !data || !data.success){
                showStatus('Ошибка привязки', true);
                console.error('attach error', err || data);
                return;
              }
              try {
                window.opener.postMessage({
                  type: 'media-library-selected',
                  kind: 'attachment-attached',
                  field: attachField,
                  post_id: attachPostId,
                  attachment_id: data.attachment_id || data.id,
                  url: data.url || url
                }, '*');
              } catch (e) { console.warn('postMessage failed', e); }
              showStatus('Изображение привязано');
              try { window.close(); } catch(e){}
            });
            return;
          } else {
            showStatus('Не удалось найти файл на сервере (id отсутствует).', true);
            return;
          }
        }

        showStatus('Не могу определить файл для привязки', true);
        return;
      }

      // default behavior: insert / copy link
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
          const tId = tempId();
          const previewUrl = URL.createObjectURL(f);
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
          const tId = tempId();
          const previewUrl = URL.createObjectURL(f);
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
        if(!f) {
          ev.preventDefault();
          showStatus('Выберите файл для загрузки', true);
          return;
        }
        ev.preventDefault();
        const tId = tempId();
        const previewUrl = URL.createObjectURL(f);
        const previewItem = { title: f.name || 'file', url: '', _previewSrc: previewUrl };
        prependAttachmentToGrid(previewItem, { tempId: tId });
        uploadFile(f, tId);
      });
    }

    // drag & drop
    const container = document.querySelector('.media-lib-container');
    if(container){
      container.addEventListener('dragover', (ev)=>{ ev.preventDefault(); container.classList.add('dragover'); });
      container.addEventListener('dragleave', (ev)=>{ container.classList.remove('dragover'); });
      container.addEventListener('drop', (ev)=>{ ev.preventDefault(); container.classList.remove('dragover'); const f = ev.dataTransfer.files && ev.dataTransfer.files[0]; if(f){
          const tId = tempId();
          const previewUrl = URL.createObjectURL(f);
          const previewItem = { title: f.name || 'file', url: '', _previewSrc: previewUrl };
          prependAttachmentToGrid(previewItem, { tempId: tId });
          uploadFile(f, tId);
      } });
    }
  });
})();
