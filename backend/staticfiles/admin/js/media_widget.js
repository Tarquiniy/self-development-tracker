// backend/blog/static/admin/js/media_widget.js
(function () {
  function openMediaPicker(fieldId) {
    // open the admin media library — use attach params if opener has post id in URL
    // Try to read post id from current admin change URL (opener is admin edit page)
    var openerPath = window.location.pathname || '';
    // But for widget we are on admin edit page, so open popup referencing itself (no opener)
    // The media library path we expect: /admin/media-library/
    var url = '/admin/media-library/?select=1&field=' + encodeURIComponent(fieldId);
    // If current window is child and has opener, we won't be in that case here.
    var w = window.open(url, 'media-library', 'width=1100,height=700');
    if (w) w.focus();
  }

  document.addEventListener('click', function (e) {
    var btn = e.target.closest('.media-widget-open');
    if (!btn) return;
    var fieldId = btn.getAttribute('data-field');
    openMediaPicker(fieldId);
  });

  // Listen for selection messages from media library popup
  window.addEventListener('message', function (ev) {
    try {
      var msg = ev.data;
      if (!msg || (msg.type !== 'media-selected' && msg.type !== 'media-library-selected' && msg.type !== 'media-selected-v2')) return;
      var field = msg.field;
      var url = msg.url;
      if (!field || !url) return;
      var input = document.getElementById(field);
      if (!input) return;
      input.value = url;

      // update preview
      var container = document.getElementById('media-widget-' + field);
      if (container) {
        var preview = container.querySelector('.media-widget-preview');
        if (preview) {
          preview.innerHTML = '<img src="' + url + '" alt="" style="max-width:100%; max-height:160px; object-fit:cover; border-radius:6px;">';
        }
      }
    } catch (e) {
      console.error('media_widget message handler error', e);
    }
  }, false);
})();
