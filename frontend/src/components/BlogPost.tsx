// src/pages/BlogPost.tsx
import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { fetchPostBySlug, PostFull } from '../services/wpApi';

const BlogPost: React.FC = () => {
  const { slug } = useParams<{slug: string}>();
  const [post, setPost] = useState<PostFull | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!slug) return;
    let mounted = true;
    fetchPostBySlug(slug)
      .then(p => { if (mounted) setPost(p); })
      .catch(e => { console.error(e); if (mounted) setError(String(e)); });
    return () => { mounted = false; };
  }, [slug]);

  if (error) return <main className="container"><h1>Ошибка</h1><p>{error}</p></main>;
  if (!post) return <main className="container"><p>Загрузка...</p></main>;

  return (
    <main className="container" style={{padding:'28px 0'}}>
      <article className="post-article">
        <h1 dangerouslySetInnerHTML={{__html: post.title}} />
        <div className="post-meta">{new Date(post.date).toLocaleDateString()}</div>
        {post.featured_image_url && <img src={post.featured_image_url} alt={post.title} style={{width:'100%', borderRadius:12}} />}
        <div className="post-content" dangerouslySetInnerHTML={{__html: post.content}} />
      </article>
    </main>
  );
};

export default BlogPost;
