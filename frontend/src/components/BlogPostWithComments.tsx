// frontend/src/components/BlogPostWithComments.tsx
import React, { useEffect, useState } from 'react';
import { fetchPostBySlug, PostFull } from '../services/wpApi';
import { fetchCommentsForPost, postCommentForPostSlug, WPComment } from '../services/commentsApi';
import { getReactions, toggleReaction } from '../services/reactionsApi';

type Props = {
  slug: string;
};

function formatDate(d: string) {
  try { return new Date(d).toLocaleString(); } catch (e) { return d; }
}

export default function BlogPostWithComments({ slug }: Props) {
  const [post, setPost] = useState<PostFull | null>(null);
  const [comments, setComments] = useState<WPComment[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [commentContent, setCommentContent] = useState('');
  const [authorName, setAuthorName] = useState('');
  const [authorEmail, setAuthorEmail] = useState('');
  const [parentId, setParentId] = useState<number | null>(null);

  const [likesCount, setLikesCount] = useState(0);
  const [liked, setLiked] = useState(false);

  useEffect(() => {
    setLoading(true);
    setError(null);
    Promise.all([
      fetchPostBySlug(slug).catch(e => { throw e; }),
      fetchCommentsForPost(slug).catch(e => { console.error(e); return []; }),
    ])
      .then(async ([p, c]) => {
        setPost(p);
        setComments(c as WPComment[]);
        try {
          const r = await getReactions(String(p.id || p.slug));
          setLikesCount(r.likes_count);
          setLiked(r.liked_by_current_user);
        } catch (e) {
          console.warn('Reactions fetch failed', e);
        }
      })
      .catch((e) => setError(String(e)))
      .finally(() => setLoading(false));
  }, [slug]);

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
        parent: parentId || 0,
        author_name: authorName || undefined,
        author_email: authorEmail || undefined,
      });
      // reload comments
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
      const res = await toggleReaction(String(post?.id ?? post?.slug ?? slug));
      setLikesCount(res.likes_count);
      setLiked(res.liked_by_current_user);
    } catch (e) {
      console.error(e);
      setError(String(e));
    }
  }

  if (loading && !post) return <div>Загрузка...</div>;
  if (error && !post) return <div>Ошибка: {error}</div>;
  if (!post) return null;

  return (
    <main className="container blog-post">
      <article>
        <h1 dangerouslySetInnerHTML={{ __html: post.title }} />
        <div className="meta">
          <span>{formatDate(post.date)}</span>
        </div>
        {post.featured_image_url && (
          <img src={post.featured_image_url} alt="featured" style={{ width: '100%', maxHeight: 400, objectFit: 'cover' }} />
        )}
        <section dangerouslySetInnerHTML={{ __html: post.content }} />
        <div style={{ marginTop: 16 }}>
          <button className={`btn-like ${liked ? 'liked' : ''}`} onClick={onToggleLike}>👍 {likesCount}</button>
        </div>
      </article>

      <hr />

      <section className="comments">
        <h2>Комментарии ({comments.length})</h2>

        {comments.length === 0 && <div>Пока нет комментариев — будь первым!</div>}

        <div className="comments-list">
          {comments.filter(c => !c.parent || c.parent === 0).map(c => (
            <CommentItem key={c.id} comment={c} allComments={comments} onReply={(id) => setParentId(id)} />
          ))}
        </div>

        <div className="comment-form" style={{ marginTop: 24 }}>
          <h3>Оставить комментарий</h3>
          <label style={{ display: 'block', marginBottom: 6 }}>
            Имя
            <input value={authorName} onChange={e => setAuthorName(e.target.value)} style={{ width: '100%' }} />
          </label>
          <label style={{ display: 'block', marginBottom: 6 }}>
            Email (необязательно)
            <input value={authorEmail} onChange={e => setAuthorEmail(e.target.value)} style={{ width: '100%' }} />
          </label>
          <label style={{ display: 'block', marginBottom: 6 }}>
            Комментарий
            <textarea rows={6} value={commentContent} onChange={e => setCommentContent(e.target.value)} style={{ width: '100%' }} />
          </label>

          {parentId ? (
            <div>
              Ответ на комментарий #{parentId} <button onClick={() => setParentId(null)}>Отменить</button>
            </div>
          ) : null}

          <div style={{ marginTop: 8 }}>
            <button onClick={submitComment}>Отправить</button>
            {error && <div style={{ color: 'red' }}>{error}</div>}
          </div>
        </div>
      </section>

      return (
    <main className="container blog-post">
      <article>
        {/* ... */}
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

        {/* ... */}

        <div className="comment-form">
          {/* форма */}
        </div>
      </section>
    </main>
  );
    </main>
  );
}

/** Компонент для одного комментария, рекурсивно рендерим ответы */
function CommentItem({ comment, allComments, onReply }: { comment: WPComment; allComments: WPComment[]; onReply: (id:number)=>void }) {
  const children = allComments.filter(c => c.parent === comment.id);
  return (
    <div style={{ marginBottom: 12, paddingLeft: comment.parent ? 20 : 0, borderLeft: comment.parent ? '2px solid #eee' : 'none' }}>
      <div style={{ fontWeight: 600 }}>{comment.author_name || 'Гость'} — <small>{new Date(comment.date).toLocaleString()}</small></div>
      <div dangerouslySetInnerHTML={{ __html: (comment.content as any).rendered || (comment.content as any).raw || '' }} />
      <div><button onClick={() => onReply(comment.id)}>Ответить</button></div>
      {children.map(ch => <CommentItem key={ch.id} comment={ch} allComments={allComments} onReply={onReply} />)}
    </div>
  );
}
