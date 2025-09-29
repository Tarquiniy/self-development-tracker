// backend/blog/static/admin/admin-core.js
(function () {
    // Add small UI helpers (collapsible fieldsets, keyboard shortcuts)
    document.addEventListener('DOMContentLoaded', function () {
        // Collapsible admin fieldsets
        document.querySelectorAll('.module h2').forEach(h => {
            h.style.cursor = 'pointer';
            h.addEventListener('click', function () {
                const next = h.nextElementSibling;
                if (next) {
                    next.style.display = next.style.display === 'none' ? '' : 'none';
                }
            });
        });

        // Add Ctrl+S to save form
        document.addEventListener('keydown', function (e) {
            if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
                e.preventDefault();
                const form = document.querySelector('form');
                if (form) form.submit();
            }
        });
    });
})();
