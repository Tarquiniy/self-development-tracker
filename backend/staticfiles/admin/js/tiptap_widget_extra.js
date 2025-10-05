// static/admin/js/tiptap_admin_extra.js
(function(){
  document.addEventListener('DOMContentLoaded', function(){
    // попытаемся найти editor
    let editor = null;
    let tries = 0;
    const wait = setInterval(()=>{
      editor = window.__tiptap_current_editor || null;
      if (editor || tries++ > 20){ clearInterval(wait); init(editor); }
    }, 200);

    function init(editor){
      const preview = document.getElementById('live-preview');
      const wordCount = document.getElementById('word-count');
      const charCount = document.getElementById('char-count');
      const autosaveIndicator = document.getElementById('autosave-indicator');
      const revisionsList = document.getElementById('revisions-list');

      function updatePreview(html){
        if (preview) preview.innerHTML = html;
        if (wordCount && charCount){
          const text = (new DOMParser()).parseFromString(html,'text/html').body.textContent || '';
          const words = text.trim().split(/\s+/).filter(Boolean).length;
          wordCount.textContent = words;
          charCount.textContent = text.length;
        }
      }

      if (editor){
        updatePreview(editor.getHTML());
        editor.on('update', ({ editor }) => updatePreview(editor.getHTML()));
      } else {
        // listen to widget fallback event
        window.addEventListener('tiptap:update', e => updatePreview(e.detail.html || ''));
      }

      // autosave events
      window.addEventListener('tiptap:autosave:start', ()=>{ if (autosaveIndicator) autosaveIndicator.textContent = 'Autosave: saving...'; });
      window.addEventListener('tiptap:autosave:done', (e)=>{ if (autosaveIndicator) autosaveIndicator.textContent = 'Autosave: saved'; loadRevisions(); });
      window.addEventListener('tiptap:autosave:error', ()=>{ if (autosaveIndicator) autosaveIndicator.textContent = 'Autosave: error'; });

      // load revisions
      async function loadRevisions(){
        const postId = window.ADMIN_POST_ID;
        if (!postId) { revisionsList.innerHTML = '<small>Сохраните пост, чтобы видеть ревизии</small>'; return; }
        try {
          const res = await fetch(`/api/blog/revisions/${postId}/`, { credentials:'same-origin' });
          const j = await res.json();
          const items = j.results || [];
          if (!items.length) { revisionsList.innerHTML = '<small>Нет ревизий</small>'; return; }
          revisionsList.innerHTML = '';
          items.forEach(it=>{
            const div = document.createElement('div');
            div.style.padding = '6px 0';
            div.innerHTML = `<div style="font-weight:600">${it.title || '(без заголовка)'}</div><div style="font-size:12px;color:#666">${it.created_at} ${it.autosave?'<em>(autosave)</em>':''}</div>
              <div style="margin-top:6px"><button data-rev="${it.id}" class="rev-preview">Preview</button> <button data-rev="${it.id}" class="rev-restore">Restore</button></div>`;
            revisionsList.appendChild(div);
          });
          revisionsList.querySelectorAll('.rev-preview').forEach(btn=>{
            btn.addEventListener('click', async e=>{
              const id = e.currentTarget.dataset.rev;
              // preview by getting revision details and opening a new window with content
              const postId = window.ADMIN_POST_ID;
              const res2 = await fetch(`/api/blog/revisions/${postId}/`, { credentials:'same-origin' });
              const j2 = await res2.json();
              const rev = j2.results.find(r=>r.id==id);
              if (rev){
                const w = window.open();
                w.document.write(`<html><head><title>${rev.title}</title></head><body>${rev.content || ''}</body></html>`);
                w.document.close();
              } else alert('Revision not found');
            });
          });
          revisionsList.querySelectorAll('.rev-restore').forEach(btn=>{
            btn.addEventListener('click', async e=>{
              if (!confirm('Восстановить эту ревизию?')) return;
              const id = e.currentTarget.dataset.rev;
              const res = await fetch(`/api/blog/revisions/restore/${id}/`, { method:'POST', credentials:'same-origin', headers:{ 'X-CSRFToken': (document.cookie.match(/csrftoken=([^;]+)/)||[])[1] || '' } });
              const j = await res.json();
              if (j.success){ alert('Ревизия восстановлена, перезагрузка страницы'); window.location.reload(); }
              else alert('Ошибка восстановления: ' + (j.message || 'unknown'));
            });
          });
        } catch (err){
          revisionsList.innerHTML = '<small>Ошибка загрузки ревизий</small>';
          console.error(err);
        }
      }

      loadRevisions();

      // hook up top buttons
      const btnPreview = document.getElementById('btn-preview');
      const btnTogglePreview = document.getElementById('btn-toggle-preview');
      const btnRevisions = document.getElementById('btn-revisions');
      const btnSave = document.getElementById('btn-save-draft');
      const btnInsertTOC = document.getElementById('btn-insert-toc');

      btnTogglePreview && btnTogglePreview.addEventListener('click', ()=>{
        const pc = document.getElementById('preview-container');
        if (!pc) return;
        pc.style.display = pc.style.display === 'none' ? '' : 'none';
      });

      btnPreview && btnPreview.addEventListener('click', async ()=>{
        const postId = window.ADMIN_POST_ID || '';
        // use autosave endpoint to generate preview token quickly
        const html = editor ? editor.getHTML() : (document.querySelector('.tiptap-editor').innerHTML || '');
        const form = new FormData();
        form.append('post_id', postId);
        form.append('title', (document.querySelector('input[name="title"]')||{value:''}).value);
        form.append('content', html);
        form.append('excerpt', (document.querySelector('textarea[name="excerpt"]')||{value:''}).value);
        form.append('autosave', '0');
        try {
          const res = await fetch('/api/blog/revisions/autosave/', { method:'POST', body: form, credentials:'same-origin', headers:{ 'X-CSRFToken': (document.cookie.match(/csrftoken=([^;]+)/)||[])[1] || '' }});
          const j = await res.json();
          if (j.preview_url) window.open(j.preview_url, '_blank');
          else if (j.preview_token) window.open('/preview/' + j.preview_token, '_blank');
          else alert('Предпросмотр не доступен');
        } catch(e){ console.error(e); alert('Ошибка запроса для предпросмотра'); }
      });

      btnRevisions && btnRevisions.addEventListener('click', ()=>loadRevisions());
      btnSave && btnSave.addEventListener('click', ()=>{
        // submit form to save
        const form = document.getElementById('post-form') || document.querySelector('form');
        if (!form) return alert('Форма не найдена');
        // ensure textarea content is in form
        const ta = document.querySelector('textarea[name="content"]');
        if (editor && ta) ta.value = editor.getHTML();
        form.submit();
      });

      btnInsertTOC && btnInsertTOC.addEventListener('click', ()=>{
        // generate TOC from headings in preview
        const previewHtml = preview.innerHTML;
        const tmp = document.createElement('div'); tmp.innerHTML = previewHtml;
        const headings = tmp.querySelectorAll('h1,h2,h3');
        if (!headings.length) return alert('Заголовки не найдены');
        let toc = '<div class="toc"><strong>Оглавление</strong><ul>';
        headings.forEach(h=>{
          const text = h.textContent.trim();
          const id = text.toLowerCase().replace(/[^\w]+/g,'-').replace(/^-+|-+$/g,'');
          h.id = id;
          toc += `<li><a href="#${id}">${text}</a></li>`;
        });
        toc += '</ul></div>';
        // insert into editor at start
        if (editor) editor.chain().focus().insertContent(toc).run();
        else document.querySelector('.tiptap-editor').insertAdjacentHTML('afterbegin', toc);
      });
    } // init
  }, false);
})();
