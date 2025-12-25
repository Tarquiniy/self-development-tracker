// backend/static/admin/js/media_library.js
// Handles upload, delete, UI updates for admin media library
(function(){
  function $(sel, ctx){ return (ctx || document).querySelector(sel); }
  function $all(sel, ctx){ return Array.from((ctx || document).querySelectorAll(sel)); }

  const fileInput = document.getElementById('media-file-input');
  const uploadStatus = document.getElementById('upload-status');
  const grid = document.getElementById('media-grid');

  function csrf() {
    // read from cookie (Django's csrftoken)
    const match = document.cookie.match(/(^|;)\s*csrftoken=([^;]+)/);
    return match ? decodeURIComponent(match[2]) : '';
  }

  function showStatus(text, isError){
    uploadStatus.textContent = text || '';
    uploadStatus.classList.toggle('error', !!isError);
    if(!text) return;
    setTimeout(()=>{ uploadStatus.textContent = ''; uploadStatus.classList.remove('error'); }, 4000);
  }

  async function uploadFile(file){
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
      const data = await res.json();
      if(!res.ok || !data.success){
        showStatus('Ошибка при загрузке', true);
        console.error('upload failed', data);
        return;
      }
      showStatus('Загружено');
      prependAttachmentToGrid(data);
    }catch(e){
      console.error(e);
      showStatus('Ошибка при загрузке', true);
    }
  }

  function prependAttachmentToGrid(item){
    // item: {id, url, title}
    const card = document.createElement('div');
    card.className = 'media-card';
    card.dataset.id = item.id;
    const thumbHtml = item.url ? `<img src="${escapeHtml(item.url)}" loading="lazy" />` : '<div class="media-icon"></div>';
    card.innerHTML = `<div class="media-thumb">${thumbHtml}</div>
      <div class="media-meta">
        <div class="media-title" title="${escapeHtml(item.title||'')}">${escapeHtml(truncate(item.title||'',28))}</div>
        <div class="media-actions">
          <a class="btn btn-small btn-copy" href="${escapeHtml(item.url)}" target="_blank" rel="noopener noreferrer">Открыть</a>
          <button class="btn btn-small btn-insert" data-url="${escapeHtml(item.url)}">Вставить</button>
          <button class="btn btn-small btn-delete" data-id="${escapeHtml(item.id)}">Удалить</button>
        </div>
      </div>`;
    if(grid){
      grid.insertBefore(card, grid.firstChild);
      attachCardHandlers(card);
    }
  }

  function escapeHtml(s){
    if(!s) return '';
    return s.replace(/[&<>"']/g, function(m){ return ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'})[m]; });
  }
  function truncate(s,n){ return s && s.length>n ? s.slice(0,n-1)+'…' : s||''; }

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

  function attachCardHandlers(card){
    const del = card.querySelector('.btn-delete');
    if(del) del.addEventListener('click', (e)=>{
      const id = del.dataset.id;
      deleteAttachment(id, card);
    });
    const ins = card.querySelector('.btn-insert');
    if(ins) ins.addEventListener('click', (e)=>{
      const url = ins.dataset.url;
      // Try to insert to opener (if editor integration) otherwise open new tab
      if(window.opener && typeof window.opener.insertMedia === 'function'){
        window.opener.insertMedia(url);
      } else {
        // fallback: copy url to clipboard
        navigator.clipboard && navigator.clipboard.writeText(url).then(()=> showStatus('Ссылка скопирована в буфер'), ()=> showStatus('Не удалось скопировать', true));
      }
    });
  }

  // attach handlers to existing cards
  document.addEventListener('DOMContentLoaded', function(){
    $all('.media-card').forEach(attachCardHandlers);

    // file input change
    if(fileInput){
      fileInput.addEventListener('change', function(e){
        const f = this.files && this.files[0];
        if(f) uploadFile(f);
        this.value = '';
      });
    }

    // drag & drop
    const container = document.querySelector('.media-lib-container');
    if(container){
      container.addEventListener('dragover', (ev)=>{ ev.preventDefault(); container.classList.add('dragover'); });
      container.addEventListener('dragleave', (ev)=>{ container.classList.remove('dragover'); });
      container.addEventListener('drop', (ev)=>{ ev.preventDefault(); container.classList.remove('dragover'); const f = ev.dataTransfer.files && ev.dataTransfer.files[0]; if(f) uploadFile(f); });
    }
  });
})();
