// admin-fixes.js
if(typeof window.grp === 'undefined') window.grp = { jQuery: window.jQuery || null };

(function(){
  // Fix for RelatedObjectLookups in some older browsers
  document.addEventListener('DOMContentLoaded', function(){
    // Remove duplicate tiptap vendor loads if any (defensive)
    const scripts = Array.from(document.querySelectorAll('script')).map(s => s.src||'');
    const seen = new Set();
    scripts.forEach(src => {
      if(!src) return;
      if(seen.has(src)) {
        // do nothing (we can't remove external scripts safely), but log
        console.debug('duplicate script', src);
      } else seen.add(src);
    });
  });
})();
