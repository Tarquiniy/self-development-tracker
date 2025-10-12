document.addEventListener('DOMContentLoaded', function() {
    // WordPress-like quick actions
    function initQuickActions() {
        const actionButtons = document.querySelectorAll('.action-buttons .button');
        actionButtons.forEach(btn => {
            btn.addEventListener('click', function(e) {
                if (this.textContent.includes('Удалить') || this.textContent.includes('Спам')) {
                    if (!confirm('Вы уверены?')) {
                        e.preventDefault();
                    }
                }
            });
        });
    }
    
    // WordPress-like media uploader (simplified)
    function initMediaUploader() {
        const mediaButtons = document.querySelectorAll('.media-upload-button');
        mediaButtons.forEach(btn => {
            btn.addEventListener('click', function() {
                // Simplified media upload - in real implementation would open a modal
                const inputId = this.dataset.target;
                const fileInput = document.getElementById(inputId);
                if (fileInput) {
                    fileInput.click();
                }
            });
        });
    }
    
    // WordPress-like quick edit
    function initQuickEdit() {
        const quickEditLinks = document.querySelectorAll('.quick-edit-link');
        quickEditLinks.forEach(link => {
            link.addEventListener('click', function(e) {
                e.preventDefault();
                const postId = this.dataset.postId;
                // Implement quick edit functionality
                console.log('Quick edit post:', postId);
            });
        });
    }
    
    // WordPress-like dashboard widgets
    function initDashboardWidgets() {
        const widgetHeaders = document.querySelectorAll('.dashboard-widget-header');
        widgetHeaders.forEach(header => {
            header.addEventListener('click', function() {
                const content = this.nextElementSibling;
                content.style.display = content.style.display === 'none' ? 'block' : 'none';
            });
        });
    }
    
    // Initialize all functionality
    initQuickActions();
    initMediaUploader();
    initQuickEdit();
    initDashboardWidgets();
    
    // WordPress-like autosave for posts
    let autosaveTimer;
    const contentEditor = document.querySelector('#id_content');
    if (contentEditor) {
        contentEditor.addEventListener('input', function() {
            clearTimeout(autosaveTimer);
            autosaveTimer = setTimeout(function() {
                console.log('Autosaving...');
                // Implement autosave functionality
            }, 3000);
        });
    }
    
    // WordPress-like slug generation from title
    const titleField = document.querySelector('#id_title');
    const slugField = document.querySelector('#id_slug');
    if (titleField && slugField) {
        titleField.addEventListener('blur', function() {
            if (!slugField.value) {
                const slug = this.value.toLowerCase()
                    .replace(/[^\w\s-]/g, '')
                    .replace(/[\s_-]+/g, '-')
                    .replace(/^-+|-+$/g, '');
                slugField.value = slug;
            }
        });
    }
});