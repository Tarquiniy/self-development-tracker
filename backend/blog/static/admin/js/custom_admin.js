// Простая утилита для админки: защита от ошибок, обработчики UI.
// backend/blog/static/admin/js/custom_admin.js
(function () {
  if (typeof window === 'undefined') return;
  document.addEventListener('DOMContentLoaded', function () {
    try {
      // Добавляем tabindex и role там, где нужно для клавиатурной навигации
      document.querySelectorAll('.btn, .btn-action').forEach(function(b){ b.setAttribute('tabindex','0'); });

      // Поддержка для кнопок в старых браузерах: если button внутри a - не сломать
      document.querySelectorAll('a.btn').forEach(function(a){
        a.addEventListener('keydown', function(e){ if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); a.click(); }});
      });
    } catch (e) {
      if (window.console) console.error('[custom_admin] init error', e);
    }
  });
})();
