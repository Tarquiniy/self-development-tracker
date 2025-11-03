// simple_admin_editor.js
// Lightweight enhancements for admin textareas and form UX.
// No external dependency required.

(function () {
    "use strict";

    // Auto-resize textareas with class 'admin-rich-textarea' or all textareas
    function autoResizeTextareas() {
        var areas = document.querySelectorAll('textarea');
        areas.forEach(function (ta) {
            if (ta.dataset.autoresize === "1") return;
            ta.dataset.autoresize = "1";
            var resize = function () {
                ta.style.height = 'auto';
                ta.style.height = (ta.scrollHeight + 4) + 'px';
            };
            ta.addEventListener('input', resize);
            // initial
            resize();
        });
    }

    // Simple slug generation: if slug empty, fill from title
    function initSlugGeneration() {
        var title = document.querySelector('input[name="title"]');
        var slug = document.querySelector('input[name="slug"]');
        if (!title || !slug) return;
        title.addEventListener('input', function (e) {
            if (slug.value && slug.value.trim().length > 0) return; // don't overwrite manually set slug
            var v = title.value.toLowerCase().trim();
            v = v.replace(/[^a-z0-9а-яё\s\-]+/gi, '');
            v = v.replace(/\s+/g, '-');
            v = v.replace(/-+/g, '-');
            v = v.replace(/^-|-$/g, '');
            slug.value = v;
        });
    }

    // Simple notification helper
    function showNotification(msg, type) {
        var node = document.createElement('div');
        node.className = 'pt-admin-notice ' + (type || 'info');
        node.style.position = 'fixed';
        node.style.right = '18px';
        node.style.top = '18px';
        node.style.zIndex = 12000;
        node.style.padding = '10px 14px';
        node.style.borderRadius = '8px';
        node.style.boxShadow = '0 6px 18px rgba(15,23,42,0.08)';
        node.innerText = msg;
        document.body.appendChild(node);
        setTimeout(function () {
            node.style.opacity = '0';
            setTimeout(function () { try { node.remove(); } catch (e) {} }, 300);
        }, 3500);
    }

    // Form submit validation for required fields
    function attachFormValidation() {
        var forms = document.querySelectorAll('form');
        forms.forEach(function (form) {
            form.addEventListener('submit', function (e) {
                var requireds = form.querySelectorAll('[required]');
                var ok = true;
                requireds.forEach(function (field) {
                    if (!field.value || field.value.trim() === '') {
                        field.classList.add('grp-error');
                        ok = false;
                    } else {
                        field.classList.remove('grp-error');
                    }
                });
                if (!ok) {
                    e.preventDefault();
                    showNotification('Пожалуйста, заполните обязательные поля', 'error');
                }
            });
        });
    }

    // Init on DOM ready
    document.addEventListener('DOMContentLoaded', function () {
        autoResizeTextareas();
        initSlugGeneration();
        attachFormValidation();
    });

})();
