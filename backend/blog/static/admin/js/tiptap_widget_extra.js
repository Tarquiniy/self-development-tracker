// static/admin/js/tiptap_widget_extra.js
(function(){
  // wait DOM ready
  document.addEventListener('DOMContentLoaded', function(){
    // helper to find TipTap editor global created by widget
    function getTiptapEditor(){
      // widget sets window.tiptapEditors by name or attaches editor to element dataset
      return window.__tiptap_current_editor || null;
    }

    // attach buttons
    const btnTogglePreview = document.getElementById('btn-toggle-preview');
    const btnPreview = document.getElementById('btn-preview');
    const btnRevisions = document.getElementById('btn-revisions');
    const btnFullscreen = document.getElementById('btn-fullscreen');
    const autosaveIndicator = document.getElementById('autosave-indicator');
    const livePreview = document.getElementById('live-preview');
    const wordCountEl = document.getElementById('word-count');
    const charCountEl = document.getElementById('char-count');
    const readTimeEl = document.getElementById('read-time');

    function updateStats(html){
      const text = (new DOMParser()).parseFromString(html, 'text/html').body.textContent || '';
      const words = text.trim().split(/\s+/).filter(Boolean).length;
      const chars = text.length;
      wordCountEl.textContent = words;
      charCountEl.textContent = chars;
      readTimeEl.textContent = Math.max(1, Math.round(words/200));
    }

    // Connect to editor (widget stores global editor object on window)
    let editor = null;
    // try to poll until editor exists
    let tries = 0;
    const waitEditor = setInterval(()=>{
      editor = window.__tiptap_current_editor || null;
      if (editor || tries++ > 20){ clearInterval(waitEditor); initIfReady(); }
    }, 250);

    function initIfReady(){
      if (!editor){
        console.warn('TipTap editor not found by admin extra script.');
        return;
      }

      // initial stats
      updateStats(editor.getHTML());

      // live preview update
      editor.on('update', ({ editor })=>{
        const html = editor.getHTML();
        livePreview.innerHTML = html;
        updateStats(html);
      });

      // toggle preview panel
      btnTogglePreview && btnTogglePreview.addEventListener('click', ()=> {
        const pc = document.getElementById('preview-container');
        if (pc.style.display === 'none'){ pc.style.display = ''; btnTogglePreview.textContent = 'Hide preview'; }
        else { pc.style.display = 'none'; btnTogglePreview.textContent = 'Show preview'; }
      });

      // preview: opens preview token via autosave endpoint (we already have /api/blog/revisions/autosave/)
      btnPreview && btnPreview.addEventListener('click', async ()=>{
        const postId = window.ADMIN_POST_ID || '';
        const html = editor.getHTML();
        const title = document.querySelector('input[name="title"]') ? document.querySelector('input[name="title"]').value : '';
        const excerpt = document.querySelector('textarea[name="excerpt"]') ? document.querySelector('textarea[name="excerpt"]').value : '';
        const form = new FormData();
        form.append('post_id', postId);
        form.append('title', title);
        form.append('content', html);
        form.append('excerpt', excerpt);
        form.append('autosave', '0');
        try {
          const res = await fetch('/api/blog/revisions/autosave/', { method:'POST', body: form, credentials:'same-origin', headers:{ 'X-CSRFToken': (document.cookie.match(/csrftoken=([^;]+)/)||[])[1] || '' }});
          const j = await res.json();
          if (j.preview_url) window.open(j.preview_url, '_blank');
          else if (j.preview_token) window.open('/preview/' + j.preview_token, '_blank');
          else alert('Preview failed');
        } catch(e){ console.error('preview error', e); alert('Preview request failed'); }
      });

      // fullscreen toggle
      btnFullscreen && btnFullscreen.addEventListener('click', ()=>{
        const el = document.getElementById('editor-container');
        if (!document.fullscreenElement){
          el.requestFullscreen && el.requestFullscreen();
          btnFullscreen.textContent = 'Exit fullscreen';
        } else {
          document.exitFullscreen && document.exitFullscreen();
          btnFullscreen.textContent = 'Fullscreen';
        }
      });

      // revisions
      btnRevisions && btnRevisions.addEventListener('click', ()=>{
        const postId = window.ADMIN_POST_ID;
        if (!postId) return alert('Save draft to enable revisions');
        window.openRevisionsPanel && window.openRevisionsPanel(postId);
      });

      // Autosave indicator: listen to window events emitted by widget (widget sets autosave status)
      window.addEventListener('tiptap-autosave', (e)=>{
        const status = e.detail && e.detail.status;
        autosaveIndicator.textContent = 'Autosave: ' + status;
      });

    }
  });
})();
