// dashboard.js — инициализация графика Chart.js и небольшая логика
document.addEventListener('DOMContentLoaded', function () {
  try {
    const labels = JSON.parse(document.getElementById('pt-dashboard-labels')?.textContent || '[]');
    const posts = JSON.parse(document.getElementById('pt-dashboard-posts')?.textContent || '[]');
    const comments = JSON.parse(document.getElementById('pt-dashboard-comments')?.textContent || '[]');
    const views = JSON.parse(document.getElementById('pt-dashboard-views')?.textContent || '[]');

    const ctx = document.getElementById('pt-stats-chart');
    if (ctx && window.Chart) {
      new Chart(ctx.getContext('2d'), {
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
          plugins: {
            legend: { position: 'top' },
            tooltip: { enabled: true }
          },
          scales: {
            x: { display: true, title: { display: false } },
            y: { beginAtZero: true }
          }
        }
      });
    }
  } catch (e) {
    // если что-то пошло не так — не ломать страницу
    console.error('[pt-dashboard] chart init failed', e);
  }
});
