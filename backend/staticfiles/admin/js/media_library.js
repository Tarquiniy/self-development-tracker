// backend/blog/static/admin/js/media_library.js
// Media library UI script — improved: if opened as popup for selection it will postMessage selected file to opener.
(function(){
  function $all(sel, ctx){ return Array.from((ctx || document).querySelectorAll(sel)); }
  function $(sel, ctx){ return (ctx || document).querySelector(sel); }

  const grid = document.getElementById('media-grid');
  const uploadStatus = document.getElementById('upload-status');

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

  // Escape & utility
  function escapeHtml(s){
    if(!s) return '';
    return s.replace(/[&<>"']/g, function(m){ return ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'})[m]; });
  }
  function truncate(s,n){ return s && s.length>n ? s.slice(0,n-1)+'…' : s||''; }

  // Read 'field' param passed by opener
  const params = new URLSearchParams(window.location.search || '');
  const targetField = params.get('field') || null;
  const postIdParam = params.get('post_id') || params.get('postId') || null;

  // Attach handlers to a card element
  function attachCardHandlers(card){
    const del = card.querySelector('.btn-delete');
    if(del) del.addEventListener('click', (e)=>{
      const id = del.dataset.id;
      if(!id) return;
      if(!confirm('Удалить файл?')) return;
      // send POST to current page to delete
      const fd = new FormData();
      fd.append('action','delete');
      fd.append('id', id);
      fetch(window.location.pathname, { method:'POST', body:fd, credentials:'same-origin', headers:{ 'X-CSRFToken': csrf() } })
        .then(r => r.json().catch(()=>({success:false})))
        .then(data => {
          if(data && data.success){
            if(card && card.parentNode) card.parentNode.removeChild(card);
            showStatus('Удалено');
          } else {
            showStatus('Ошибка при удалении', true);
          }
        }).catch(()=> showStatus('Ошибка при удалении', true));
    });

    const ins = card.querySelector('.btn-insert');
    if(ins) ins.addEventListener('click', (e)=>{
      e.preventDefault();
      const url = ins.dataset.url || (card.querySelector('.media-thumb img') && card.querySelector('.media-thumb img').src) || '';
      const attachmentId = ins.dataset.id || ins.dataset.attachmentId || card.dataset.id || null;

      // If opened as popup by admin form and opener exists — notify opener by postMessage
      try {
        if (window.opener && typeof window.opener.postMessage === 'function') {
          const field = targetField || 'id_featured_image';
          window.opener.postMessage({
            type: 'media-selected',
            field: field,
            url: url,
            attachment_id: attachmentId
          }, '*');
          try { window.close(); } catch(e){}
          return;
        }
      } catch(e){
        console.debug('postMessage failed', e);
      }

      // Fallback: copy to clipboard + notify user
      if (navigator.clipboard && url) {
        navigator.clipboard.writeText(url).then(()=> showStatus('Ссылка скопирована в буфер'), ()=> showStatus('Не удалось скопировать', true));
      } else {
        // fallback to open in new tab
        if(url) window.open(url, '_blank');
      }
    });
  }

  // Attach handlers on DOM ready
  document.addEventListener('DOMContentLoaded', function(){
    $all('.media-card').forEach(attachCardHandlers);
  });

  // Also export small helper in case opener calls window.insertMedia(url)
  window.insertMedia = function(url, attachmentId){
    if(window.opener && typeof window.opener.postMessage === 'function'){
      const field = targetField || 'id_featured_image';
      window.opener.postMessage({ type:'media-selected', field: field, url: url, attachment_id: attachmentId || null }, '*');
      try{ window.close(); }catch(e){}
      return true;
    }
    return false;
  };

})();
