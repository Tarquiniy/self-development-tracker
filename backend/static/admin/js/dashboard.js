(function(){
const statsUrl = '/admin/dashboard/stats-data/?days=30';
function safeFetch(url){
return fetch(url, {credentials:'same-origin'}).then(r=>{if(!r.ok)throw r;return r.json()});
}


function renderNumbers(data){
try{document.getElementById('stat-posts').textContent = data.total_posts ?? document.getElementById('stat-posts').textContent;}catch(e){}
try{document.getElementById('stat-comments').textContent = data.total_comments ?? document.getElementById('stat-comments').textContent;}catch(e){}
try{document.getElementById('stat-users').textContent = data.users_count ?? document.getElementById('stat-users').textContent;}catch(e){}
}


function renderChart(data){
const ctx = document.getElementById('dashboardChart');
if(!ctx) return;
const labels = data.labels || [];
const posts = data.posts || [];
const comments = data.comments || [];
const views = data.views || [];


// create or replace chart
try{
if(window._adminDashboardChart){ window._adminDashboardChart.destroy(); window._adminDashboardChart = null; }
window._adminDashboardChart = new Chart(ctx, {
type: 'line',
data: {
labels: labels,
datasets: [
{label:'Посты', data: posts, tension:0.3, fill:false, borderWidth:2},
{label:'Комментарии', data: comments, tension:0.3, fill:false, borderWidth:2},
{label:'Просмотры', data: views, tension:0.3, fill:false, borderWidth:2}
]
},
options: { plugins:{legend:{position:'bottom'}}, scales:{x:{display:true}, y:{display:true, beginAtZero:true}} }
});
}catch(e){console.warn('Chart render failed', e)}
}


function init(){
safeFetch(statsUrl).then(data=>{
renderNumbers(data);
renderChart(data);
}).catch(err=>{
console.warn('Failed to load dashboard stats', err);
});
}


document.addEventListener('DOMContentLoaded', init);
})();