// static/admin/js/tiptap_widget_extra.js
window.openRevisionsPanel = window.openRevisionsPanel || function(){ alert('Revisions unavailable'); }
window.openPreviewForPost = window.openPreviewForPost || function(){ alert('Preview unavailable'); }
function initAdminExtraButtons(){
  // attach click listeners to admin revision buttons inserted by revision_tools
  document.querySelectorAll('a.button[data-rev-url]').forEach(btn=>{
    btn.addEventListener('click', function(e){
      e.preventDefault();
      const postId = this.dataset.postId || document.querySelector('input[name="id"]').value;
      if (postId) window.openRevisionsPanel(postId);
    });
  });
}
document.addEventListener('DOMContentLoaded', initAdminExtraButtons);
