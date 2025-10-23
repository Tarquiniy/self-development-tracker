// backend/static/admin/js/admin-fixes.js
(function(){
  // Prevent ReferenceError for legacy code expecting grp
  if(typeof window.grp === 'undefined'){
    window.grp = {};
  }

  // Provide a safe stub for dismissRelatedLookupPopup (django related object popup)
  window.dismissRelatedLookupPopup = function(win, chosenId, chosenRepr){
    try {
      if(win && win.opener && win.opener.dismissRelatedLookupPopup){
        win.opener.dismissRelatedLookupPopup(win, chosenId, chosenRepr);
        return;
      }
    } catch(e){}
    // fallback: try to set value on opener by name if possible
    try {
      if(window.opener && window.opener.document){
        const name = (win && win.name) || null;
        if(name){
          // no-op fallback
        }
      }
    } catch(e){}
  };

  // handle simple sidebar toggle (in case main.js loads later)
  document.addEventListener('DOMContentLoaded', function(){
    const sidebar = document.getElementById('admin-sidebar');
    const toggle = document.getElementById('sidebar-toggle');
    if(toggle && sidebar){
      toggle.addEventListener('click', function(){ sidebar.classList.toggle('open'); });
    }
  });
})();
