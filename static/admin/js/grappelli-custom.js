// grappelli-custom.js
// Enhancements for admin pages: minor UX, table hover, media selection

(function () {
    'use strict';

    function enhanceTables() {
        var tables = document.querySelectorAll('table.grp-table');
        tables.forEach(function (table) {
            table.classList.add('grp-table-striped');
            table.querySelectorAll('tbody tr').forEach(function (tr) {
                tr.addEventListener('mouseenter', function () {
                    tr.style.backgroundColor = '#f8f9fa';
                });
                tr.addEventListener('mouseleave', function () {
                    tr.style.backgroundColor = '';
                });
            });
        });
    }

    function enhanceStatusBadges() {
        document.querySelectorAll('.status-badge').forEach(function (b) {
            var text = b.textContent.toLowerCase();
            if (text.indexOf('опублик') !== -1 || text.indexOf('published') !== -1) {
                b.classList.add('status-published');
            } else if (text.indexOf('черновик') !== -1 || text.indexOf('draft') !== -1) {
                b.classList.add('status-draft');
            } else if (text.indexOf('архив') !== -1 || text.indexOf('archived') !== -1) {
                b.classList.add('status-archived');
            }
        });
    }

    function initMediaLibrary() {
        // Toggle select for elements with class .media-item
        document.querySelectorAll('.media-item').forEach(function (el) {
            el.addEventListener('click', function (e) {
                // avoid toggling when clicking buttons or links inside item
                if (e.target && (e.target.tagName === 'BUTTON' || e.target.tagName === 'A' || e.target.closest('a,button'))) {
                    return;
                }
                el.classList.toggle('selected');
            });
        });

        // Bulk action placeholder
        var bulk = document.querySelector('.media-bulk-actions');
        if (bulk) {
            bulk.addEventListener('change', function () {
                var action = bulk.value;
                var selected = document.querySelectorAll('.media-item.selected');
                if (!selected.length) {
                    alert('Выберите хотя бы один файл для действия');
                    bulk.value = '';
                    return;
                }
                // TODO: implement actions via AJAX on server endpoints
                console.log('Bulk action', action, 'on', selected.length, 'items');
            });
        }
    }

    function addSmoothAnimations() {
        document.querySelectorAll('.grp-module').forEach(function (m) {
            m.style.opacity = 0;
            setTimeout(function () { m.style.transition = 'opacity .28s ease-in'; m.style.opacity = 1; }, 20);
        });

        document.querySelectorAll('a[href^="#"]').forEach(function (a) {
            a.addEventListener('click', function (e) {
                var id = a.getAttribute('href');
                if (!id) return;
                var target = document.querySelector(id);
                if (target) {
                    e.preventDefault();
                    window.scrollTo({ top: target.offsetTop - 20, behavior: 'smooth' });
                }
            });
        });
    }

    document.addEventListener('DOMContentLoaded', function () {
        try { enhanceTables(); } catch (e) { console.error(e); }
        try { enhanceStatusBadges(); } catch (e) { console.error(e); }
        try { initMediaLibrary(); } catch (e) { console.error(e); }
        try { addSmoothAnimations(); } catch (e) { console.error(e); }
    });

})();
