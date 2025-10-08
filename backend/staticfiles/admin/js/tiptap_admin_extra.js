// static/admin/js/tiptap_admin_extra.js
(function () {
  // helper functions
  function qs(selector, ctx){ return (ctx || document).querySelector(selector); }
  function qsa(selector, ctx){ return Array.from((ctx || document).querySelectorAll(selector)); }
  function getCookie(name) {
    const v = document.cookie.match('(^|;)\\s*' + name + '\\s*=\\s*([^;]+)');
    return v ? v.pop() : '';
  }

  function uploadFileToServer(file, uploadUrl) {
    const fd = new FormData();
    fd.append('file', file, file.name);
    // optional fields can be appended here (title, post_id)
    return fetch(uploadUrl, {
      method: 'POST',
      credentials: 'same-origin',
      headers: {
        'X-CSRFToken': getCookie('csrftoken')
      },
      body: fd
    }).then(resp => {
      if (!resp.ok) throw new Error('Upload failed: ' + resp.status);
      return resp.json();
    }).then(json => {
      // support multiple response shapes
      if (json.attachment && json.attachment.url) return json.attachment.url;
      if (json.url) return json.url;
      if (json.uploaded && json.uploaded.length && json.uploaded[0].url) return json.uploaded[0].url;
      throw new Error('No URL returned from upload');
    });
  }

  function ensureEditorConstructors() {
    // accepts global window.Editor etc. (set by bundle)
    if (typeof window.Editor === 'undefined') {
      console.warn('TipTap bundle missing — editor will fall back to basic contentEditable.');
      return false;
    }
    return true;
  }

  function initEditorFor(widget) {
    try {
      const textarea = widget.previousElementSibling && widget.previousElementSibling.tagName === 'TEXTAREA'
        ? widget.previousElementSibling
        : null;
      if (!textarea) return;

      // avoid double init
      if (widget.dataset._inited_for === textarea.id) return;
      widget.dataset._inited_for = textarea.id;

      const uploadUrl = widget.dataset.uploadUrl || widget.dataset.uploadUrl || widget.getAttribute('data-upload-url') || '/api/blog/media/upload/';
      const editorMode = (widget.getAttribute('data-editor') || 'auto').toLowerCase();

      // find editor root
      const editorEl = qs('.tiptap-editor', widget);
      const toolbar = qs('.tiptap-toolbar', widget);

      // fallback simple contentEditable (if TipTap not available)
      if (!ensureEditorConstructors() || editorMode === 'fallback') {
        initFallback(textarea, widget);
        return;
      }

      // create TipTap editor
      const EditorClass = window.Editor;
      const StarterKit = window.StarterKit;
      const Link = window.Link;
      const ImageExt = window.Image;
      const CodeBlockLowlight = window.CodeBlockLowlight;
      const lowlight = window.lowlight;

      const editor = new EditorClass({
        element: editorEl,
        content: textarea.value || '<p></p>',
        extensions: [
          StarterKit,
          Link,
          ImageExt.configure({ inline: false }),
          CodeBlockLowlight.configure({ lowlight })
        ],
        onUpdate: ({ editor }) => {
          const html = editor.getHTML();
          textarea.value = html;
          textarea.dispatchEvent(new Event('change', { bubbles: true }));
        }
      });

      // sync before form submit
      const form = textarea.closest('form');
      if (form) {
        form.addEventListener('submit', function () {
          textarea.value = editor.getHTML();
        });
      }

      // build toolbar (basic set)
      function addBtn(label, title, fn) {
        const b = document.createElement('button');
        b.type = 'button';
        b.title = title || '';
        b.className = 'tiptap-btn';
        b.innerHTML = label;
        b.addEventListener('click', function (e) {
          e.preventDefault();
          try { fn(editor); } catch (err) { console.error(err); }
          editor.focus();
        });
        toolbar.appendChild(b);
        return b;
      }

      addBtn('<b>B</b>', 'Bold', (ed) => ed.chain().focus().toggleBold().run());
      addBtn('<i>I</i>', 'Italic', (ed) => ed.chain().focus().toggleItalic().run());
      addBtn('U', 'Underline', (ed) => ed.chain().focus().toggleUnderline().run());
      addBtn('H1', 'Heading 1', (ed) => ed.chain().focus().toggleHeading({ level: 1 }).run());
      addBtn('• List', 'Bulleted list', (ed) => ed.chain().focus().toggleBulletList().run());
      addBtn('1. List', 'Ordered list', (ed) => ed.chain().focus().toggleOrderedList().run());
      addBtn('</> Code', 'Code block', (ed) => ed.chain().focus().toggleCodeBlock().run());
      addBtn('❝', 'Blockquote', (ed) => ed.chain().focus().toggleBlockquote().run());
      addBtn('🔗', 'Insert link', (ed) => {
        const url = prompt('Введите URL (https://...)');
        if (url) ed.chain().focus().setLink({ href: url }).run();
      });

      // Image insertion button -> supports file upload or URL
      const imgBtn = addBtn('🖼️', 'Insert image (upload or URL)', (ed) => {
        const method = confirm('Нажми OK для загрузки файла с компьютера, Отмена — вставить URL');
        if (method) {
          // upload flow
          const inp = document.createElement('input');
          inp.type = 'file';
          inp.accept = 'image/*';
          inp.addEventListener('change', async function () {
            const f = this.files && this.files[0];
            if (!f) return;
            const placeholder = document.createElement('span');
            placeholder.className = 'tiptap-upload-placeholder';
            placeholder.textContent = 'Uploading...';
            editor.view.dom.appendChild(placeholder);
            try {
              const url = await uploadFileToServer(f, uploadUrl);
              placeholder.remove();
              ed.chain().focus().setImage({ src: url }).run();
            } catch (err) {
              placeholder.remove();
              alert('Ошибка при загрузке изображения: ' + err.message);
            }
          });
          inp.click();
        } else {
          const url = prompt('Вставьте URL изображения (https://...)');
          if (url) ed.chain().focus().setImage({ src: url }).run();
        }
      });

      // simple autosave (every 30s) to revisions endpoint
      (function autosaveLoop() {
        const INTERVAL = 30000;
        let timer = null;
        function schedule() {
          timer = setTimeout(async function () {
            try {
              const payload = {
                id: textarea.dataset.postId || null,
                title: (document.querySelector('#id_title') && document.querySelector('#id_title').value) || '',
                excerpt: (document.querySelector('#id_excerpt') && document.querySelector('#id_excerpt').value) || '',
                content: editor.getHTML(),
                content_json: null,
                published_at: (document.querySelector('#id_published_at') && document.querySelector('#id_published_at').value) || null,
                featured_image: (document.querySelector('#id_featured_image') && document.querySelector('#id_featured_image').value) || ''
              };
              const resp = await fetch('/api/blog/revisions/autosave/', {
                method: 'POST',
                credentials: 'same-origin',
                headers: {'Content-Type':'application/json', 'X-CSRFToken': getCookie('csrftoken')},
                body: JSON.stringify(payload)
              });
              if (resp.ok) {
                try {
                  const data = await resp.json();
                  if (data && data.success && data.id) textarea.dataset.postId = data.id;
                } catch (e) {}
              }
            } catch (e) {
              // ignore autosave errors silently
              console.debug('autosave error', e);
            } finally {
              schedule();
            }
          }, INTERVAL);
        }
        schedule();
        // stop autosave when leaving page
        window.addEventListener('beforeunload', function () { if (timer) clearTimeout(timer); });
      })();

    } catch (err) {
      console.error('TipTap init error', err);
      // fallback handled by fallback initializer if needed
    }
  }

  function initFallback(textarea, widget) {
    // basic contentEditable fallback — won't be used if TipTap bundle is present
    try {
      let ed = widget.querySelector('.tiptap-editor');
      if (!ed) {
        ed = document.createElement('div');
        ed.className = 'tiptap-editor';
        ed.contentEditable = true;
        widget.appendChild(ed);
      }
      ed.innerHTML = textarea.value || '';

      ed.addEventListener('input', function () {
        textarea.value = ed.innerHTML;
        textarea.dispatchEvent(new Event('change', { bubbles: true }));
      });

      const form = textarea.closest('form');
      if (form) form.addEventListener('submit', function(){ textarea.value = ed.innerHTML; });
    } catch (e) { console.warn('fallback init failed', e); }
  }

  function bootstrapAll() {
    const widgets = qsa('.admin-tiptap-widget');
    widgets.forEach(initEditorFor);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', bootstrapAll);
  } else {
    bootstrapAll();
  }
})();
