// src/components/PostCard.tsx
import React from 'react';
import { Link } from 'react-router-dom';
import type { PostSummary } from '../services/wpApi';
import './PostCard.css';

const PostCard: React.FC<{post: PostSummary}> = ({post}) => {
  return (
    <article className="post-card">
      {post.featured_image_url && <img className="media" src={post.featured_image_url} alt={post.title} />}
      <div className="body">
        {/* Change this line to use the new route */}
        <h2><Link to={`/post/${post.slug}`}>{post.title}</Link></h2>
        <p className="excerpt" dangerouslySetInnerHTML={{__html: post.excerpt}} />
        <div className="kv">{new Date(post.date).toLocaleDateString()}</div>
      </div>
    </article>
  );
};

export default PostCard;
