// main.js - admin UI helpers
document.addEventListener('DOMContentLoaded', function(){
  // sidebar toggle
  const btn = document.getElementById('sidebar-toggle');
  const sidebar = document.getElementById('admin-sidebar');
  if(btn && sidebar){
    btn.addEventListener('click', ()=> {
      sidebar.style.display = sidebar.style.display === 'none' ? 'block' : 'none';
      document.getElementById('admin-main').style.marginLeft = sidebar.style.display === 'none' ? '20px' : '240px';
    });
  }
});

function showToast(message, type='success', timeout=3000){
  const existing = document.querySelector('.notification');
  if(existing) existing.remove();
  const n = document.createElement('div');
  n.className = `notification ${type}`;
  n.innerHTML = message;
  document.body.appendChild(n);
  setTimeout(()=> n.remove(), timeout);
}
