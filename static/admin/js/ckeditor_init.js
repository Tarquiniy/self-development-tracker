/* static/admin/js/ckeditor_init.js
   Инициализация CKEditor 5 для textarea/wrapper
*/
(function () {
  "use strict";

  function safeParseJSON(s) {
    try {
      return JSON.parse(s);
    } catch (e) {
      return null;
    }
  }

  const INSTANCES = {};

  function initEditorForWrapper(wrapper) {
    if (!wrapper) return;
    if (wrapper._ckeditorInitialized) return;
    wrapper._ckeditorInitialized = true;

    const cfgAttr = wrapper.getAttribute("data-ckeditor-config");
    let cfg = {};
    if (cfgAttr) cfg = safeParseJSON(cfgAttr) || {};

    const id = cfg.id || wrapper.id.replace(/_ckeditor_wrapper$/, "");
    const textarea = document.getElementById(id);
    if (!textarea) {
      console.error("CKEditor init: textarea not found for wrapper", wrapper, "expected id:", id);
      return;
    }

    const editorConfig = {
      extraPlugins: [window.DjangoUploadAdapterPlugin],
      toolbar: [
        "heading", "|",
        "bold", "italic", "underline", "link", "blockQuote", "|",
        "bulletedList", "numberedList", "|",
        "insertTable", "imageUpload", "mediaEmbed", "|",
        "undo", "redo"
      ],
      uploader: {
        uploadUrl: cfg.uploadUrl || textarea.getAttribute("data-upload-url") || "/api/blog/media/upload/"
      },
    };

    if (!window.ClassicEditor || typeof window.ClassicEditor.create !== "function") {
      console.warn("CKEditor script not loaded (ClassicEditor missing). Editor not initialized for", id);
      return;
    }

    window.ClassicEditor.create(textarea, editorConfig)
      .then(editor => {
        INSTANCES[id] = editor;
        textarea.value = editor.getData();
        editor.model.document.on("change:data", () => {
          textarea.value = editor.getData();
        });
        const form = textarea.closest("form");
        if (form) {
          if (!form._ckeditorSubmitBound) {
            form.addEventListener("submit", () => {
              try {
                Object.keys(INSTANCES).forEach(k => {
                  const ed = INSTANCES[k];
                  if (ed && ed.getData) {
                    const ta = document.getElementById(k);
                    if (ta) ta.value = ed.getData();
                  }
                });
              } catch (e) { }
            }, { once: false });
            form._ckeditorSubmitBound = true;
          }
        }
      })
      .catch(err => {
        console.error("CKEditor initialization error for", id, err);
      });
  }

  document.addEventListener("DOMContentLoaded", () => {
    const wrappers = document.querySelectorAll(".admin-ckeditor-widget");
    wrappers.forEach(w => initEditorForWrapper(w));
  });

  const observer = new MutationObserver(mutations => {
    for (const m of mutations) {
      if (!m.addedNodes) continue;
      m.addedNodes.forEach(node => {
        if (!(node instanceof HTMLElement)) return;
        if (node.classList && node.classList.contains("admin-ckeditor-widget")) {
          initEditorForWrapper(node);
        }
        const inside = node.querySelectorAll && node.querySelectorAll(".admin-ckeditor-widget");
        if (inside && inside.length) {
          inside.forEach(w => initEditorForWrapper(w));
        }
      });
    }
  });

  observer.observe(document.documentElement || document.body, {
    childList: true,
    subtree: true
  });

  window.addEventListener("beforeunload", () => {
    try {
      Object.keys(INSTANCES).forEach(k => {
        const ed = INSTANCES[k];
        if (ed && ed.destroy) ed.destroy();
      });
    } catch (e) { }
  });
})();
