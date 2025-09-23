// frontend/src/components/BlogPost.tsx
import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import DOMPurify from 'dompurify';
import { fetchPost, fetchReaction, toggleReaction, Post } from '../services/blogApi';
import './BlogPost.css';

/**
 * Безопасно фильруем CSS-стили, разрешая только набор безопасных свойств.
 * Любые выражения с 'expression', 'javascript:', 'behavior', 'url(' будут отброшены.
 */
const allowedCssProperties = new Set([
  'color',
  'background',
  'background-color',
  'text-align',
  'font-family',
  'font-size',
  'line-height',
  'font-weight',
  'margin',
  'margin-top',
  'margin-bottom',
  'margin-left',
  'margin-right',
  'padding',
  'padding-top',
  'padding-bottom',
  'padding-left',
  'padding-right',
  'text-decoration',
  'letter-spacing',
  'word-spacing',
  'white-space',
  'vertical-align',
  'display',
  'width',
  'height',
  'max-width',
  'min-width',
  'border',
  'border-radius'
]);

function sanitizeStyle(styleString: string): string | null {
  if (!styleString) return null;
  const parts = styleString
    .split(';')
    .map(p => p.trim())
    .filter(Boolean);

  const cleanedParts: string[] = [];

  for (const part of parts) {
    const idx = part.indexOf(':');
    if (idx === -1) continue;
    const prop = part.slice(0, idx).trim().toLowerCase();
    const val = part.slice(idx + 1).trim();

    if (!allowedCssProperties.has(prop)) continue;

    const low = val.toLowerCase();
    if (
      low.includes('expression(') ||
      low.includes('javascript:') ||
      low.includes('behavior:') ||
      low.includes('vbscript:') ||
      low.includes('<') ||
      low.includes('>') ||
      // опасные url-ы отфильтровываем (мы разрешаем url только в редких свойствах)
      (low.includes('url(') && !prop.includes('background') && !prop.includes('image'))
    ) {
      continue;
    }

    // безопасное значение — оставляем как есть (без дополнительных модификаций)
    cleanedParts.push(`${prop}: ${val}`);
  }

  return cleanedParts.length ? cleanedParts.join('; ') : null;
}

/**
 * Добавляем hook единожды — он будет фильтровать атрибут style и align.
 * Guard через window.__dompurify_hook_added, чтобы не дублировать hook при HMR/повторном импорте.
 */
if (typeof window !== 'undefined' && !(window as any).__dompurify_hook_added) {
  DOMPurify.addHook('uponSanitizeAttribute', (node: Element, data: any) => {
    const an = (data.attrName || '').toLowerCase();
    const av = data.attrValue;

    // Стиль — пропускаем только разрешённые свойства
    if (an === 'style' && typeof av === 'string') {
      const cleaned = sanitizeStyle(av);
      if (cleaned) {
        data.attrValue = cleaned;
      } else {
        data.keepAttr = false; // убираем стиль если ничего безопасного не осталось
      }
      return;
    }

    // align -> переводим в style="text-align: ...;"
    if (an === 'align') {
      const v = String(av).toLowerCase();
      if (['left', 'right', 'center', 'justify'].includes(v)) {
        // добавляем (или дополняем) inline-стиль элемента
        const current = node.getAttribute('style') || '';
        const appended = current ? `${current.trim().replace(/;$/,'')}; text-align: ${v};` : `text-align: ${v};`;
        node.setAttribute('style', appended);
      }
      data.keepAttr = false; // удаляем сам атрибут align
      return;
    }

    // убираем любые on* атрибуты (onclick/onerror и т.д.)
    if (/^on/i.test(an)) {
      data.keepAttr = false;
      return;
    }

    // можно добавить дополнительные фильтры при необходимости
  });

  (window as any).__dompurify_hook_added = true;
}

/**
 * sanitizeContent: позволяет inline-стили и классы, но только безопасные CSS-проперти.
 * Также разрешаем теги, которые обычно генерирует Summernote.
 */
function sanitizeContent(html: string): string {
  if (!html) return '';
  return DOMPurify.sanitize(html, {
    ALLOWED_TAGS: [
      'p','br','div','span','h1','h2','h3','h4','h5','h6',
      'ul','ol','li','blockquote','strong','em','b','i','u',
      'a','img','figure','figcaption','pre','code','hr','table','thead','tbody','tr','th','td','font'
    ],
    ALLOWED_ATTR: [
      'href','src','alt','title','style','class','width','height','color','face','align','id','target','rel'
    ],
    // Разрешаем относительные и абсолютные url для src/href, DOMPurify сам проверяет схему
  });
}

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

        // лайки
        try {
          const reactionData = await fetchReaction(slug);
          setLikes(reactionData.likes_count ?? 0);
        } catch (reactionError) {
          console.warn('Could not load reactions:', reactionError);
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
        <meta name="description" content={post.meta_description || post.excerpt || ''} />
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
            onError={(e) => { e.currentTarget.style.display = 'none'; }}
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
        {/* excerpt не рендерим на странице одной статьи */}
      </header>

      <div className="post-content">
        <div
          className="post-html-content"
          dangerouslySetInnerHTML={{ __html: sanitizeContent(post.content || '') }}
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
