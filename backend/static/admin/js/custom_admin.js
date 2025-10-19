// custom_admin.js - small UX enhancements
document.addEventListener('DOMContentLoaded', function () {
  // Sidebar toggle: toggle .collapsed on body
  var btn = document.getElementById('pt-toggle-sidebar');
  if (btn) {
    btn.addEventListener('click', function () {
      document.body.classList.toggle('pt-sidebar-collapsed');
      localStorage.setItem('ptSidebarCollapsed', document.body.classList.contains('pt-sidebar-collapsed') ? '1' : '0');
    });
    // restore state
    if (localStorage.getItem('ptSidebarCollapsed') === '1') {
      document.body.classList.add('pt-sidebar-collapsed');
    }
  }

  // Quick create modal
  var quick = document.getElementById('pt-quick-create');
  if (quick) {
    quick.addEventListener('click', function () {
      showQuickCreate();
    });
  }

  function showQuickCreate() {
    var existing = document.getElementById('pt-quick-create-modal');
    if (existing) {
      existing.style.display = 'flex';
      return;
    }
    var modal = document.createElement('div');
    modal.id = 'pt-quick-create-modal';
    modal.innerHTML = `
      <div class="modal-inner">
        <div style="display:flex;justify-content:space-between;align-items:center">
          <h3 style="margin:0">Quick create</h3>
          <button id="pt-quick-create-close" style="border:none;background:transparent;font-size:20px">✕</button>
        </div>
        <div style="margin-top:12px">
          <a class="pt-action" href="/admin/blog/post/add/">New post</a>
          <a class="pt-action" href="/admin/blog/category/add/">New category</a>
        </div>
      </div>
    `;
    modal.style.display = 'flex';
    modal.style.alignItems = 'center';
    modal.style.justifyContent = 'center';
    document.body.appendChild(modal);

    document.getElementById('pt-quick-create-close').addEventListener('click', function () {
      modal.style.display = 'none';
    });
  }

  // keyboard shortcut: "n" => new post (works when not typing)
  document.addEventListener('keydown', function (e) {
    if (e.key === 'n' && !['INPUT','TEXTAREA'].includes(document.activeElement.tagName)) {
      window.location.href = '/admin/blog/post/add/';
    }
  });
});
