// backend/blog/static/admin/admin.js
(function () {
    // helper: get csrftoken from cookie
    function getCookie(name) {
        if (!document.cookie) return null;
        const cookies = document.cookie.split(';').map(c => c.trim());
        for (let c of cookies) {
            if (c.startsWith(name + '=')) {
                return decodeURIComponent(c.split('=')[1]);
            }
        }
        return null;
    }

    const csrftoken = getCookie('csrftoken');

    // Elements
    const daysSelect = document.getElementById('dashboard-days');
    const quickActionsContainer = document.getElementById('quick-actions-container');

    // Chart.js instance
    let activityChart = null;

    function fetchAndRender(days = 30) {
        const url = `/admin/dashboard/stats-data/?days=${days}`;
        fetch(url, { credentials: 'same-origin' })
            .then(r => {
                if (!r.ok) throw new Error('Ошибка получения статистики');
                return r.json();
            })
            .then(data => {
                renderChart(data);
            })
            .catch(err => {
                console.error(err);
            });
    }

    function renderChart(data) {
        const ctx = document.getElementById('activityChart').getContext('2d');

        const labels = data.labels.map(d => (new Date(d)).toLocaleDateString());

        const datasets = [
            {
                label: 'Посты',
                data: data.posts,
                tension: 0.2,
                borderWidth: 2,
                fill: false,
            },
            {
                label: 'Комментарии',
                data: data.comments,
                tension: 0.2,
                borderWidth: 2,
                fill: false,
            },
            {
                label: 'Просмотры',
                data: data.views,
                tension: 0.2,
                borderWidth: 2,
                fill: false,
            }
        ];

        // If chart exists, update, else create
        if (activityChart) {
            activityChart.data.labels = labels;
            activityChart.data.datasets = datasets;
            activityChart.update();
            return;
        }

        activityChart = new Chart(ctx, {
            type: 'line',
            data: {
                labels,
                datasets
            },
            options: {
                responsive: true,
                plugins: {
                    legend: { position: 'top' }
                },
                scales: {
                    y: { beginAtZero: true, ticks: { precision: 0 } }
                }
            }
        });
    }

    // Quick actions: wire the buttons in "Последние посты"
    function bindQuickActionButtons() {
        document.querySelectorAll('.quick-action-btn').forEach(btn => {
            btn.addEventListener('click', function (e) {
                e.preventDefault();
                const postId = this.dataset.postId;
                const action = this.dataset.action;
                if (!postId || !action) return;

                if (!confirm('Вы уверены? Действие: ' + action)) return;

                // Send to quick action endpoint
                fetch('/api/blog/admin/quick-action/', {
                    method: 'POST',
                    credentials: 'same-origin',
                    headers: {
                        'Content-Type': 'application/json',
                        'X-CSRFToken': csrftoken
                    },
                    body: JSON.stringify({ action, post_id: postId })
                })
                .then(r => r.json())
                .then(json => {
                    if (json.success) {
                        alert(json.message || 'OK');
                        // refresh page to reflect changes
                        window.location.reload();
                    } else {
                        alert('Ошибка: ' + (json.message || 'unknown'));
                    }
                })
                .catch(err => {
                    console.error(err);
                    alert('Network error');
                });
            });
        });
    }

    // init
    function init() {
        const initialDays = daysSelect ? parseInt(daysSelect.value || '30') : 30;
        fetchAndRender(initialDays);
        daysSelect && daysSelect.addEventListener('change', function () {
            const days = parseInt(this.value);
            fetchAndRender(days);
        });

        bindQuickActionButtons();
    }

    // run on DOMContentLoaded
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
