// static/admin/js/RelatedObjectLookups.js
// Лёгкий override для предотвращения ReferenceError: grp is not defined
(function(){
  "use strict";
  // если уже есть оригинал (возможно в другом path) — не ломаем
  window.grp = window.grp || {};

  // Добавим минимальные заглушки используемых функций,
  // чтобы оригинальные вызовы не падали. Если нужна реальная функциональность
  // (popup выбора связанных объектов) — удалите этот файл и подключите оригинал Django.
  window.grp.showRelatedObjectLookupPopup = window.grp.showRelatedObjectLookupPopup || function(win, name, pop_params){
    // попытка открыть popup как в старых Django — минимальная заглушка
    try {
      if (win && win.document) win.focus();
    } catch(e){}
    return false;
  };
  window.grp.dismissRelatedLookupPopup = window.grp.dismissRelatedLookupPopup || function(win, chosenId, chosenRepr){
    // no-op safe fallback
    return false;
  };
})();
