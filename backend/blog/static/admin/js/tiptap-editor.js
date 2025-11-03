// backend/blog/static/admin/js/tiptap-editor.js
(function () {
  window.initAdminTipTap = window.initAdminTipTap || function initAdminTipTapFallback() {
    try {
      var textarea = document.getElementById('id_content') || document.querySelector('textarea[name="content"]');
      if (!textarea) return;
      if (textarea.dataset.tiptapInitialized) return;
      textarea.dataset.tiptapInitialized = '1';
      textarea.style.display = 'none';
      var container = document.createElement('div');
      container.className = 'tiptap-editor-container';
      textarea.parentNode.insertBefore(container, textarea.nextSibling);

      // fallback contentEditable
      var ed = document.createElement('div');
      ed.className = 'tiptap-fallback';
      ed.contentEditable = true;
      ed.innerHTML = textarea.value || '';
      ed.addEventListener('input', function () { textarea.value = ed.innerHTML; });
      container.appendChild(ed);
    } catch (err) {
      console.error('initAdminTipTap fallback error', err);
      try { var ta = document.querySelector('textarea[name="content"]'); if (ta) ta.style.display = ''; } catch (e) {}
    }
  };
})();