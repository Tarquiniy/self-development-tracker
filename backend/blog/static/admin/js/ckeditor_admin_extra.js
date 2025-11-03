/* backend/blog/static/admin/js/ckeditor_admin_extra.js */
(function () {
  'use strict';

  // CDN CKEditor 4 (если вы используете локальную копию — подставьте путь)
  const CDN_URL = 'https://cdn.ckeditor.com/4.21.0/standard-all/ckeditor.js';
  const POLL_INTERVAL = 150;
  const LOAD_TIMEOUT = 15000;
  const CANDIDATES = ['content', 'short_description', 'excerpt', 'body', 'description', 'summary'];

  function loadScriptOnce(src) {
    return new Promise((resolve, reject) => {
      if (!src) return reject(new Error('No src'));
      const existing = Array.from(document.scripts).find(s => s.src && s.src.indexOf(src) !== -1);
      if (existing) {
        if (window.CKEDITOR) return resolve();
        let waited = 0;
        const t = setInterval(() => {
          if (window.CKEDITOR) { clearInterval(t); return resolve(); }
          waited += POLL_INTERVAL;
          if (waited >= LOAD_TIMEOUT) { clearInterval(t); return reject(new Error('Timeout waiting CKEDITOR after existing script')); }
        }, POLL_INTERVAL);
        return;
      }
      const s = document.createElement('script');
      s.type = 'text/javascript';
      s.src = src;
      s.async = true;
      s.onload = function () { resolve(); };
      s.onerror = function () { reject(new Error('Failed to load script ' + src)); };
      document.head.appendChild(s);
    });
  }

  function waitForCKEditor() {
    return new Promise((resolve, reject) => {
      if (window.CKEDITOR) return resolve();
      let waited = 0;
      const t = setInterval(() => {
        if (window.CKEDITOR) { clearInterval(t); return resolve(); }
        waited += POLL_INTERVAL;
        if (waited >= LOAD_TIMEOUT) { clearInterval(t); return reject(new Error('Timeout waiting for CKEDITOR')); }
      }, POLL_INTERVAL);
    });
  }

  function getCookie(name) {
    const v = document.cookie.match('(^|;)\\s*' + name + '\\s*=\\s*([^;]+)');
    return v ? decodeURIComponent(v.pop()) : null;
  }

  function buildConfig() {
    // Убираем плагины, связанные с изображениями и загрузкой.
    return {
      language: 'ru',
      // extraPlugins может содержать дополнительные полезные плагины, но без image/upload
      extraPlugins: 'colorbutton,font,justify,autogrow',
      // запрещаем автоматическое удаление тега, разрешаем большинство элементов
      allowedContent: true,
      // удаляем плагины вставки/загрузки изображений
      removePlugins: 'image,uploadimage,image2,filebrowser',
      // визуальные настройки
      autoGrow_bottomSpace: 50,
      height: 520,
      // Убираем 'Image' из панели Insert
      toolbar: [
        { name: 'clipboard', items: ['Cut','Copy','Paste','PasteText','PasteFromWord','-','Undo','Redo'] },
        { name: 'styles', items: ['Format','Font','FontSize'] },
        { name: 'basicstyles', items: ['Bold','Italic','Underline','Strike','RemoveFormat'] },
        { name: 'colors', items: ['TextColor','BGColor'] },
        { name: 'paragraph', items: ['NumberedList','BulletedList','-','Outdent','Indent','-','Blockquote'] },
        { name: 'alignment', items: ['JustifyLeft','JustifyCenter','JustifyRight','JustifyBlock'] },
        { name: 'links', items: ['Link','Unlink'] },
        { name: 'insert', items: ['Table','HorizontalRule','SpecialChar'] },
        { name: 'tools', items: ['Maximize'] }
      ],

      // Отключаем upload URL'ы — CKEditor не будет пытаться использовать XHR/iframe для загрузки
      filebrowserUploadUrl: '',
      filebrowserImageUploadUrl: '',
      filebrowserUploadMethod: 'form',

      removeDialogTabs: 'link:advanced'
    };
  }

  function attachCsrfHeaderToInstance(instance) {
    // оставляем обработчики, но они не будут использоваться, если загрузки отключены
    try {
      instance.on('fileUploadRequest', function(evt) {
        try {
          const xhr = evt.data.fileLoader && evt.data.fileLoader.xhr;
          const token = getCookie('csrftoken') || getCookie('CSRF-TOKEN') || '';
          if (xhr && token) {
            xhr.setRequestHeader('X-CSRFToken', token);
          }
        } catch (e) { /* swallow */ }
      });
      instance.on('imageUploadRequest', function(evt) {
        try {
          const xhr = evt.data.fileLoader && evt.data.fileLoader.xhr;
          const token = getCookie('csrftoken') || '';
          if (xhr && token) xhr.setRequestHeader('X-CSRFToken', token);
        } catch (e) {}
      });
    } catch (e) { /* ignore */ }
  }

  function initOneTextarea(ta) {
    if (!ta) return;
    if (ta.dataset.ckeditorAttached) return;
    try {
      const cfg = buildConfig();
      if ((ta.name || '').indexOf('excerpt') !== -1 || (ta.name || '').indexOf('short') !== -1) {
        cfg.height = 300;
      }
      const inst = window.CKEDITOR.replace(ta, cfg);
      ta.dataset.ckeditorAttached = '1';
      attachCsrfHeaderToInstance(inst);
      inst.on('instanceReady', function () {
        try { ta.style.visibility = ''; } catch (e) {}
      });
    } catch (e) {
      console.warn('CKEditor4 init error', e);
    }
  }

  async function initEditors() {
    try {
      if (!window.CKEDITOR) {
        await loadScriptOnce(CDN_URL);
        await waitForCKEditor();
      }
    } catch (err) {
      console.error('CKEditor4 not loaded', err);
      return;
    }

    CANDIDATES.forEach(name => {
      const ta = document.querySelector('textarea[name="'+name+'"]');
      if (ta) initOneTextarea(ta);
    });

    document.querySelectorAll('textarea.admin-ckeditor-textarea').forEach(ta => initOneTextarea(ta));

    document.querySelectorAll('form textarea').forEach(ta => {
      if (ta.offsetHeight < 20) return;
      if (ta.dataset.ckeditorAttached) return;
      initOneTextarea(ta);
    });
  }

  function syncEditorsBeforeSubmit(e) {
    try {
      if (!window.CKEDITOR) return;
      for (const name in window.CKEDITOR.instances) {
        const inst = window.CKEDITOR.instances[name];
        try { inst.updateElement(); } catch (er) {}
      }
    } catch (err) { console.warn('sync editors failed', err); }
  }

  document.addEventListener('DOMContentLoaded', () => {
    setTimeout(initEditors, 150);
    setTimeout(initEditors, 600);
    setTimeout(initEditors, 1500);
    document.addEventListener('submit', syncEditorsBeforeSubmit, true);
  });

  // Для ручного старта из консоли, если нужно
  window.ckeditorAdminInit = initEditors;

})();
