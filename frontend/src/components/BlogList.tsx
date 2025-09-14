// frontend/src/components/BlogList.tsx
import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { fetchPosts, type PostSummary } from '../services/api';;

const BlogList: React.FC = () => {
  const [posts, setPosts] = useState<PostSummary[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState<number>(1);

  useEffect(() => {
    let isMounted = true;

    const loadPosts = async () => {
      setLoading(true);
      setError(null);
      try {
        const data: PostSummary[] = await fetchPosts(page, 10);
        if (isMounted) {
          setPosts(data);
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        if (isMounted) setError(msg);
        console.error('Error in fetchPosts:', err);
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    loadPosts();

    return () => {
      isMounted = false;
    };
  }, [page]);

  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold mb-6">Блог</h1>

      {loading && <div className="text-center py-12">Загрузка...</div>}
      {error && <div className="text-center py-12 text-red-600">Ошибка: {error}</div>}

      {!loading && !error && (
        <>
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {posts.map(post => (
              <article key={post.id} className="rounded-lg shadow-sm border overflow-hidden">
                {post.featured_image_url ? (
                  <img
                    src={post.featured_image_url}
                    alt=""
                    className="w-full h-40 object-cover"
                  />
                ) : (
                  <div className="w-full h-40 bg-gray-100 flex items-center justify-center text-gray-400">
                    Нет изображения
                  </div>
                )}
                <div className="p-4">
                  <Link to={`/blog/${post.slug}`} className="no-underline">
                    <h2
                      className="text-xl font-semibold mb-2"
                      dangerouslySetInnerHTML={{ __html: post.title }}
                    />
                  </Link>
                  <div
                    className="text-gray-600 text-sm mb-3"
                    dangerouslySetInnerHTML={{ __html: post.excerpt }}
                  />
                  <div className="text-xs text-gray-400">
                    {new Date(post.date).toLocaleDateString()}
                  </div>
                </div>
              </article>
            ))}
          </div>

          <div className="mt-8 flex justify-between items-center">
            <button
              onClick={() => setPage(p => Math.max(1, p - 1))}
              disabled={page === 1}
              className="px-4 py-2 bg-gray-100 rounded disabled:opacity-50"
            >
              Назад
            </button>
            <div>Страница {page}</div>
            <button
              onClick={() => setPage(p => p + 1)}
              className="px-4 py-2 bg-gray-100 rounded"
            >
              Далее
            </button>
          </div>
        </>
      )}
    </div>
  );
};

export default BlogList;
