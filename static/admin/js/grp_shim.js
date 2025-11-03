(function(){
  if (typeof window === "undefined") return;
  try {
    Object.defineProperty(window, "$", {
      configurable: true,
      enumerable: true,
      get: function(){ return window.jQuery; },
      set: function(v){ window.jQuery = v; return v; }
    });
  } catch(e) {
    var t = setInterval(function(){
      if (typeof window.jQuery === "function") { window.$ = window.jQuery; clearInterval(t); }
    }, 30);
  }
  window.grp = window.grp || {};
  window.grp.showRelatedObjectLookupPopup = window.grp.showRelatedObjectLookupPopup || function(){ return false; };
  window.grp.dismissRelatedLookupPopup = window.grp.dismissRelatedLookupPopup || function(){ return false; };
})();
