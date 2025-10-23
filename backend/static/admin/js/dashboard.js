document.addEventListener('DOMContentLoaded', function(){
  try{
    const labels = JSON.parse(document.getElementById('pt-dashboard-labels').textContent || '[]');
    const posts = JSON.parse(document.getElementById('pt-dashboard-posts').textContent || '[]');
    const ctx = document.getElementById('pt-stats-chart');
    if(ctx && labels.length){
      new Chart(ctx, { type:'line', data:{ labels, datasets:[{label:'Посты', data:posts, tension:0.3}]}, options:{responsive:true,plugins:{legend:{display:false}}}});
    }
  }catch(e){ console.warn(e); }
});
