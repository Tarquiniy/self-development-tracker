// static/admin/js/ckeditor_init.js
// Инициализация CKEditor 5 для всех textarea, у которых в DOM-е есть wrapper
// Формат: <textarea id="id_field" ...></textarea>
//         <div id="id_field_ckeditor_wrapper" data-ckeditor-config='{"id":"id_field",...}'></div>
// Скрипт:
// - считывает data-ckeditor-config JSON из wrapper
// - создаёт ClassicEditor (если доступен) с подключением DjangoUploadAdapterPlugin
// - синхронизирует данные editor.getData() в привязанный textarea перед submit
// - корректно уничтожает редакторы при навигации/submit

(function () {
  "use strict";

  // Utility: parse JSON safely
  function safeParseJSON(s) {
    try {
      return JSON.parse(s);
    } catch (e) {
      return null;
    }
  }

  // Keep references to editors to destroy if needed
  const INSTANCES = {};

  function initEditorForWrapper(wrapper) {
    if (!wrapper) return;

    // already initialized?
    if (wrapper._ckeditorInitialized) return;
    wrapper._ckeditorInitialized = true;

    const cfgAttr = wrapper.getAttribute("data-ckeditor-config");
    let cfg = {};
    if (cfgAttr) cfg = safeParseJSON(cfgAttr) || {};

    // find the textarea by id (cfg.id)
    const id = cfg.id || wrapper.id.replace(/_ckeditor_wrapper$/, "");
    const textarea = document.getElementById(id);
    if (!textarea) {
      console.error("CKEditor init: textarea not found for wrapper", wrapper, "expected id:", id);
      return;
    }

    // Prepare editor config
    const editorConfig = {
      extraPlugins: [window.DjangoUploadAdapterPlugin],
      toolbar: [
        "heading", "|",
        "bold", "italic", "underline", "link", "blockQuote", "|",
        "bulletedList", "numberedList", "|",
        "insertTable", "imageUpload", "mediaEmbed", "|",
        "undo", "redo"
      ],
      // If backend URL provided in cfg, pass to adapter via editor.config
      uploader: {
        uploadUrl: cfg.uploadUrl || textarea.getAttribute("data-upload-url") || "/api/blog/media/upload/"
      },
      // Allow content to be pasted as HTML
      // You can add more config here (language, image toolbar, table options, etc.)
    };

    // If ClassicEditor is not loaded, log and bail — textarea remains usable
    if (!window.ClassicEditor || typeof window.ClassicEditor.create !== "function") {
      console.warn("CKEditor script not loaded (ClassicEditor missing). Editor not initialized for", id);
      return;
    }

    // Create editor
    window.ClassicEditor.create(textarea, editorConfig)
      .then(editor => {
        // store instance for cleanup
        INSTANCES[id] = editor;

        // sync initial data: ensure textarea has current editor data (editor will handle it,
        // but we also want to keep textarea in sync for non-JS form submission)
        textarea.value = editor.getData();

        // on change: update underlying textarea
        editor.model.document.on("change:data", () => {
          textarea.value = editor.getData();
        });

        // If the form containing textarea is submitted, destroy the editor after sync
        const form = textarea.closest("form");
        if (form) {
          // prevent multiple bindings
          if (!form._ckeditorSubmitBound) {
            form.addEventListener("submit", () => {
              // ensure latest data is in textarea
              try {
                Object.keys(INSTANCES).forEach(k => {
                  const ed = INSTANCES[k];
                  if (ed && ed.getData) {
                    const ta = document.getElementById(k);
                    if (ta) ta.value = ed.getData();
                  }
                });
              } catch (e) { /* ignore */ }
            }, { once: false });
            form._ckeditorSubmitBound = true;
          }
        }
      })
      .catch(err => {
        console.error("CKEditor initialization error for", id, err);
      });
  }

  // Initialize on DOMContentLoaded
  document.addEventListener("DOMContentLoaded", () => {
    // Find all wrappers
    const wrappers = document.querySelectorAll(".admin-ckeditor-widget");
    wrappers.forEach(w => initEditorForWrapper(w));
  });

  // If admin dynamically injects fields (e.g. inlines), observe DOM additions
  const observer = new MutationObserver(mutations => {
    for (const m of mutations) {
      if (!m.addedNodes) continue;
      m.addedNodes.forEach(node => {
        if (!(node instanceof HTMLElement)) return;
        // new wrapper added
        if (node.classList && node.classList.contains("admin-ckeditor-widget")) {
          initEditorForWrapper(node);
        }
        // or wrapper inside added subtree
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

  // Cleanup on page unload (optional)
  window.addEventListener("beforeunload", () => {
    try {
      Object.keys(INSTANCES).forEach(k => {
        const ed = INSTANCES[k];
        if (ed && ed.destroy) ed.destroy();
      });
    } catch (e) { /* ignore */ }
  });
})();
