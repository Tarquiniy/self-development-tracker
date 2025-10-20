// backend/blog/static/admin/js/admin_dashboard.js
// Лёгкий и устойчивый скрипт для заполнения дашборда.
// Работает безопасно при отсутствии API. Не ломает страницу при ошибках.

(function () {
  if (typeof window === 'undefined') return;
  document.addEventListener('DOMContentLoaded', function () {
    try {
      var container = document.getElementById('dashboard-stats');
      if (!container) return;

      var cards = Array.prototype.slice.call(container.querySelectorAll('.stat-card'));
      // Пробуем получить метрики через стандартный эндпоинт (если есть).
      var endpoint = '/admin/api/dashboard-metrics/'; // optional endpoint, должен вернуть JSON
      var didUpdate = false;

      function setCard(key, value) {
        var card = container.querySelector('.stat-card[data-key="' + key + '"]');
        if (!card) return;
        var v = card.querySelector('.stat-value');
        if (v) v.textContent = value;
      }

      function setAllFallback() {
        // Без API просто проставим числа на основе DOM или дефолты
        setTimeout(function () {
          // Примеры безопасных значений, чтобы интерфейс не выглядел сломанным
          setCard('posts', '—');
          setCard('drafts', '—');
          setCard('views', '—');
          setCard('users', '—');
          setCard('media', '—');
          container.setAttribute('aria-busy', 'false');
        }, 10);
      }

      // Попробуем fetch, но при ошибке — fallback
      if (window.fetch) {
        fetch(endpoint, { credentials: 'same-origin', headers: { 'X-Requested-With': 'XMLHttpRequest' } })
          .then(function (resp) {
            if (!resp.ok) throw new Error('no-metrics');
            return resp.json();
          })
          .then(function (json) {
            // ожидаем структуру: {posts: n, drafts: n, views_7d: n, users: n, media: n}
            if (json && typeof json === 'object') {
              if (json.posts !== undefined) setCard('posts', json.posts);
              if (json.drafts !== undefined) setCard('drafts', json.drafts);
              if (json.views_7d !== undefined) setCard('views', json.views_7d);
              if (json.users !== undefined) setCard('users', json.users);
              if (json.media !== undefined) setCard('media', json.media);
              didUpdate = true;
            }
            container.setAttribute('aria-busy', 'false');
          })
          .catch(function () {
            // Если API нет или ошибка, делаем аккуратный fallback
            setAllFallback();
          });
      } else {
        setAllFallback();
      }

      // Также попытка извлечь численные значения прямо из DOM (если присутствуют)
      if (!didUpdate) {
        // нет гарантии, но если админ подключил скрипт сервера, он мог положить data-* напр.
        cards.forEach(function (card) {
          var key = card.getAttribute('data-key');
          var dataVal = card.getAttribute('data-value');
          if (dataVal) setCard(key, dataVal);
        });
      }

    } catch (e) {
      if (window.console) console.error('[admin_dashboard] init error', e);
    }
  });
})();
