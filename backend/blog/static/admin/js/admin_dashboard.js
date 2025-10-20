// Простой и безопасный инициализатор дашборда для админки.
// Инициирует Chart.js если он доступен и подставляет данные из html.
document.addEventListener('DOMContentLoaded', function () {
  try {
    // helper to read JSON from element created via json_script or our legacy approach
    function readJsonById(id) {
      var el = document.getElementById(id);
      if (!el) return [];
      // если элемент содержит JSON в textContent через json_script Django
      try {
        return JSON.parse(el.textContent || el.innerText || '[]');
      } catch (e) {
        return [];
      }
    }

    var labels = readJsonById('pt-dashboard-labels') || [];
    var posts = readJsonById('pt-dashboard-posts') || [];
    var comments = readJsonById('pt-dashboard-comments') || [];
    var views = readJsonById('pt-dashboard-views') || [];

    var canvas = document.getElementById('pt-stats-chart');
    if (canvas && window.Chart && typeof Chart === 'function') {
      var ctx = canvas.getContext('2d');
      new Chart(ctx, {
        type: 'line',
        data: {
          labels: labels,
          datasets: [
            { label: 'Посты', data: posts, fill: false, tension: 0.2 },
            { label: 'Комментарии', data: comments, fill: false, tension: 0.2 },
            { label: 'Просмотры', data: views, fill: false, tension: 0.2, hidden: true },
          ]
        },
        options: {
          responsive: true,
          interaction: { mode: 'index', intersect: false },
          plugins: { legend: { position: 'top' }, tooltip: { enabled: true } },
          scales: { x: { display: true }, y: { beginAtZero: true } }
        }
      });
    }

  } catch (e) {
    // ни в коем случае не ломаем админ при ошибке дашборда
    if (window.console) console.error('[pt-admin-dashboard] init error', e);
  }
});
