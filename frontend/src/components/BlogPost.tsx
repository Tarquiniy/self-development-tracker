// frontend/src/components/BlogPost.tsx
import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { fetchPost, fetchReaction, toggleReaction, Post } from '../services/blogApi';
import './BlogPost.css';

const BlogPost: React.FC = () => {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const [post, setPost] = useState<Post | null>(null);
  const [likes, setLikes] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [liking, setLiking] = useState(false);

  useEffect(() => {
    if (!slug) {
      setError('Неверная ссылка на статью');
      setLoading(false);
      return;
    }

    const loadPost = async () => {
      try {
        setLoading(true);
        setError(null);
        
        const postData = await fetchPost(slug);
        setPost(postData);
        
        // Загружаем лайки
        try {
          const reactionData = await fetchReaction(slug);
          setLikes(reactionData.likes_count);
        } catch (reactionError) {
          console.warn('Could not load reactions:', reactionError);
          setLikes(0);
        }
      } catch (err: any) {
        setError(err.message || 'Ошибка загрузки статьи');
        console.error('Failed to load post:', err);
      } finally {
        setLoading(false);
      }
    };

    loadPost();
  }, [slug]);

  const handleLike = async () => {
    if (!slug || liking) return;
    
    try {
      setLiking(true);
      const reactionData = await toggleReaction(slug);
      setLikes(reactionData.likes_count);
    } catch (err) {
      console.error('Failed to toggle like:', err);
    } finally {
      setLiking(false);
    }
  };

  const handleBack = () => {
    navigate('/blog');
  };

  if (loading) {
    return (
      <div className="blog-post-container">
        <div className="loading-container">
          <div className="loading-spinner"></div>
          <p>Загрузка статьи...</p>
        </div>
      </div>
    );
  }

  if (error || !post) {
    return (
      <div className="blog-post-container">
        <div className="error-message">
          <h2>Ошибка</h2>
          <p>{error || 'Статья не найдена'}</p>
          <button onClick={handleBack} className="back-button">
            Вернуться к списку статей
          </button>
        </div>
      </div>
    );
  }

  return (
    <article className="blog-post-container">
      <Helmet>
        <title>{post.meta_title || post.title} | Positive Theta</title>
        <meta name="description" content={post.meta_description || post.excerpt} />
        {post.og_image && <meta property="og:image" content={post.og_image} />}
      </Helmet>

      <button onClick={handleBack} className="back-button">
        ← Назад к статьям
      </button>

      <header className="post-header">
        {post.featured_image && (
          <img 
            src={post.featured_image} 
            alt={post.title} 
            className="post-image"
            onError={(e) => {
              // Fallback если изображение не загружается
              e.currentTarget.style.display = 'none';
            }}
          />
        )}
        
        <div className="post-meta">
          <time className="post-date">
            {new Date(post.published_at).toLocaleDateString('ru-RU', {
              year: 'numeric',
              month: 'long',
              day: 'numeric'
            })}
          </time>
          
          {post.author && (
            <span className="post-author">Автор: {post.author}</span>
          )}
        </div>

        <h1 className="post-title">{post.title}</h1>
        
        {post.excerpt && (
          <p className="post-excerpt">{post.excerpt}</p>
        )}
      </header>

      <div className="post-content">
        <div 
          dangerouslySetInnerHTML={{ __html: post.content || '' }} 
          className="post-html-content"
        />
      </div>

      <footer className="post-footer">
        <div className="post-actions">
          <button 
            onClick={handleLike} 
            disabled={liking}
            className={`like-button ${liking ? 'liking' : ''}`}
          >
            ❤️ {likes}
          </button>
        </div>

        {(post.categories?.length > 0 || post.tags?.length > 0) && (
          <div className="post-taxonomies">
            {post.categories?.length > 0 && (
              <div className="categories">
                <strong>Категории:</strong>{' '}
                {post.categories.map(cat => cat.title).join(', ')}
              </div>
            )}
            
            {post.tags?.length > 0 && (
              <div className="tags">
                <strong>Теги:</strong>{' '}
                {post.tags.map(tag => tag.title).join(', ')}
              </div>
            )}
          </div>
        )}
      </footer>
    </article>
  );
};

export default BlogPost;