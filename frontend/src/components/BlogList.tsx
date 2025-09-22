import React, { useEffect, useState } from 'react';
import { Helmet } from 'react-helmet-async';
import { fetchPosts, Post } from '../services/blogApi';
import PostCard from './PostCard';

const BlogList: React.FC = () => {
  const [posts, setPosts] = useState<Post[]>([]);
  const [page, setPage] = useState(1);
  const [count, setCount] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    fetchPosts(page)
      .then((data) => {
        setPosts(data.results);
        setCount(data.count);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [page]);

  return (
    <div className="blog-list">
      <Helmet>
        <title>Блог | Self Development Tracker</title>
        <meta
          name="description"
          content="Читайте статьи о саморазвитии, продуктивности и современных практиках."
        />
      </Helmet>

      <h1>Блог</h1>

      {loading && <p>Загрузка...</p>}

      {!loading && posts.length === 0 && <p>Нет постов</p>}

      {posts.map((post) => (
        <PostCard key={post.id} post={post} />
      ))}

      <div className="pagination">
        {page > 1 && <button onClick={() => setPage(page - 1)}>Назад</button>}
        {page * 10 < count && (
          <button onClick={() => setPage(page + 1)}>Вперёд</button>
        )}
      </div>
    </div>
  );
};

export default BlogList;
