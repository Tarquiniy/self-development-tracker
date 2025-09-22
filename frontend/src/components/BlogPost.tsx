import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import {
  fetchPost,
  fetchReaction,
  toggleReaction,
  Post,
} from '../services/blogApi';
import { Helmet } from 'react-helmet-async';

// === Типы комментариев ===
interface Comment {
  id: number;
  post: number;
  parent: number | null;
  name: string;
  email?: string;
  user?: string;
  content: string;
  created_at: string;
  replies: Comment[];
}

// === Форма комментариев ===
const CommentForm: React.FC<{
  postId: number;
  parentId?: number | null;
  onSubmitted: () => void;
}> = ({ postId, parentId = null, onSubmitted }) => {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [content, setContent] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!content.trim() || !name.trim()) return;

    setLoading(true);
    const res = await fetch(`/api/blog/comments/`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        post: postId,
        parent: parentId,
        name,
        email,
        content,
      }),
    });

    setLoading(false);
    if (res.ok) {
      setContent('');
      onSubmitted();
    } else {
      alert('Ошибка при отправке комментария');
    }
  };

  return (
    <form onSubmit={handleSubmit} className="comment-form">
      <input
        type="text"
        placeholder="Имя*"
        value={name}
        onChange={(e) => setName(e.target.value)}
        required
      />
      <input
        type="email"
        placeholder="Email (необязательно)"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
      />
      <textarea
        placeholder="Ваш комментарий..."
        value={content}
        onChange={(e) => setContent(e.target.value)}
        required
      />
      <button type="submit" disabled={loading}>
        {loading ? 'Отправка...' : 'Отправить'}
      </button>
    </form>
  );
};

// === Один комментарий с вложенными ===
const CommentItem: React.FC<{
  comment: Comment;
  postId: number;
  onRefresh: () => void;
}> = ({ comment, postId, onRefresh }) => {
  const [replying, setReplying] = useState(false);

  return (
    <div className="comment">
      <p>
        <strong>{comment.user || comment.name}</strong>:{' '}
        <span dangerouslySetInnerHTML={{ __html: comment.content }} />
      </p>
      <small>{new Date(comment.created_at).toLocaleString()}</small>
      <div>
        <button onClick={() => setReplying(!replying)}>
          {replying ? 'Отмена' : 'Ответить'}
        </button>
      </div>
      {replying && (
        <CommentForm
          postId={postId}
          parentId={comment.id}
          onSubmitted={() => {
            setReplying(false);
            onRefresh();
          }}
        />
      )}
      {comment.replies?.length > 0 && (
        <div className="replies">
          {comment.replies.map((reply) => (
            <CommentItem
              key={reply.id}
              comment={reply}
              postId={postId}
              onRefresh={onRefresh}
            />
          ))}
        </div>
      )}
    </div>
  );
};

// === Список комментариев ===
const CommentSection: React.FC<{ post: Post }> = ({ post }) => {
  const [comments, setComments] = useState<Comment[]>([]);
  const [loading, setLoading] = useState(true);

  const loadComments = async () => {
    setLoading(true);
    const res = await fetch(`/api/blog/comments/?post=${post.id}`);
    if (res.ok) {
      const data = await res.json();
      setComments(data);
    }
    setLoading(false);
  };

  useEffect(() => {
    loadComments();
  }, [post.id]);

  return (
    <section className="comments">
      <h2>Комментарии</h2>
      {loading && <p>Загрузка комментариев...</p>}
      {!loading && comments.length === 0 && <p>Комментариев пока нет.</p>}

      {comments.map((c) => (
        <CommentItem
          key={c.id}
          comment={c}
          postId={post.id}
          onRefresh={loadComments}
        />
      ))}

      <h3>Оставить комментарий</h3>
      <CommentForm postId={post.id} onSubmitted={loadComments} />
    </section>
  );
};

// === Главный компонент поста ===
const BlogPost: React.FC = () => {
  const { slug } = useParams<{ slug: string }>();
  const [post, setPost] = useState<Post | null>(null);
  const [likes, setLikes] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (slug) {
      setLoading(true);
      fetchPost(slug)
        .then((p) => {
          setPost(p);
          setLoading(false);
          return fetchReaction(p.slug);
        })
        .then((r) => setLikes(r.likes_count))
        .catch(() => setLoading(false));
    }
  }, [slug]);

  if (loading) return <p>Загрузка...</p>;
  if (!post) return <p>Пост не найден</p>;

  return (
    <article className="blog-post">
      <Helmet>
        <title>{post.meta_title}</title>
        <meta name="description" content={post.meta_description} />
        {post.og_image && <meta property="og:image" content={post.og_image} />}
      </Helmet>

      {post.featured_image && (
        <img src={post.featured_image} alt={post.title} className="post-image" />
      )}
      <h1>{post.title}</h1>
      <time>{new Date(post.published_at).toLocaleDateString()}</time>
      <div dangerouslySetInnerHTML={{ __html: post.content }} />

      <div className="likes">
        <button
          onClick={async () => {
            const r = await toggleReaction(post.slug);
            setLikes(r.likes_count);
          }}
        >
          ❤️ {likes}
        </button>
      </div>

      <CommentSection post={post} />
    </article>
  );
};

export default BlogPost;
