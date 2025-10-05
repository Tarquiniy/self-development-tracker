// Safe TipTap initializer for admin post form.
// Defines window.initAdminTipTap() — called from admin template.
// Graceful fallback: if TipTap not available, we create a contentEditable area
// and sync it with the textarea (#id_content). Never throws to the outer code.
(function () {
  window.initAdminTipTap = function initAdminTipTap() {
    try {
      var textarea = document.getElementById('id_content') || document.querySelector('textarea[name="content"]');
      if (!textarea) return;

      // prevent double init
      if (textarea.dataset.tiptapInitialized) return;
      textarea.dataset.tiptapInitialized = '1';

      // create container
      var container = document.createElement('div');
      container.className = 'tiptap-editor-container';
      // insert after textarea
      textarea.style.display = 'none';
      textarea.parentNode.insertBefore(container, textarea.nextSibling);

      // Helper: safe access for UMD bundles
      var TipTapCore = window['@tiptap/core'] || window.tiptap || window.TipTap || null;
      var StarterKit = window['@tiptap/starter-kit'] || window.tiptapStarterKit || null;
      var Lowlight = window['@tiptap/extension-code-block-lowlight'] || null;
      var ImageExt = window['@tiptap/extension-image'] || null;
      var LinkExt = window['@tiptap/extension-link'] || null;

      // If user provided a global initializer, prefer it (custom integration)
      if (typeof window.tiptapAdminInit === 'function') {
        try {
          window.tiptapAdminInit(container, textarea);
          return;
        } catch (e) {
          console.warn('tiptapAdminInit failed, falling back', e);
        }
      }

      // Try TipTap if it looks available
      if (TipTapCore && (TipTapCore.Editor || TipTapCore.default && TipTapCore.default.Editor)) {
        try {
          // resolve Editor and StarterKit in various UMD shapes
          var Editor = TipTapCore.Editor || (TipTapCore.default && TipTapCore.default.Editor) || window.Editor || null;
          var Starter = StarterKit && (StarterKit.StarterKit || StarterKit.default) ? (StarterKit.StarterKit || StarterKit.default || StarterKit) : StarterKit;
          // In some UMD builds StarterKit is directly a function/object; attempt to pick something workable
          if (!Editor || !Starter) throw new Error('Editor or StarterKit not detected in window globals');

          // create editor
          var editor = new Editor({
            element: container,
            extensions: (function () {
              var ext = [];
              try { if (Starter) ext.push(Starter); } catch (_) {}
              try { if (ImageExt) ext.push(ImageExt); } catch (_) {}
              try { if (LinkExt) ext.push(LinkExt); } catch (_) {}
              try { if (Lowlight) ext.push(Lowlight); } catch (_) {}
              return ext;
            })(),
            content: textarea.value || '',
            onUpdate: function (props) {
              try {
                // Editor API may vary; try getHTML()
                var html = (props && props.editor && typeof props.editor.getHTML === 'function') ? props.editor.getHTML() : (props.editor && props.editor.state ? props.editor.getHTML() : '');
                if (typeof html === 'string') {
                  textarea.value = html;
                }
              } catch (e) {
                // swallow
              }
            }
          });

          // initial sync (ensure textarea contains current editor html)
          try { if (typeof editor.getHTML === 'function') textarea.value = editor.getHTML(); } catch (e) {}
          // expose for debugging
          container._tiptap_editor = editor;
          return;
        } catch (e) {
          console.warn('TipTap init attempt failed — fallback to simpler editor', e);
          // remove container and fallback to contentEditable below
          try { container.innerHTML = ''; } catch (_) {}
        }
      }

      // Fallback: simple contentEditable rich area
      try {
        var ed = document.createElement('div');
        ed.className = 'tiptap-fallback';
        ed.contentEditable = true;
        ed.innerHTML = textarea.value || '';
        ed.addEventListener('input', function () {
          textarea.value = ed.innerHTML;
        });
        // simple paste cleanup: keep innerHTML
        ed.addEventListener('paste', function (e) {
          e.preventDefault();
          var text = (e.clipboardData || window.clipboardData).getData('text/plain');
          document.execCommand('insertText', false, text);
        });
        container.appendChild(ed);
        return;
      } catch (e) {
        console.error('Fallback editor init failed', e);
        // last resort: unhide textarea
        textarea.style.display = '';
        if (container && container.parentNode) container.parentNode.removeChild(container);
        delete textarea.dataset.tiptapInitialized;
      }
    } catch (err) {
      // never escalate to break admin page
      console.error('initAdminTipTap error', err);
      try { var ta = document.getElementById('id_content'); if (ta) ta.style.display = ''; } catch (_) {}
    }
  }; // end initAdminTipTap
})();
