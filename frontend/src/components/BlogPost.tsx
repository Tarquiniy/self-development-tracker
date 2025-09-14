// frontend/src/components/BlogPost.tsx
import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { fetchPostBySlug, type PostFull } from '../services/api';

const BlogPost: React.FC = () => {
  const { slug } = useParams<{ slug?: string }>();
  const [post, setPost] = useState<PostFull | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!slug) {
      setError('Нет slug');
      setLoading(false);
      return;
    }
    let isMounted = true;

    const loadPost = async () => {
      setLoading(true);
      setError(null);
      try {
        const p: PostFull = await fetchPostBySlug(slug);
        if (isMounted) setPost(p);
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        if (isMounted) setError(msg);
        console.error('Error in fetchPostBySlug:', err);
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    loadPost();

    return () => {
      isMounted = false;
    };
  }, [slug]);

  if (loading) return <div className="py-12 text-center">Загрузка...</div>;
  if (error) return <div className="py-12 text-center text-red-600">Ошибка: {error}</div>;
  if (!post) return <div className="py-12 text-center">Пост не найден</div>;

  return (
    <main className="max-w-3xl mx-auto px-4 py-8">
      <h1
        className="text-4xl font-extrabold mb-4"
        dangerouslySetInnerHTML={{ __html: post.title }}
      />
      <div className="text-gray-500 mb-6">{new Date(post.date).toLocaleDateString()}</div>
      {post.featured_image_url && (
        <img
          src={post.featured_image_url}
          alt=""
          className="w-full h-80 object-cover mb-6 rounded"
        />
      )}
      <article
        className="prose max-w-none"
        dangerouslySetInnerHTML={{ __html: post.content }}
      />
    </main>
  );
};

export default BlogPost;
