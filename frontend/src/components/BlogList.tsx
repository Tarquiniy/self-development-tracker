// frontend/src/components/BlogList.tsx
import React, { useEffect, useState } from 'react';
import { Helmet } from 'react-helmet-async';
import { fetchPosts, Post } from '../services/blogApi';
import PostCard from './PostCard';
import './BlogList.css';

const BlogList: React.FC = () => {
  const [posts, setPosts] = useState<Post[]>([]);
  const [page, setPage] = useState(1);
  const [count, setCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadPosts = async (pageNum: number) => {
  try {
    setLoading(true);
    setError(null);
    const data = await fetchPosts(pageNum);

    console.log("✅ Загруженные посты:", data); // <<< добавлено для проверки

    setPosts(data.results ?? []);
    setCount(data.count ?? 0);
  } catch (err: any) {
    setError(err.message || 'Ошибка загрузки постов');
    console.error('Failed to load posts:', err);
  } finally {
    setLoading(false);
  }
};

  useEffect(() => {
    loadPosts(page);
  }, [page]);

  const handleRetry = () => {
    loadPosts(page);
  };

  return (
    <div className="blog-list-container">
      <Helmet>
        <title>Блог | Positive Theta</title>
        <meta
          name="description"
          content="Читайте статьи о саморазвитии, продуктивности и современных практиках личностного роста."
        />
      </Helmet>

      <div className="blog-header">
        <h1>Блог о саморазвитии</h1>
        <p>Статьи, советы и методики для личностного роста</p>
      </div>

      {error && (
        <div className="error-message">
          <p>{error}</p>
          <button onClick={handleRetry} className="retry-button">
            Попробовать снова
          </button>
        </div>
      )}

      {loading && (
        <div className="loading-container">
          <div className="loading-spinner"></div>
          <p>Загрузка статей...</p>
        </div>
      )}

      {!loading && !error && posts.length === 0 && (
        <div className="empty-state">
          <p>Пока нет опубликованных статей</p>
        </div>
      )}

      {!loading && !error && posts.length > 0 && (
        <>
          <div className="posts-grid">
            {posts.map((post) => (
              <PostCard key={post.id} post={post} />
            ))}
          </div>

          <div className="pagination">
            {page > 1 && (
              <button 
                onClick={() => setPage(page - 1)} 
                className="pagination-button"
              >
                ← Назад
              </button>
            )}
            
            <span className="page-info">
              Страница {page}
            </span>
            
            {page * 10 < count && (
              <button 
                onClick={() => setPage(page + 1)} 
                className="pagination-button"
              >
                Вперёд →
              </button>
            )}
          </div>
        </>
      )}
    </div>
  );
};

export default BlogList;
