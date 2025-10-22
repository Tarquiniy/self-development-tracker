// Небольшие фиксы для стандартной админки: предотвращаем ошибки, сглаживаем поведение
(function(){
  // fix: grp/RelatedObjectLookups undefined in some bundles
  if(typeof grp === 'undefined'){
    window.grp = {};
  }

  // safe wrapper for django popup responses
  window.dismissRelatedLookupPopup = function(win, chosenId, chosenRepr){
    try{
      // оригинальное поведение — если окно открыто как popup
      if(win && win.opener && win.opener.dismissRelatedLookupPopup){
        win.opener.dismissRelatedLookupPopup(win, chosenId, chosenRepr);
      }
    }catch(e){ console.warn('dismissRelatedLookupPopup fallback', e); }
  }
})();
