import React from 'react';
import { useParams } from 'react-router-dom';
import BlogPostWithComments from './BlogPostWithComments';

const BlogPostPage: React.FC = () => {
  const { slug } = useParams<{ slug: string }>();
  if (!slug) {
    return <div>Ошибка: нет slug</div>;
  }
  return <BlogPostWithComments slug={slug} />;
};

export default BlogPostPage;
