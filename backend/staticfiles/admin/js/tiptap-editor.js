// static/admin/js/tiptap-editor.js
(function(){
  function getCookie(name) {
    let cookieValue = null;
    if (document.cookie && document.cookie !== '') {
      const cookies = document.cookie.split(';');
      for (let i = 0; i < cookies.length; i++) {
        const cookie = cookies[i].trim();
        if (cookie.substring(0, name.length + 1) === (name + '=')) {
          cookieValue = decodeURIComponent(cookie.substring(name.length + 1));
          break;
        }
      }
    }
    return cookieValue;
  }

  function buildToolbar(Editor){
    const wrapper = document.createElement('div');
    wrapper.className = 'tiptap-toolbar';
    const buttons = [
      {cmd: 'bold', label: 'B'},
      {cmd: 'italic', label: 'I'},
      {cmd: 'strike', label: 'S'},
      {cmd: 'bulletList', label: '• List'},
      {cmd: 'orderedList', label: '1.'},
      {cmd: 'heading', label: 'H2', attrs:{level:2}},
      {cmd: 'blockquote', label: '"'},
      {cmd: 'codeBlock', label: '</>'},
      {cmd: 'link', label: 'Link'},
      {cmd: 'image', label: 'Image'},
    ];
    buttons.forEach(b => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.innerText = b.label;
      btn.className = 'tiptap-btn';
      btn.addEventListener('click', function(ev){
        ev.preventDefault();
        if (b.cmd==='bold') Editor.chain().focus().toggleBold().run();
        if (b.cmd==='italic') Editor.chain().focus().toggleItalic().run();
        if (b.cmd==='strike') Editor.chain().focus().toggleStrike().run();
        if (b.cmd==='bulletList') Editor.chain().focus().toggleBulletList().run();
        if (b.cmd==='orderedList') Editor.chain().focus().toggleOrderedList().run();
        if (b.cmd==='heading') Editor.chain().focus().toggleHeading(b.attrs).run();
        if (b.cmd==='blockquote') Editor.chain().focus().toggleBlockquote().run();
        if (b.cmd==='codeBlock') Editor.chain().focus().toggleCodeBlock().run();
        if (b.cmd==='link') {
          const url = prompt('URL');
          if (url) Editor.chain().focus().extendMarkRange('link').setLink({ href: url }).run();
        }
        if (b.cmd==='image') {
          const inp = document.createElement('input'); inp.type='file'; inp.accept='image/*';
          inp.onchange = function(){
            const f = inp.files[0];
            uploadImage(f, Editor, window.TIPTAP_CONFIG.uploadUrl);
          };
          inp.click();
        }
      });
      wrapper.appendChild(btn);
    });
    return wrapper;
  }

  async function uploadImage(file, Editor, uploadUrl){
    const fd = new FormData(); fd.append('file', file);
    const csrftoken = getCookie('csrftoken');
    const resp = await fetch(uploadUrl, {method: 'POST', body: fd, headers: {'X-CSRFToken': csrftoken}});
    const j = await resp.json();
    if (j && j.success && j.url) {
      Editor.chain().focus().setImage({ src: j.url }).run();
    } else {
      alert('Upload failed: ' + (j.error || JSON.stringify(j)));
    }
  }

  window.initAdminTipTap = function(){
    const textareas = document.querySelectorAll('textarea[data-tiptap]');
    if (!textareas.length) return;
    textareas.forEach(function(textarea){
      const uploadUrl = textarea.dataset.uploadUrl || '/admin/blog/media-library/';
      const previewTokenUrl = textarea.dataset.previewTokenUrl || '/admin/blog/preview-token/';
      window.TIPTAP_CONFIG = window.TIPTAP_CONFIG || {};
      window.TIPTAP_CONFIG.uploadUrl = uploadUrl;
      window.TIPTAP_CONFIG.previewTokenUrl = previewTokenUrl;

      const content = textarea.value || '';
      textarea.style.display = 'none';

      // ensure there is a hidden input for JSON
      let jsonInput = document.getElementById('id_content_json');
      if (!jsonInput) {
        jsonInput = document.createElement('input');
        jsonInput.type = 'hidden';
        jsonInput.name = 'content_json';
        jsonInput.id = 'id_content_json';
        textarea.parentNode.insertBefore(jsonInput, textarea.nextSibling);
      } else {
        // preserve existing value (if any)
        try {
          const existing = document.getElementById('id_content_json').value;
          if (existing) {
            // try to hydrate editor content from JSON if available
          }
        } catch(e){}
      }

      const wrapper = document.createElement('div');
      wrapper.className = 'admin-tiptap-wrapper';

      const toolbar = document.createElement('div'); toolbar.className = 'admin-tiptap-toolbar';
      const editorEl = document.createElement('div'); editorEl.className = 'admin-tiptap-editor';

      textarea.parentNode.insertBefore(wrapper, textarea);
      wrapper.appendChild(toolbar);
      wrapper.appendChild(editorEl);
      wrapper.appendChild(textarea);

      const Editor = window['@tiptap/core'].Editor;
      const StarterKit = window['@tiptap/starter-kit'].StarterKit;
      const Image = window['@tiptap/extension-image'].Image;
      const Link = window['@tiptap/extension-link'].Link;
      const CodeBlock = window['@tiptap/extension-code-block-lowlight'].CodeBlockLowlight || null;

      const extensions = [StarterKit, Image, Link];
      if (CodeBlock) extensions.push(CodeBlock);

      // Try to initialize content from content_json if present, otherwise HTML
      let initContent = content;
      const jsonVal = (document.getElementById('id_content_json') && document.getElementById('id_content_json').value) || null;
      try {
        if (jsonVal) {
          initContent = JSON.parse(jsonVal);
        }
      } catch(e) {
        // ignore, fall back to html string
        initContent = content;
      }

      const editor = new Editor({
        element: editorEl,
        extensions: extensions,
        content: initContent,
        onUpdate: ({editor}) => {
          textarea.value = editor.getHTML();
          try {
            const doc = editor.getJSON();
            jsonInput.value = JSON.stringify(doc);
          } catch (e) {
            console.warn('Could not serialize editor JSON', e);
          }
        }
      });

      const tb = buildToolbar(editor);
      toolbar.appendChild(tb);

      let autosaveTimer = setInterval(function(){
        const payload = {title: document.getElementById('id_title') ? document.getElementById('id_title').value : '', content: textarea.value};
        fetch(previewTokenUrl, {method:'POST',headers:{'Content-Type':'application/json','X-CSRFToken': getCookie('csrftoken')}, body: JSON.stringify(payload)}).then(()=>{}).catch(()=>{});
      }, 20000);

      textarea.addEventListener('blur', function(){
        textarea.value = editor.getHTML();
        try {
          const doc = editor.getJSON();
          jsonInput.value = JSON.stringify(doc);
        } catch (e) {}
      });

      editorEl.addEventListener('drop', function(ev){
        ev.preventDefault();
        const f = ev.dataTransfer.files && ev.dataTransfer.files[0];
        if (f && f.type.startsWith('image/')) {
          uploadImage(f, editor, uploadUrl);
        }
      });

    });
  };

  if (document.readyState === 'complete' || document.readyState === 'interactive'){
    setTimeout(window.initAdminTipTap, 10);
  } else {
    document.addEventListener('DOMContentLoaded', window.initAdminTipTap);
  }
})();
