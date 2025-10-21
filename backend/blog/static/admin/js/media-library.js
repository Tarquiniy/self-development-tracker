// media-library.js
(function(){
  'use strict';
  function qs(sel, ctx){ return (ctx||document).querySelector(sel); }
  function qsa(sel, ctx){ return Array.from((ctx||document).querySelectorAll(sel)); }

  const form = qs('#mediaUploadForm');
  const status = qs('#uploadStatus');
  const grid = qs('#mediaGrid');
  const search = qs('#searchInput');
  const refreshBtn = qs('#refreshBtn');

  if(form){
    form.addEventListener('submit', async function(e){
      e.preventDefault();
      status.textContent = 'Загружаем...';
      const fd = new FormData(form);
      try{
        const resp = await fetch("", { method: "POST", body: fd, credentials: 'same-origin' });
        const data = await resp.json();
        if(data.success){
          status.textContent = 'Загрузка успешна';
          setTimeout(()=>location.reload(), 600);
        } else {
          status.textContent = 'Ошибка: ' + (data.message || 'server');
        }
      }catch(err){
        status.textContent = 'Ошибка сети';
        console.error(err);
      }
    });
  }

  // simple copy handler
  window.copyUrlToClipboard = function(e){
    try{
      const target = e.currentTarget || e.target;
      const url = target.getAttribute('data-insert-url');
      if(!url) return;
      navigator.clipboard.writeText(url).then(()=>{
        target.textContent = 'Скопировано';
        setTimeout(()=>target.textContent = 'Копировать ссылку', 1200);
      });
    }catch(err){
      console.error('copy failed', err);
    }
  };

  if(search){
    search.addEventListener('input', function(){
      const q = this.value.trim().toLowerCase();
      qsa('.media-item', grid).forEach(item=>{
        const title = (item.getAttribute('data-title')||'').toLowerCase();
        item.style.display = (q === '' || title.indexOf(q) !== -1) ? '' : 'none';
      });
    });
  }

  if(refreshBtn){
    refreshBtn.addEventListener('click', function(){ location.reload(); });
  }
})();
