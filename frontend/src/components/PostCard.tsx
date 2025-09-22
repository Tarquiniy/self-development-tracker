import React from 'react';
import { Link } from 'react-router-dom';
import type { Post } from '../services/blogApi';
import './PostCard.css';

const PostCard: React.FC<{ post: Post }> = ({ post }) => {
  return (
    <article className="post-card">
      {post.featured_image && (
        <Link to={`/blog/${post.slug}`}>
          <img className="media" src={post.featured_image} alt={post.title} />
        </Link>
      )}
      <div className="body">
        <h2>
          <Link to={`/blog/${post.slug}`}>{post.title}</Link>
        </h2>
        <p
          className="excerpt"
          dangerouslySetInnerHTML={{ __html: post.excerpt }}
        />
        <div className="meta">
          <time>{new Date(post.published_at).toLocaleDateString()}</time>
          {post.categories?.length > 0 && (
            <span className="categories">
              {post.categories.map((c) => c.title).join(', ')}
            </span>
          )}
        </div>
      </div>
    </article>
  );
};

export default PostCard;
