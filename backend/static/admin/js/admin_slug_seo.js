// static/admin/js/admin_slug_seo.js
(function(){
  "use strict";

  // Простая JS-транслитерация кириллицы -> латиница
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
        // preserve capitalization roughly
        if (ch === ch.toUpperCase()) {
          mapped = mapped.charAt(0).toUpperCase() + mapped.slice(1);
        }
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

  function initSlugAuto() {
    var title = getField('title');
    var slug = getField('slug');
    if (!title || !slug) return;
    // track user-edit
    var userEdited = false;
    slug.addEventListener('input', function(){ userEdited = true; });
    title.addEventListener('input', function(){
      if (userEdited) return;
      var s = slugify(title.value);
      if (s) slug.value = s;
    });
    // on load, if slug empty fill it
    document.addEventListener('DOMContentLoaded', function(){
      if (!slug.value && title && title.value) slug.value = slugify(title.value);
    });
  }

  function initSeoAuto() {
    var title = getField('title');
    var excerpt = getField('excerpt');
    var metaTitle = getField('meta_title');
    var metaDesc = getField('meta_description');
    if (!title) return;
    // auto-fill meta_title from title if empty
    title.addEventListener('input', function(){
      if (metaTitle && !metaTitle.dataset.userEdited) {
        metaTitle.value = truncate(title.value, 60);
      }
    });
    if (metaTitle) {
      metaTitle.addEventListener('input', function(){ metaTitle.dataset.userEdited = true; });
    }
    // auto-fill meta_description from excerpt or content
    if (excerpt) {
      excerpt.addEventListener('input', function(){
        if (metaDesc && !metaDesc.dataset.userEdited) {
          metaDesc.value = truncate(excerpt.value.replace(/\s+/g,' ').trim(), 160);
        }
      });
    }
    if (metaDesc) {
      metaDesc.addEventListener('input', function(){ metaDesc.dataset.userEdited = true; });
    }
    // also try to extract from content textarea (CKEditor syncs to textarea)
    var content = getField('content');
    if (content) {
      content.addEventListener('input', function(){
        if (metaDesc && !metaDesc.dataset.userEdited && (!metaDesc.value || metaDesc.value.trim()==='')) {
          // strip HTML
          var text = content.value.replace(/<[^>]+>/g,' ').replace(/\s+/g,' ').trim();
          metaDesc.value = truncate(text.substring(0, 200), 160);
        }
      });
    }
  }

  function initDatetime() {
    // if flatpickr available, use it on inputs with class admin-datetime-local
    var els = document.querySelectorAll('input.admin-datetime-local');
    if (!els || els.length===0) return;
    if (typeof flatpickr === 'function') {
      els.forEach(function(el){
        // flatpickr config: enable time, use ISO-like format
        flatpickr(el, {
          enableTime: true,
          dateFormat: "Y-m-d H:i",
          time_24hr: true,
          allowInput: true
        });
      });
    } else {
      // fallback: make sure when form submits, replace 'T' -> ' '
      var forms = new Set();
      els.forEach(function(el){
        var f = el.closest('form');
        if (f) forms.add(f);
      });
      forms.forEach(function(form){
        form.addEventListener('submit', function(){
          els.forEach(function(el){
            if (el.value.indexOf('T') !== -1) {
              el.value = el.value.replace('T', ' ');
            }
          });
        });
      });
    }
  }

  function init(){
    initSlugAuto();
    initSeoAuto();
    initDatetime();
  }

  // run on DOM ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();
