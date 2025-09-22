document.addEventListener('DOMContentLoaded', function() {
    // Улучшение интерфейса админки
    enhanceAdminInterface();
    
    // Обработчики для кнопок действий
    setupActionHandlers();
    
    // Динамическое обновление статистики
    setupStatistics();
    
    // Улучшение фильтров
    enhanceFilters();
});

function enhanceAdminInterface() {
    // Добавляем индикатор загрузки для форм
    const forms = document.querySelectorAll('form');
    forms.forEach(form => {
        form.addEventListener('submit', function() {
            const submitBtn = this.querySelector('input[type="submit"], button[type="submit"]');
            if (submitBtn) {
                submitBtn.disabled = true;
                submitBtn.value = 'Сохранение...';
                if (submitBtn.tagName === 'BUTTON') {
                    submitBtn.textContent = 'Сохранение...';
                }
            }
        });
    });
    
    // Добавляем подтверждение для опасных действий
    const dangerousLinks = document.querySelectorAll('a[href*="delete"], .deletelink');
    dangerousLinks.forEach(link => {
        link.addEventListener('click', function(e) {
            if (!confirm('Вы уверены, что хотите удалить этот элемент?')) {
                e.preventDefault();
            }
        });
    });
    
    // Улучшаем отображение дат
    enhanceDateDisplay();
}

function setupActionHandlers() {
    // Быстрые действия для постов
    const actionButtons = document.querySelectorAll('.quick-action-btn');
    actionButtons.forEach(btn => {
        btn.addEventListener('click', function() {
            const action = this.dataset.action;
            const postId = this.dataset.postId;
            handleQuickAction(action, postId);
        });
    });
}

function handleQuickAction(action, postId) {
    const csrfToken = getCookie('csrftoken');
    
    fetch('/admin/blog/post/quick-action/', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'X-CSRFToken': csrfToken
        },
        body: JSON.stringify({
            action: action,
            post_id: postId
        })
    })
    .then(response => response.json())
    .then(data => {
        if (data.success) {
            showMessage(data.message, 'success');
            // Обновляем интерфейс
            setTimeout(() => {
                window.location.reload();
            }, 1000);
        } else {
            showMessage(data.message, 'error');
        }
    })
    .catch(error => {
        showMessage('Ошибка при выполнении действия', 'error');
    });
}

function setupStatistics() {
    // Обновляем статистику каждые 30 секунд
    setInterval(updateStats, 30000);
}

function updateStats() {
    const statsContainers = document.querySelectorAll('.stats-container');
    if (statsContainers.length > 0) {
        fetch('/admin/blog/dashboard-stats/')
            .then(response => response.json())
            .then(data => {
                updateStatsDisplay(data);
            });
    }
}

function updateStatsDisplay(stats) {
    // Обновляем отображение статистики
    for (const [key, value] of Object.entries(stats)) {
        const element = document.querySelector(`.stat-${key}`);
        if (element) {
            element.textContent = value;
        }
    }
}

function enhanceFilters() {
    // Добавляем поиск в выпадающие списки фильтров
    const filterSelects = document.querySelectorAll('#changelist-filter select');
    filterSelects.forEach(select => {
        const wrapper = document.createElement('div');
        wrapper.className = 'filter-search-wrapper';
        wrapper.innerHTML = `
            <input type="text" class="filter-search" placeholder="Поиск...">
        `;
        select.parentNode.insertBefore(wrapper, select);
        
        const searchInput = wrapper.querySelector('.filter-search');
        searchInput.addEventListener('input', function() {
            const searchTerm = this.value.toLowerCase();
            const options = select.querySelectorAll('option');
            
            options.forEach(option => {
                const text = option.textContent.toLowerCase();
                if (text.includes(searchTerm)) {
                    option.style.display = '';
                } else {
                    option.style.display = 'none';
                }
            });
        });
    });
}

function enhanceDateDisplay() {
    // Форматируем даты в относительном времени
    const dateElements = document.querySelectorAll('.date-time');
    dateElements.forEach(element => {
        const dateText = element.textContent;
        if (dateText) {
            const date = new Date(dateText);
            const relativeTime = getRelativeTime(date);
            element.title = date.toLocaleString('ru-RU');
            element.textContent = relativeTime;
        }
    });
}

function getRelativeTime(date) {
    const now = new Date();
    const diffMs = now - date;
    const diffMins = Math.round(diffMs / 60000);
    const diffHours = Math.round(diffMs / 3600000);
    const diffDays = Math.round(diffMs / 86400000);
    
    if (diffMins < 1) return 'только что';
    if (diffMins < 60) return `${diffMins} мин. назад`;
    if (diffHours < 24) return `${diffHours} ч. назад`;
    if (diffDays < 7) return `${diffDays} дн. назад`;
    
    return date.toLocaleDateString('ru-RU');
}

function showMessage(message, type) {
    // Показываем уведомление
    const messageDiv = document.createElement('div');
    messageDiv.className = `message ${type}`;
    messageDiv.textContent = message;
    messageDiv.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        padding: 15px;
        border-radius: 4px;
        color: white;
        z-index: 10000;
        animation: slideIn 0.3s ease-out;
    `;
    
    if (type === 'success') {
        messageDiv.style.background = 'var(--success-color)';
    } else if (type === 'error') {
        messageDiv.style.background = 'var(--error-color)';
    } else {
        messageDiv.style.background = 'var(--primary-color)';
    }
    
    document.body.appendChild(messageDiv);
    
    setTimeout(() => {
        messageDiv.remove();
    }, 3000);
}

function getCookie(name) {
    // Вспомогательная функция для получения CSRF токена
    let cookieValue = null;
    if (document.cookie && document.cookie !== '') {
        const cookies = document.cookie.split(';');
        for (let i = 0; i < cookies.length; i++) {
            const cookie = cookies[i].trim();
            if (cookie.substring(0, name.length + 1) === (name + '=')) {
                cookieValue = decodeURIComponent(cookie.substring(name.length + 1));
                break;
            }
        }
    }
    return cookieValue;
}

// CSS анимации
const style = document.createElement('style');
style.textContent = `
    @keyframes slideIn {
        from {
            transform: translateX(100%);
            opacity: 0;
        }
        to {
            transform: translateX(0);
            opacity: 1;
        }
    }
    
    .filter-search-wrapper {
        margin-bottom: 10px;
    }
    
    .filter-search {
        width: 100%;
        padding: 5px;
        border: 1px solid #ccc;
        border-radius: 3px;
    }
    
    .quick-action-btn {
        margin: 2px;
        padding: 4px 8px;
        border: none;
        border-radius: 3px;
        cursor: pointer;
        font-size: 12px;
    }
    
    .quick-action-btn.publish {
        background: var(--success-color);
        color: white;
    }
    
    .quick-action-btn.draft {
        background: var(--warning-color);
        color: white;
    }
    
    .quick-action-btn.archive {
        background: var(--error-color);
        color: white;
    }
`;
document.head.appendChild(style);