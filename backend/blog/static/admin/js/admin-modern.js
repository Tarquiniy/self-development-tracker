// backend/blog/static/admin/js/admin-modern.js
// Modern Admin Dashboard - Interactive Features

class ModernAdmin {
    constructor() {
        this.init();
    }

    init() {
        this.initSidebar();
        this.initSearch();
        this.initUserMenu();
        this.initStats();
        this.initQuickActions();
        this.initCharts();
        this.initResponsive();
        this.initNotifications();
    }

    initSidebar() {
        // Active state management
        const currentPath = window.location.pathname;
        document.querySelectorAll('.nav-item').forEach(item => {
            if (item.getAttribute('href') === currentPath) {
                item.classList.add('active');
            }
        });

        // Mobile sidebar toggle
        const sidebarToggle = document.createElement('button');
        sidebarToggle.className = 'sidebar-toggle';
        sidebarToggle.innerHTML = `
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                <path d="M3 5H17M3 10H17M3 15H17" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
            </svg>
        `;
        
        sidebarToggle.addEventListener('click', () => {
            document.querySelector('.admin-sidebar').classList.toggle('mobile-open');
        });

        // Add toggle button on mobile
        if (window.innerWidth < 1024) {
            document.querySelector('.nav-container').prepend(sidebarToggle);
        }
    }

    initSearch() {
        const searchInput = document.querySelector('.search-input');
        if (!searchInput) return;

        let searchTimeout;
        
        searchInput.addEventListener('input', (e) => {
            clearTimeout(searchTimeout);
            searchTimeout = setTimeout(() => {
                this.performSearch(e.target.value);
            }, 300);
        });

        // Quick search shortcuts
        document.addEventListener('keydown', (e) => {
            if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
                e.preventDefault();
                searchInput.focus();
            }
        });
    }

    async performSearch(query) {
        if (query.length < 2) return;

        try {
            // Show loading state
            this.showNotification('Searching...', 'info');
            
            // In a real implementation, this would be an API call
            console.log('Searching for:', query);
            
            // Simulate search results
            setTimeout(() => {
                this.showNotification(`Found results for "${query}"`, 'success');
            }, 500);
            
        } catch (error) {
            this.showNotification('Search failed', 'error');
        }
    }

    initUserMenu() {
        // Close user menu when clicking outside
        document.addEventListener('click', (e) => {
            if (!e.target.closest('.user-dropdown')) {
                document.querySelector('.user-menu').style.opacity = '0';
                document.querySelector('.user-menu').style.visibility = 'hidden';
            }
        });

        // User menu keyboard navigation
        const userMenu = document.querySelector('.user-menu');
        if (userMenu) {
            userMenu.addEventListener('keydown', (e) => {
                if (e.key === 'Escape') {
                    userMenu.style.opacity = '0';
                    userMenu.style.visibility = 'hidden';
                }
            });
        }
    }

    initStats() {
        // Animate stat counters
        const statValues = document.querySelectorAll('.stat-value');
        
        const observer = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    this.animateValue(entry.target);
                    observer.unobserve(entry.target);
                }
            });
        });

        statValues.forEach(stat => observer.observe(stat));
    }

    animateValue(element) {
        const target = parseInt(element.textContent);
        const duration = 1500;
        const step = target / (duration / 16);
        let current = 0;

        const timer = setInterval(() => {
            current += step;
            if (current >= target) {
                element.textContent = target.toLocaleString();
                clearInterval(timer);
            } else {
                element.textContent = Math.floor(current).toLocaleString();
            }
        }, 16);
    }

    initQuickActions() {
        // Add hover effects to action cards
        document.querySelectorAll('.action-card').forEach(card => {
            card.addEventListener('mouseenter', () => {
                card.style.transform = 'translateY(-4px) scale(1.02)';
            });
            
            card.addEventListener('mouseleave', () => {
                card.style.transform = 'translateY(0) scale(1)';
            });
        });
    }

    initCharts() {
        // Initialize charts if Chart.js is available
        if (typeof Chart !== 'undefined') {
            this.initTrafficChart();
            this.initActivityChart();
        }
    }

    initTrafficChart() {
        const ctx = document.getElementById('trafficChart');
        if (!ctx) return;

        new Chart(ctx, {
            type: 'line',
            data: {
                labels: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun'],
                datasets: [{
                    label: 'Page Views',
                    data: [65, 78, 90, 81, 86, 95],
                    borderColor: '#3b82f6',
                    backgroundColor: 'rgba(59, 130, 246, 0.1)',
                    tension: 0.4,
                    fill: true
                }]
            },
            options: {
                responsive: true,
                plugins: {
                    legend: {
                        display: false
                    }
                },
                scales: {
                    y: {
                        beginAtZero: true
                    }
                }
            }
        });
    }

    initActivityChart() {
        const ctx = document.getElementById('activityChart');
        if (!ctx) return;

        new Chart(ctx, {
            type: 'bar',
            data: {
                labels: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
                datasets: [{
                    label: 'Posts',
                    data: [12, 19, 8, 15, 12, 5, 3],
                    backgroundColor: '#10b981'
                }, {
                    label: 'Comments',
                    data: [8, 12, 6, 10, 7, 8, 4],
                    backgroundColor: '#3b82f6'
                }]
            },
            options: {
                responsive: true,
                scales: {
                    x: {
                        stacked: true
                    },
                    y: {
                        stacked: true
                    }
                }
            }
        });
    }

    initResponsive() {
        // Handle window resize
        let resizeTimeout;
        window.addEventListener('resize', () => {
            clearTimeout(resizeTimeout);
            resizeTimeout = setTimeout(() => {
                this.handleResize();
            }, 250);
        });

        // Initial check
        this.handleResize();
    }

    handleResize() {
        const sidebar = document.querySelector('.admin-sidebar');
        const isMobile = window.innerWidth < 1024;

        if (isMobile) {
            sidebar.classList.remove('mobile-open');
        } else {
            sidebar.classList.remove('mobile-open');
        }
    }

    initNotifications() {
        // Notification system
        this.notificationContainer = document.createElement('div');
        this.notificationContainer.className = 'notification-container';
        this.notificationContainer.style.cssText = `
            position: fixed;
            top: 80px;
            right: 20px;
            z-index: 10000;
            display: flex;
            flex-direction: column;
            gap: 10px;
            max-width: 400px;
        `;
        document.body.appendChild(this.notificationContainer);
    }

    showNotification(message, type = 'info', duration = 5000) {
        const notification = document.createElement('div');
        notification.className = `notification notification-${type}`;
        notification.style.cssText = `
            background: white;
            color: var(--gray-700);
            padding: 16px 20px;
            border-radius: 12px;
            box-shadow: var(--shadow-xl);
            border-left: 4px solid var(--${type}-500);
            animation: slideInRight 0.3s ease-out;
            font-weight: 500;
            display: flex;
            align-items: center;
            gap: 12px;
        `;

        const icons = {
            info: 'ℹ️',
            success: '✅',
            warning: '⚠️',
            error: '❌'
        };

        notification.innerHTML = `
            <span style="font-size: 18px;">${icons[type]}</span>
            <span>${message}</span>
        `;

        this.notificationContainer.appendChild(notification);

        // Auto remove
        setTimeout(() => {
            notification.style.animation = 'slideOutRight 0.3s ease-in';
            setTimeout(() => {
                if (notification.parentNode) {
                    notification.parentNode.removeChild(notification);
                }
            }, 300);
        }, duration);

        // Manual dismiss
        notification.addEventListener('click', () => {
            notification.style.animation = 'slideOutRight 0.3s ease-in';
            setTimeout(() => {
                if (notification.parentNode) {
                    notification.parentNode.removeChild(notification);
                }
            }, 300);
        });
    }

    // Utility methods
    formatNumber(num) {
        if (num >= 1000000) {
            return (num / 1000000).toFixed(1) + 'M';
        }
        if (num >= 1000) {
            return (num / 1000).toFixed(1) + 'K';
        }
        return num.toString();
    }

    formatDate(date) {
        return new Date(date).toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'short',
            day: 'numeric'
        });
    }

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
}

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    window.admin = new ModernAdmin();
});

// Add CSS animations
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
    
    .sidebar-toggle {
        display: none;
        background: none;
        border: none;
        color: var(--gray-600);
        padding: 8px;
        border-radius: 6px;
        cursor: pointer;
    }
    
    @media (max-width: 1024px) {
        .sidebar-toggle {
            display: block;
        }
        
        .admin-sidebar {
            transform: translateX(-100%);
            transition: transform 0.3s ease;
        }
        
        .admin-sidebar.mobile-open {
            transform: translateX(0);
        }
    }
    
    .loading {
        opacity: 0.7;
        pointer-events: none;
        position: relative;
    }
    
    .loading::after {
        content: '';
        position: absolute;
        top: 50%;
        left: 50%;
        width: 20px;
        height: 20px;
        border: 2px solid var(--gray-300);
        border-top: 2px solid var(--primary-500);
        border-radius: 50%;
        animation: spin 1s linear infinite;
    }
    
    @keyframes spin {
        0% { transform: translate(-50%, -50%) rotate(0deg); }
        100% { transform: translate(-50%, -50%) rotate(360deg); }
    }
`;
document.head.appendChild(style);