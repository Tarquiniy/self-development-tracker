// backend/blog/static/admin/js/media_widget.js
(function () {
  function openMediaPicker(fieldId) {
    // open popup; media library should support select mode
    var url = '/admin/media-library/?select=1&field=' + encodeURIComponent(fieldId);
    var w = window.open(url, 'media-library', 'width=1100,height=700');
    if (w) w.focus();
  }

  document.addEventListener('click', function (e) {
    var openBtn = e.target.closest('.media-widget-open');
    if (openBtn) {
      var field = openBtn.getAttribute('data-field');
      openMediaPicker(field);
      return;
    }
    var clearBtn = e.target.closest('.media-widget-clear');
    if (clearBtn) {
      var field = clearBtn.getAttribute('data-field');
      var input = document.getElementById(field);
      if (input) {
        input.value = '';
        var container = document.getElementById('media-widget-' + field);
        if (container) {
          var preview = container.querySelector('.media-widget-preview');
          if (preview) preview.innerHTML = '<div class="placeholder">Изображение не выбрано</div>';
        }
      }
      return;
    }
  });

  // listen for selection from media-library popup
  window.addEventListener('message', function (ev) {
    try {
      var msg = ev.data;
      if (!msg) return;
      // accept either 'media-selected' or 'media-library-selected' types (backwards comp)
      if (msg.type !== 'media-selected' && msg.type !== 'media-library-selected' && msg.type !== 'media-selected-v2') return;
      var field = msg.field;
      var url = msg.url;
      if (!field || !url) return;
      var input = document.getElementById(field);
      if (!input) {
        // try id_featured_image fallback
        input = document.getElementById('id_featured_image');
      }
      if (!input) return;
      input.value = url;

      var container = document.getElementById('media-widget-' + field);
      if (container) {
        var preview = container.querySelector('.media-widget-preview');
        if (preview) {
          preview.innerHTML = '<img src="' + url + '" alt="" style="max-width:100%;max-height:160px;object-fit:cover;border-radius:6px">';
        }
      }
    } catch (err) {
      console.error('media_widget message handler error', err);
    }
  }, false);
})();
