// static/admin/js/admin_dashboard.js
(function(){
  const el = document.getElementById('dashboard-stats');
  if(!el) return;

  function setCards(data){
    // ordering: total_posts, published_posts, draft_posts, total_comments, total_views
    const labels = [
      ['Всего постов', data.total_posts],
      ['Опубликовано', data.published_posts],
      ['Черновиков', data.draft_posts],
      ['Комментариев', data.total_comments],
      ['Просмотров', data.total_views]
    ];
    el.innerHTML = '';
    labels.forEach(function(item){
      const card = document.createElement('div');
      card.className = 'stat-card';
      const t = document.createElement('div');
      t.className = 'stat-title';
      t.textContent = item[0];
      const v = document.createElement('div');
      v.className = 'stat-value';
      v.textContent = item[1] != null ? item[1] : '—';
      card.appendChild(t);
      card.appendChild(v);
      el.appendChild(card);
    });
  }

  function fetchStats(){
    const url = '/admin/dashboard/stats-data/?days=30';
    fetch(url, { credentials:'same-origin', headers: {'X-Requested-With':'XMLHttpRequest'} })
      .then(r => {
        if(!r.ok) throw new Error('Network response not ok');
        return r.json();
      })
      .then(data => {
        // endpoint returns labels/posts/comments/views arrays OR keys — be tolerant
        if(data && typeof data === 'object'){
          // try old style keys
          if(data.total_posts !== undefined){
            setCards(data);
            return;
          }
          // try to derive counts from arrays
          const posts = Array.isArray(data.posts) ? data.posts.reduce((a,b)=>a+b,0) : 0;
          const comments = Array.isArray(data.comments) ? data.comments.reduce((a,b)=>a+b,0) : 0;
          const views = Array.isArray(data.views) ? data.views.reduce((a,b)=>a+b,0) : 0;
          setCards({
            total_posts: posts,
            published_posts: '—',
            draft_posts: '—',
            total_comments: comments,
            total_views: views
          });
        }
      })
      .catch(err => {
        console.debug('[admin_dashboard] stats fetch failed', err);
        // fallback: leave placeholders
      });
  }

  // init
  fetchStats();
})();
