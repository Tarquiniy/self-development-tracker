// backend/blog/static/admin/js/admin-modern.js
// Modern Admin JavaScript - 2025 Edition

class ModernAdmin {
    constructor() {
        this.init();
    }

    init() {
        this.initSidebar();
        this.initCards();
        this.initForms();
        this.initNotifications();
        this.initQuickActions();
        this.initResponsive();
    }

    initSidebar() {
        // Активное состояние меню
        const currentPath = window.location.pathname;
        document.querySelectorAll('.sidebar-list a').forEach(link => {
            if (link.getAttribute('href') === currentPath) {
                link.classList.add('active');
            }
        });

        // Плавная прокрутка
        document.querySelectorAll('a[href^="#"]').forEach(anchor => {
            anchor.addEventListener('click', function (e) {
                e.preventDefault();
                const target = document.querySelector(this.getAttribute('href'));
                if (target) {
                    target.scrollIntoView({
                        behavior: 'smooth',
                        block: 'start'
                    });
                }
            });
        });
    }

    initCards() {
        // Анимация карточек при появлении
        const observer = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    entry.target.style.animation = 'fadeIn 0.6s ease-out';
                }
            });
        });

        document.querySelectorAll('.card').forEach(card => {
            observer.observe(card);
        });
    }

    initForms() {
        // Улучшенная валидация форм
        document.querySelectorAll('form').forEach(form => {
            form.addEventListener('submit', (e) => {
                const requiredFields = form.querySelectorAll('[required]');
                let isValid = true;

                requiredFields.forEach(field => {
                    if (!field.value.trim()) {
                        this.showError(field, 'Это поле обязательно для заполнения');
                        isValid = false;
                    } else {
                        this.clearError(field);
                    }
                });

                if (!isValid) {
                    e.preventDefault();
                    this.showNotification('Пожалуйста, заполните все обязательные поля', 'error');
                }
            });
        });

        // Динамические счетчики символов
        document.querySelectorAll('textarea, input[type="text"]').forEach(field => {
            const counter = field.parentNode.querySelector('.char-counter');
            if (counter) {
                field.addEventListener('input', () => {
                    const length = field.value.length;
                    const maxLength = field.maxLength || Infinity;
                    
                    counter.textContent = `${length} / ${maxLength}`;
                    
                    if (length > maxLength * 0.9) {
                        counter.classList.add('warning');
                    } else {
                        counter.classList.remove('warning');
                    }
                    
                    if (length > maxLength) {
                        counter.classList.add('error');
                    } else {
                        counter.classList.remove('error');
                    }
                });
            }
        });
    }

    initNotifications() {
        // Система уведомлений
        this.notificationContainer = document.createElement('div');
        this.notificationContainer.className = 'notification-container';
        this.notificationContainer.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            z-index: 10000;
            display: flex;
            flex-direction: column;
            gap: 10px;
        `;
        document.body.appendChild(this.notificationContainer);
    }

    showNotification(message, type = 'info', duration = 5000) {
        const notification = document.createElement('div');
        notification.className = `notification notification-${type}`;
        notification.style.cssText = `
            background: var(--card);
            color: var(--text);
            padding: 16px 20px;
            border-radius: 8px;
            box-shadow: var(--shadow-lg);
            border-left: 4px solid var(--${type});
            animation: slideInRight 0.3s ease-out;
            max-width: 300px;
        `;
        
        notification.innerHTML = `
            <div style="font-weight: 600; margin-bottom: 4px;">${this.getNotificationTitle(type)}</div>
            <div style="font-size: 14px;">${message}</div>
        `;

        this.notificationContainer.appendChild(notification);

        setTimeout(() => {
            notification.style.animation = 'slideOutRight 0.3s ease-in';
            setTimeout(() => notification.remove(), 300);
        }, duration);
    }

    getNotificationTitle(type) {
        const titles = {
            info: 'ℹ️ Информация',
            success: '✅ Успех',
            warning: '⚠️ Внимание',
            error: '❌ Ошибка'
        };
        return titles[type] || titles.info;
    }

    showError(field, message) {
        this.clearError(field);
        
        field.style.borderColor = 'var(--danger)';
        
        const errorDiv = document.createElement('div');
        errorDiv.className = 'field-error';
        errorDiv.style.cssText = `
            color: var(--danger);
            font-size: 12px;
            margin-top: 4px;
        `;
        errorDiv.textContent = message;
        
        field.parentNode.appendChild(errorDiv);
    }

    clearError(field) {
        field.style.borderColor = '';
        const existingError = field.parentNode.querySelector('.field-error');
        if (existingError) {
            existingError.remove();
        }
    }

    initQuickActions() {
        // Быстрые действия для карточек
        document.querySelectorAll('.card').forEach(card => {
            card.addEventListener('click', (e) => {
                if (e.target.classList.contains('quick-action')) {
                    e.preventDefault();
                    this.handleQuickAction(e.target.dataset.action, card);
                }
            });
        });
    }

    handleQuickAction(action, element) {
        switch (action) {
            case 'preview':
                this.showNotification('Функция предпросмотра в разработке', 'info');
                break;
            case 'edit':
                window.location.href = element.querySelector('a').href;
                break;
            case 'delete':
                if (confirm('Вы уверены, что хотите удалить этот элемент?')) {
                    this.showNotification('Элемент удален', 'success');
                }
                break;
        }
    }

    initResponsive() {
        // Адаптивное поведение
        const updateLayout = () => {
            const width = window.innerWidth;
            if (width < 768) {
                document.body.classList.add('mobile-view');
            } else {
                document.body.classList.remove('mobile-view');
            }
        };

        window.addEventListener('resize', updateLayout);
        updateLayout();
    }

    // Утилиты
    debounce(func, wait) {
        let timeout;
        return function executedFunction(...args) {
            const later = () => {
                clearTimeout(timeout);
                func(...args);
            };
            clearTimeout(timeout);
            timeout = setTimeout(later, wait);
        };
    }

    formatFileSize(bytes) {
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    }

    formatDate(dateString) {
        return new Date(dateString).toLocaleDateString('ru-RU', {
            year: 'numeric',
            month: 'long',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    }
}

// Инициализация при загрузке DOM
document.addEventListener('DOMContentLoaded', () => {
    window.modernAdmin = new ModernAdmin();
});

// CSS анимации для уведомлений
const style = document.createElement('style');
style.textContent = `
    @keyframes slideInRight {
        from {
            transform: translateX(100%);
            opacity: 0;
        }
        to {
            transform: translateX(0);
            opacity: 1;
        }
    }
    
    @keyframes slideOutRight {
        from {
            transform: translateX(0);
            opacity: 1;
        }
        to {
            transform: translateX(100%);
            opacity: 0;
        }
    }
    
    .mobile-view .admin-sidebar {
        position: fixed;
        top: 0;
        left: -100%;
        height: 100vh;
        z-index: 1000;
        transition: left 0.3s ease;
    }
    
    .mobile-view .admin-sidebar.active {
        left: 0;
    }
`;
document.head.appendChild(style);