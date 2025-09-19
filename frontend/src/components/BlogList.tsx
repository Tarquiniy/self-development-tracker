// src/pages/BlogList.tsx
import React, { useEffect, useState } from 'react';
import { fetchPosts, PostSummary } from '../services/wpApi';
import PostCard from '../components/PostCard';

const BlogList: React.FC = () => {
  const [posts, setPosts] = useState<PostSummary[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    fetchPosts(1,10)
      .then(p => { if (mounted) setPosts(p); })
      .catch(e => { console.error('Error in fetchPosts:', e); if (mounted) setError(String(e)); })
      .finally(() => { if (mounted) setLoading(false); });
    return () => { mounted = false; };
  }, []);

  return (
    <main className="container" style={{padding: '28px 0'}}>
      <h1>Блог</h1>
      {error && <div style={{color:'crimson'}}>Ошибка: {error}</div>}
      {loading && <div>Загрузка...</div>}
      <section className="blog-grid">
        {posts.map(p => <PostCard key={p.id} post={p} />)}
      </section>
    </main>
  );
};

export default BlogList;
