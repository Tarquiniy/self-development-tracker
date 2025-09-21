import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { fetchCommentsForPost, postCommentForPostSlug, WPComment } from '../services/commentsApi';
import { getReactions, toggleReaction } from '../services/reactionsApi';
import './BlogPostWithComments.css';

type Props = {
  slug: string;
};

type PostContent = {
  title: string;
  content: string;
  date: string;
  featured_image?: number;
};

function formatDate(d: string) {
  try {
    return new Date(d).toLocaleString();
  } catch (e) {
    return d;
  }
}

export default function BlogPostWithComments({ slug }: Props) {
  const [post, setPost] = useState<PostContent | null>(null);
  const [comments, setComments] = useState<WPComment[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [commentContent, setCommentContent] = useState('');
  const [authorName, setAuthorName] = useState('');
  const [authorEmail, setAuthorEmail] = useState('');
  const [parentId, setParentId] = useState<number | null>(null);

  const [likesCount, setLikesCount] = useState(0);
  const [liked, setLiked] = useState(false);

  const API_BASE = import.meta.env.VITE_API_BASE_URL || 'https://sdracker.onrender.com';

  useEffect(() => {
    let isMounted = true;
    setLoading(true);
    setError(null);

    (async () => {
      try {
        // Загружаем контент поста
        const response = await fetch(`${API_BASE}/api/wordpress/posts/content/${slug}/`);
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const postData: PostContent = await response.json();
        if (!isMounted) return;
        setPost(postData);

        // Загружаем комментарии
        const c = await fetchCommentsForPost(slug);
        if (!isMounted) return;
        setComments(c);

        // Загружаем реакции
        try {
          // Используем ID поста для реакций
          const postId = await getPostIdFromSlug(slug);
          if (postId) {
            const r = await getReactions(String(postId));
            if (!isMounted) return;
            setLikesCount(r.likes_count);
            setLiked(r.liked_by_current_user);
          }
        } catch (e) {
          console.warn('Reactions fetch failed', e);
          setLikesCount(0);
          setLiked(false);
        }
      } catch (e) {
        if (!isMounted) return;
        setError(String(e));
      } finally {
        if (isMounted) setLoading(false);
      }
    })();

    return () => {
      isMounted = false;
    };
  }, [slug, API_BASE]);

  // Функция для получения ID поста по slug
  async function getPostIdFromSlug(slug: string): Promise<number | null> {
    try {
      const response = await fetch(
        `https://cs88500-wordpress-o0a99.tw1.ru/wp-json/wp/v2/posts?slug=${slug}`
      );
      const data = await response.json();
      return data[0]?.id || null;
    } catch (e) {
      console.error('Failed to get post ID:', e);
      return null;
    }
  }

  async function submitComment() {
    if (!commentContent.trim()) {
      setError('Введите текст комментария');
      return;
    }
    try {
      setLoading(true);
      await postCommentForPostSlug({
        postSlug: slug,
        content: commentContent,
        parent: parentId || undefined,
        author_name: authorName || undefined,
        author_email: authorEmail || undefined,
      });
      const fresh = await fetchCommentsForPost(slug);
      setComments(fresh);
      setCommentContent('');
      setAuthorName('');
      setAuthorEmail('');
      setParentId(null);
      setError(null);
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  }

  async function onToggleLike() {
    try {
      const postId = await getPostIdFromSlug(slug);
      if (!postId) return;
      
      const res = await toggleReaction(String(postId));
      setLikesCount(res.likes_count);
      setLiked(res.liked_by_current_user);
    } catch (e) {
      console.error(e);
      setError(String(e));
    }
  }

  if (loading && !post) {
    return <div>Загрузка...</div>;
  }
  if (error && !post) {
    return <div>Ошибка: {error}</div>;
  }
  if (!post) {
    return null;
  }

  return (
    <main className="container blog-post">
      <article>
        <h1 dangerouslySetInnerHTML={{ __html: post.title }} />
        <div className="meta">{formatDate(post.date)}</div>
        
        {/* Отображаем контент напрямую */}
        <div 
          className="wp-content"
          dangerouslySetInnerHTML={{ __html: post.content }}
        />
        
        <div style={{ marginTop: 16 }}>
          <button
            className={`btn-like ${liked ? 'liked' : ''}`}
            onClick={onToggleLike}
          >
            👍 {likesCount}
          </button>
        </div>
      </article>

      <hr />

      <section className="comments">
        <h2>Комментарии ({comments.length})</h2>

        {comments.length === 0 && <div>Пока нет комментариев — будь первым!</div>}

        <div className="comments-list">
          {comments
            .filter(c => !c.parent || c.parent === 0)
            .map(c => (
              <CommentItem
                key={c.id}
                comment={c}
                allComments={comments}
                onReply={(id) => setParentId(id)}
              />
            ))}
        </div>

        <div className="comment-form">
          <h3>Оставить комментарий</h3>
          <label>
            Имя
            <input
              type="text"
              value={authorName}
              onChange={e => setAuthorName(e.target.value)}
            />
          </label>
          <label>
            Email (необязательно)
            <input
              type="email"
              value={authorEmail}
              onChange={e => setAuthorEmail(e.target.value)}
            />
          </label>
          <label>
            Комментарий
            <textarea
              rows={6}
              value={commentContent}
              onChange={e => setCommentContent(e.target.value)}
            />
          </label>

          {parentId ? (
            <div>
              Ответ на комментарий #{parentId}{' '}
              <button onClick={() => setParentId(null)}>Отменить</button>
            </div>
          ) : null}

          <div>
            <button onClick={submitComment} disabled={loading}>
              {loading ? 'Отправка...' : 'Отправить'}
            </button>
          </div>

          {error && (
            <div style={{ color: 'red', marginTop: 8 }}>{error}</div>
          )}
        </div>
      </section>
    </main>
  );
}

function CommentItem({
  comment,
  allComments,
  onReply,
}: {
  comment: WPComment;
  allComments: WPComment[];
  onReply: (id: number) => void;
}) {
  const children = allComments.filter(c => c.parent === comment.id);
  const hasParent = !!comment.parent && comment.parent !== 0;

  return (
    <div className={hasParent ? 'has-parent' : ''}>
      <div style={{ fontWeight: 600 }}>
        {comment.author_name || 'Гость'} —{' '}
        <small>{new Date(comment.date).toLocaleString()}</small>
      </div>
      <div
        dangerouslySetInnerHTML={{
          __html:
            (comment.content as any).rendered ||
            (comment.content as any).raw ||
            '',
        }}
      />
      <div>
        <button onClick={() => onReply(comment.id)}>Ответить</button>
      </div>
      {children.map(ch => (
        <CommentItem
          key={ch.id}
          comment={ch}
          allComments={allComments}
          onReply={onReply}
        />
      ))}
    </div>
  );
}