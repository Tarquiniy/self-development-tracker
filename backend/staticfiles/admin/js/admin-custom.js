// Modern Admin JavaScript for Positive Theta - 2025

document.addEventListener('DOMContentLoaded', function() {
    console.log('Positive Theta Admin loaded successfully');
    
    // Enhance admin interface
    enhanceAdminInterface();
    initMediaSelector();
    initQuickActions();
    initStatsDashboard();
});

function enhanceAdminInterface() {
    // Add loading states to buttons
    const buttons = document.querySelectorAll('input[type="submit"], .button');
    buttons.forEach(btn => {
        btn.addEventListener('click', function(e) {
            if (this.type === 'submit' || this.classList.contains('button')) {
                this.style.opacity = '0.7';
                this.disabled = true;
                setTimeout(() => {
                    this.style.opacity = '1';
                    this.disabled = false;
                }, 3000);
            }
        });
    });
    
    // Add confirmation to delete actions
    const deleteLinks = document.querySelectorAll('a[href*="delete"]');
    deleteLinks.forEach(link => {
        link.addEventListener('click', function(e) {
            if (!confirm('Вы уверены, что хотите удалить этот элемент? Это действие нельзя отменить.')) {
                e.preventDefault();
            }
        });
    });
    
    // Enhance table rows with hover effects
    const tableRows = document.querySelectorAll('#changelist table tbody tr');
    tableRows.forEach(row => {
        row.addEventListener('mouseenter', function() {
            this.style.transform = 'translateX(4px)';
            this.style.transition = 'transform 0.2s ease';
        });
        
        row.addEventListener('mouseleave', function() {
            this.style.transform = 'translateX(0)';
        });
    });
}

function initMediaSelector() {
    // Media selector functionality
    window.openMediaSelector = function(fieldId) {
        // Simple media selector implementation
        const mediaUrl = prompt('Введите URL изображения или выберите файл для загрузки:');
        if (mediaUrl) {
            document.getElementById(fieldId).value = mediaUrl;
            
            // Update preview
            const preview = document.getElementById(fieldId + '_preview');
            if (preview) {
                preview.innerHTML = `<img src="${mediaUrl}" style="max-height: 100px; margin-top: 10px; border-radius: 4px;" />`;
            }
        }
    };
    
    // Handle file uploads
    const fileInputs = document.querySelectorAll('input[type="file"]');
    fileInputs.forEach(input => {
        input.addEventListener('change', function(e) {
            const fileName = this.files[0]?.name;
            if (fileName) {
                const label = this.nextElementSibling;
                if (label && label.classList.contains('file-label')) {
                    label.textContent = fileName;
                }
            }
        });
    });
}

function initQuickActions() {
    // Add quick action buttons to dashboard
    const dashboard = document.querySelector('#content');
    if (dashboard && window.location.pathname.includes('admin')) {
        const quickActions = document.createElement('div');
        quickActions.className = 'quick-actions';
        quickActions.innerHTML = `
            <a href="/admin/blog/post/add/" class="quick-action-btn">
                📝 Новый пост
            </a>
            <a href="/admin/blog/category/add/" class="quick-action-btn">
                📂 Новая категория
            </a>
            <a href="/admin/blog/post/" class="quick-action-btn">
                📊 Статистика
            </a>
        `;
        
        const contentMain = document.querySelector('#content-main');
        if (contentMain) {
            contentMain.insertBefore(quickActions, contentMain.firstChild);
        }
    }
}

function initStatsDashboard() {
    // Load basic stats for dashboard
    if (window.location.pathname.includes('admin') && !window.location.pathname.includes('add') && !window.location.pathname.includes('change')) {
        fetch('/admin/blog/get-stats/')
            .then(response => response.json())
            .then(data => {
                // Create stats dashboard
                const statsHTML = `
                    <div class="stats-grid">
                        <div class="stat-item">
                            <span class="stat-number">${data.total_posts}</span>
                            <span class="stat-label">Всего постов</span>
                        </div>
                        <div class="stat-item">
                            <span class="stat-number">${data.published_posts}</span>
                            <span class="stat-label">Опубликовано</span>
                        </div>
                        <div class="stat-item">
                            <span class="stat-number">${data.draft_posts}</span>
                            <span class="stat-label">Черновики</span>
                        </div>
                    </div>
                `;
                
                const contentMain = document.querySelector('#content-main');
                if (contentMain) {
                    const existingStats = contentMain.querySelector('.stats-grid');
                    if (!existingStats) {
                        const statsSection = document.createElement('div');
                        statsSection.className = 'dashboard-card';
                        statsSection.innerHTML = '<h3>📈 Статистика блога</h3>' + statsHTML;
                        contentMain.insertBefore(statsSection, contentMain.firstChild);
                    }
                }
            })
            .catch(error => console.log('Stats loading failed:', error));
    }
}

// Utility functions
function showNotification(message, type = 'success') {
    // Create notification element
    const notification = document.createElement('div');
    notification.className = `notification ${type}`;
    notification.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        padding: 15px 20px;
        background: ${type === 'success' ? '#d1fae5' : type === 'error' ? '#fde8e8' : '#fef3c7'};
        color: ${type === 'success' ? '#065f46' : type === 'error' ? '#d63638' : '#92400e'};
        border-radius: 6px;
        box-shadow: 0 4px 12px rgba(0,0,0,0.15);
        z-index: 10000;
        max-width: 300px;
    `;
    notification.textContent = message;
    
    document.body.appendChild(notification);
    
    setTimeout(() => {
        notification.remove();
    }, 5000);
}

// Auto-save draft functionality
function initAutoSave() {
    const textareas = document.querySelectorAll('textarea, input[type="text"]');
    let saveTimeout;
    
    textareas.forEach(textarea => {
        textarea.addEventListener('input', function() {
            clearTimeout(saveTimeout);
            saveTimeout = setTimeout(() => {
                // Simulate auto-save
                console.log('Auto-saving...');
            }, 2000);
        });
    });
}

// Initialize when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initAutoSave);
} else {
    initAutoSave();
}