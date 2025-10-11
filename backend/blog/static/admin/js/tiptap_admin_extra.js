// backend/blog/static/admin/js/tiptap_admin_extra.js
//
// Replaces TipTap initializer — now it loads CKEditor 5 Classic (CDN) and inits editors.
//
// - Expects upload endpoint (default) at /api/blog/media/upload/
// - Sends CSRF in X-CSRFToken header (Django default).
// - Syncs editor content to <textarea> to keep Django admin form intact.

(function () {
  "use strict";

  // CKEditor CDN — pin version as desired. Change if you self-host.
  const CKEDITOR_CDN_URL = "https://cdn.ckeditor.com/ckeditor5/47.0.0/classic/ckeditor.js";

  const TEXTAREA_SELECTOR = "textarea.admin-advanced-editor, textarea.admin-tiptap-textarea";

  function getCsrfToken() {
    const m = document.cookie.match('(^|;)\\s*csrftoken\\s*=\\s*([^;]+)');
    if (m) return m.pop();
    const meta = document.querySelector('meta[name="csrfmiddlewaretoken"]');
    return meta ? meta.content : '';
  }

  function loadScript(url) {
    return new Promise(function (resolve, reject) {
      if (!url) return reject(new Error("No URL"));
      const existing = Array.from(document.scripts).find(s => s.src && s.src.indexOf(url) !== -1);
      if (existing && typeof ClassicEditor !== "undefined") return resolve();
      try {
        const s = document.createElement('script');
        s.src = url;
        s.async = true;
        s.onload = function () { resolve(); };
        s.onerror = function (e) { reject(new Error("Failed to load " + url)); };
        document.head.appendChild(s);
      } catch (err) {
        reject(err);
      }
    });
  }

  async function initEditorForTextarea(textarea) {
    if (!textarea) return null;
    if (textarea.dataset._cke_inited) return null;
    textarea.dataset._cke_inited = "1";

    const wrapperId = textarea.id ? (textarea.id + "_cke_wrapper") : null;
    const wrapper = wrapperId ? document.getElementById(wrapperId) : null;
    const uploadUrl = (wrapper && wrapper.dataset && wrapper.dataset.uploadUrl) ? wrapper.dataset.uploadUrl : (textarea.dataset.uploadUrl || "/api/blog/media/upload/");

    try {
      if (typeof ClassicEditor === "undefined") {
        await loadScript(CKEDITOR_CDN_URL);
      }
    } catch (err) {
      console.error("[ckeditor_admin] failed to load CKEditor from CDN", err);
      return null;
    }

    if (typeof ClassicEditor === "undefined") {
      console.error("[ckeditor_admin] ClassicEditor not found after loading CDN");
      return null;
    }

    let mountPoint = null;
    if (wrapper) {
      mountPoint = wrapper.querySelector('.ckeditor-editor-placeholder');
      if (!mountPoint) {
        mountPoint = document.createElement('div');
        wrapper.appendChild(mountPoint);
      }
    } else {
      mountPoint = document.createElement('div');
      textarea.parentNode.insertBefore(mountPoint, textarea.nextSibling);
    }

    const config = {
      simpleUpload: {
        uploadUrl: uploadUrl,
        headers: {
          'X-CSRFToken': getCsrfToken()
        }
      },
      toolbar: {
        items: [
          'heading', '|',
          'bold', 'italic', 'underline', 'link', 'blockQuote', 'codeBlock', '|',
          'bulletedList', 'numberedList', '|',
          'insertTable', 'imageUpload', 'mediaEmbed', '|',
          'undo', 'redo', 'removeFormat'
        ]
      },
      placeholder: 'Напишите контент поста...'
    };

    try {
      const editor = await ClassicEditor.create(mountPoint, config);

      try {
        const initial = textarea.value || '';
        if (initial && editor.setData) {
          editor.setData(initial);
        }
      } catch (e) { console.debug(e); }

      editor.model.document.on('change:data', () => {
        try {
          if (editor.getData) {
            textarea.value = editor.getData();
            textarea.dispatchEvent(new Event('change', { bubbles: true }));
          }
        } catch (e) { console.debug(e); }
      });

      const form = textarea.closest('form');
      if (form) {
        form.addEventListener('submit', function () {
          try {
            if (editor.getData) textarea.value = editor.getData();
          } catch (e) { console.debug(e); }
        });
      }

      console.info('[ckeditor_admin] initialised CKEditor for', textarea.id || textarea.name);
      return editor;
    } catch (err) {
      console.error('[ckeditor_admin] CKEditor create failed', err);
      return null;
    }
  }

  async function bootstrapAll() {
    const nodes = Array.from(document.querySelectorAll(TEXTAREA_SELECTOR));
    if (!nodes.length) return;
    try {
      if (typeof ClassicEditor === "undefined") {
        await loadScript(CKEDITOR_CDN_URL);
      }
    } catch (err) {
      console.warn('[ckeditor_admin] CDN load error', err);
    }
    for (const ta of nodes) {
      try { await initEditorForTextarea(ta); } catch (e) { console.debug(e); }
    }
  }

  window.initAdminCKEditors = function () {
    return bootstrapAll();
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', bootstrapAll);
  } else {
    bootstrapAll();
  }

})();
