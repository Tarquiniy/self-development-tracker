// static/admin/js/admin_slug_seo.js
(function(){
  "use strict";

  // транслит и slugify (краткая JS-версия)
  var cyr2lat = {
    'а':'a','б':'b','в':'v','г':'g','д':'d','е':'e','ё':'yo','ж':'zh','з':'z','и':'i',
    'й':'y','к':'k','л':'l','м':'m','н':'n','о':'o','п':'p','р':'r','с':'s','т':'t',
    'у':'u','ф':'f','х':'kh','ц':'ts','ч':'ch','ш':'sh','щ':'shch','ъ':'','ы':'y','ь':'',
    'э':'e','ю':'yu','я':'ya'
  };

  function translit(str){
    if (!str) return '';
    var out = '';
    for (var i=0;i<str.length;i++){
      var ch = str[i];
      var low = ch.toLowerCase();
      if (cyr2lat.hasOwnProperty(low)){
        var mapped = cyr2lat[low];
        if (ch === ch.toUpperCase()) mapped = mapped.charAt(0).toUpperCase() + mapped.slice(1);
        out += mapped;
      } else {
        out += ch;
      }
    }
    return out;
  }

  function slugify(str){
    if (!str) return '';
    var s = translit(str);
    s = s.toLowerCase();
    s = s.replace(/[^a-z0-9\-_\s]/g, '');
    s = s.replace(/\s+/g, '-');
    s = s.replace(/-+/g, '-');
    s = s.replace(/^-|-$/g, '');
    return s.substring(0, 200);
  }

  function truncate(str, n) {
    if (!str) return '';
    if (str.length <= n) return str;
    return str.substring(0, n - 1).trim() + '…';
  }

  function getField(name){
    return document.querySelector('[name="'+ name +'"]');
  }

  // UI helper: create button and place after target element
  function makeButton(text, title){
    var btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'generate-seo-btn';
    btn.textContent = text;
    if (title) btn.title = title;
    // basic styling (inject once)
    if (!document.getElementById('gen-seo-styles')) {
      var style = document.createElement('style');
      style.id = 'gen-seo-styles';
      style.innerHTML = "\
.generate-seo-btn{margin-left:8px;padding:4px 8px;border:1px solid #ccd0d5;background:#f5f6f7;border-radius:4px;cursor:pointer}\
.generate-seo-btn:active{transform:translateY(1px)}\
.generate-seo-note{margin-left:8px;color:#6b7280;font-size:12px}";
      document.head.appendChild(style);
    }
    return btn;
  }

  // main features
  function initSlugAuto() {
    var title = getField('title');
    var slug = getField('slug');
    if (!title || !slug) return;
    var userEdited = false;
    slug.addEventListener('input', function(){ userEdited = true; slug.dataset.userEdited = '1'; });
    title.addEventListener('input', function(){
      if (userEdited) return;
      var s = slugify(title.value);
      if (s) slug.value = s;
    });
    document.addEventListener('DOMContentLoaded', function(){
      if (!slug.value && title && title.value) slug.value = slugify(title.value);
    });
  }

  function initSeoAuto() {
    var title = getField('title');
    var excerpt = getField('excerpt');
    var metaTitle = getField('meta_title');
    var metaDesc = getField('meta_description');
    var content = getField('content');

    if (!metaTitle && !metaDesc) return;

    // create Generate SEO button next to meta_title (or meta_description if meta_title missing)
    var target = metaTitle || metaDesc;
    if (target) {
      var btn = makeButton('Сгенерировать SEO', 'Заполнить meta title и meta description автоматически');
      target.parentNode.insertBefore(btn, target.nextSibling);
      var note = document.createElement('span');
      note.className = 'generate-seo-note';
      target.parentNode.insertBefore(note, btn.nextSibling);

      btn.addEventListener('click', function(){
        // if user already edited fields ask confirm to overwrite
        var overwrite = true;
        if ((metaTitle && metaTitle.dataset.userEdited) || (metaDesc && metaDesc.dataset.userEdited)) {
          overwrite = confirm('Поля SEO уже были отредактированы вручную. Перезаписать их автоматически?');
        }
        if (!overwrite) return;

        // generate meta title
        if (metaTitle) {
          var genTitle = (title && title.value) ? truncate(title.value.trim(), 60) : '';
          metaTitle.value = genTitle;
          metaTitle.dataset.userEdited = '1';
        }
        // generate meta description: prefer excerpt, else content (strip HTML), else title
        if (metaDesc) {
          var base = '';
          if (excerpt && excerpt.value && excerpt.value.trim()) base = excerpt.value;
          else if (content && content.value && content.value.trim()) base = content.value.replace(/<[^>]+>/g,' ').replace(/\s+/g,' ').trim();
          else if (title && title.value) base = title.value;
          var genDesc = truncate(base.trim(), 160);
          metaDesc.value = genDesc;
          metaDesc.dataset.userEdited = '1';
        }

        // visual feedback
        note.textContent = 'Сгенерировано';
        setTimeout(function(){ note.textContent = ''; }, 2000);
      });
    }

    // mark fields as userEdited when typed
    if (metaTitle) metaTitle.addEventListener('input', function(){ metaTitle.dataset.userEdited = '1'; });
    if (metaDesc) metaDesc.addEventListener('input', function(){ metaDesc.dataset.userEdited = '1'; });
  }

  function initDatetime() {
    var els = document.querySelectorAll('input.admin-datetime-local');
    if (!els || els.length===0) return;
    if (typeof flatpickr === 'function') {
      els.forEach(function(el){
        // if already initialized, skip
        if (el._flatpickr) return;
        flatpickr(el, {
          enableTime: true,
          time_24hr: true,
          dateFormat: "Y-m-d H:i",
          altInput: true,
          altFormat: "d.m.Y H:i",
          allowInput: true
        });
      });
    } else {
      // fallback: provide simple UI: focus opens browser datetime-local if supported
      els.forEach(function(el){
        el.type = 'datetime-local';
      });
    }
  }

  // initialize everything
  function init(){
    initSlugAuto();
    initSeoAuto();
    initDatetime();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();
