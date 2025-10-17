// backend/blog/static/blog/admin-post-form.js
(function(){
  function $(sel){return document.querySelector(sel)}
  function $all(sel){return Array.from(document.querySelectorAll(sel))}

  const titleInput = document.getElementById('id_title') || document.querySelector('[name="title"]');
  const excerptInput = document.getElementById('id_excerpt') || document.querySelector('[name="excerpt"]');
  const contentInput = document.getElementById('id_content') || document.querySelector('[name="content"]');
  const authorInput = document.getElementById('id_author') || document.querySelector('[name="author"]');

  const previewTitle = document.getElementById('preview-title');
  const previewExcerpt = document.getElementById('preview-excerpt');
  const previewBody = document.getElementById('preview-body');
  const previewAuthor = document.getElementById('preview-author');
  const previewThumb = document.getElementById('preview-thumb');

  function safeText(s){return (s||'').toString();}

  function updatePreview(){
    if(previewTitle) previewTitle.textContent = safeText(titleInput && titleInput.value) || 'Заголовок поста';
    if(previewExcerpt) previewExcerpt.textContent = safeText(excerptInput && excerptInput.value) || (contentInput && (contentInput.value || '').slice(0,160)) || '';
    if(previewAuthor) previewAuthor.textContent = (authorInput && authorInput.options && authorInput.options[authorInput.selectedIndex] ? authorInput.options[authorInput.selectedIndex].text : (authorInput && authorInput.value)) || '-';
    if(previewBody){
      if(contentInput){
        // if content contains HTML, insert sanitized snippet
        let v = contentInput.value || '';
        // naive strip for preview: keep basic tags
        v = v.replace(/<script[\s\S]*?>[\s\S]*?<\/script>/gi, '');
        previewBody.innerHTML = v.length>0 ? (v.length>800 ? v.slice(0,800) + '...' : v) : '<em>Нет контента для предварительного просмотра</em>';
      }
    }
  }

  // init
  setTimeout(updatePreview, 200);

  // event listeners with debounce
  let t;
  function debounce(fn, wait){return function(){clearTimeout(t);t=setTimeout(fn,wait)}}
  if(titleInput) titleInput.addEventListener('input', debounce(updatePreview, 220));
  if(excerptInput) excerptInput.addEventListener('input', debounce(updatePreview, 220));
  if(contentInput) contentInput.addEventListener('input', debounce(updatePreview, 300));
  if(authorInput) authorInput.addEventListener('change', debounce(updatePreview, 200));

  // Preview button opens a new window with a signed preview token endpoint if available
  const previewBtn = document.getElementById('preview-button');
  if(previewBtn){
    previewBtn.addEventListener('click', async function(){
      try{
        const payload = {
          title: (titleInput && titleInput.value) || '',
          content: (contentInput && contentInput.value) || '',
          excerpt: (excerptInput && excerptInput.value) || ''
        };
        const resp = await fetch('/admin/blog/preview-token/', {
          method:'POST',headers:{'Content-Type':'application/json','X-CSRFToken':(document.cookie.match(/csrftoken=([^;]+)/)||[])[1]},body:JSON.stringify(payload)
        });
        if(resp.ok){ const data = await resp.json(); if(data && data.token){ window.open('/blog/preview/?token='+encodeURIComponent(data.token),'_blank'); return; } }
        // fallback: open simple preview
        const w = window.open(); w.document.write('<h3>'+ (payload.title||'Preview') +'</h3><div>'+ (payload.excerpt||'') +'</div><hr/>'+ (payload.content||'') );
      }catch(e){ console.error('preview error', e); alert('Не удалось открыть предварительный просмотр'); }
    });
  }

  // Save & publish button: set status field then submit
  const publishBtn = document.getElementById('publish-button');
  if(publishBtn){
    publishBtn.addEventListener('click', function(){
      const statusField = document.getElementById('id_status') || document.querySelector('[name="status"]');
      if(statusField){ if(statusField.tagName==='SELECT'){ statusField.value = 'published'; } else { try{ statusField.value='published'; }catch(e){} } }
      const form = document.getElementById('post-edit-form'); if(form) form.submit();
    });
  }

})();
