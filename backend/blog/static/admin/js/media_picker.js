// blog/static/admin/js/media_picker.js
(function () {
  window.openMediaPicker = function (callback) {
    // Simple AJAX call to our admin media library listing (JSON)
    fetch('/admin/media-library/?format=json', { credentials: 'same-origin' })
      .then(function (r) { return r.json(); })
      .then(function (data) {
        var list = data.attachments || data;
        // simple modal
        var modal = document.createElement('div');
        modal.className = 'aae-modal';
        modal.innerHTML = '<div class="aae-modal-inner"><h3>Выбрать файл</h3><div class="aae-attach-list"></div><div style="margin-top:10px"><button class="aae-close">Закрыть</button></div></div>';
        document.body.appendChild(modal);
        var listNode = modal.querySelector('.aae-attach-list');
        list.forEach(function (a) {
          var item = document.createElement('div');
          item.className = 'aae-attach';
          item.innerHTML = '<img class="aae-thumb" src="' + (a.url || '') + '" /><div class="aae-meta"><div>' + (a.title||'') + '</div><div><button class="aae-select">Выбрать</button></div></div>';
          listNode.appendChild(item);
          item.querySelector('.aae-select').addEventListener('click', function () {
            try { callback && callback(a); } catch (e) { console.error(e); }
            document.body.removeChild(modal);
          });
        });
        modal.querySelector('.aae-close').addEventListener('click', function () {
          document.body.removeChild(modal);
        });
      }).catch(function (err) {
        alert('Не удалось получить медиа-библиотеку');
        console.error(err);
      });
  };
})();