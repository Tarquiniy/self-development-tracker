// Main admin JS: sidebar, keyboard shortcuts, small progressive enhancements
(function(){
  const sidebar = document.getElementById('admin-sidebar');
  const toggle = document.getElementById('sidebar-toggle');
  if(toggle && sidebar){
    toggle.addEventListener('click', ()=>{
      sidebar.classList.toggle('open');
    });
  }

  // keyboard shortcut: ? opens help overlay
  document.addEventListener('keydown', function(e){
    if(e.key === '?'){
      alert('Клавиши:\n? — помощь\nCtrl+K — фокус на поиск');
    }
    if(e.ctrlKey && e.key.toLowerCase()==='k'){
      const s = document.querySelector('.search-input');
      if(s){ e.preventDefault(); s.focus(); }
    }
  });

  // enhance admin related object lookups: make popup links open in modal when possible
  document.addEventListener('click', function(e){
    const target = e.target;
    if(target.matches('.related-lookup')){
      // fallback to original behaviour; more advanced modal can be implemented
      return;
    }
  });

  // improve file input preview (generic)
  document.addEventListener('change', function(e){
    const el = e.target;
    if(el.matches('input[type=file]')){
      const preview = document.getElementById('image-preview');
      if(!preview) return;
      preview.innerHTML = '';
      const file = el.files && el.files[0];
      if(!file) return;
      if(file.type.startsWith('image/')){
        const img = document.createElement('img');
        img.src = URL.createObjectURL(file);
        img.alt = file.name;
        img.onload = () => URL.revokeObjectURL(img.src);
        preview.appendChild(img);
      } else {
        preview.textContent = file.name;
      }
    }
  });
})();
