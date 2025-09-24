// frontend/src/app/blog/[slug]/page.tsx
"use client";

import { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import { motion } from "framer-motion";

interface Category {
  id: number;
  title: string;
  slug: string;
}

interface Tag {
  id: number;
  title: string;
  slug: string;
}

interface Comment {
  id: number;
  name: string;
  content: string;
  created_at: string;
}

interface Post {
  id: number;
  title: string;
  content: string;
  excerpt: string;
  featured_image?: string;
  slug: string;
  published_at: string;
  categories: Category[];
  tags: Tag[];
  comments: Comment[];
}

export default function BlogPostPage() {
  const params = useParams();
  const { slug } = params as { slug: string };

  const [post, setPost] = useState<Post | null>(null);
  const [loading, setLoading] = useState(true);
  const [comment, setComment] = useState("");
  const [sending, setSending] = useState(false);

  useEffect(() => {
    async function fetchPost() {
      try {
        const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/blog/posts/${slug}/`);
        const data = await res.json();
        setPost(data);
      } catch (err) {
        console.error("Ошибка загрузки поста", err);
      } finally {
        setLoading(false);
      }
    }
    if (slug) fetchPost();
  }, [slug]);

  async function handleAddComment(e: React.FormEvent) {
    e.preventDefault();
    if (!comment.trim()) return;
    setSending(true);
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/blog/posts/${slug}/add_comment/`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: "Гость", content: comment }),
      });
      if (res.ok) {
        const newComment = await res.json();
        setPost((prev) =>
          prev ? { ...prev, comments: [...prev.comments, newComment] } : prev
        );
        setComment("");
      }
    } catch (err) {
      console.error("Ошибка добавления комментария", err);
    } finally {
      setSending(false);
    }
  }

  if (loading) {
    return <p className="text-center mt-20 text-gray-500">Загрузка...</p>;
  }

  if (!post) {
    return <p className="text-center mt-20 text-gray-500">Статья не найдена.</p>;
  }

  return (
    <main className="min-h-screen bg-white dark:bg-neutral-950 transition-colors duration-300">
      {/* Hero Image */}
      {post.featured_image && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="relative w-full h-96"
        >
          <Image
            src={post.featured_image}
            alt={post.title}
            fill
            className="object-cover"
            priority
          />
          <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
            <h1 className="text-4xl sm:text-5xl font-extrabold text-white text-center drop-shadow-lg">
              {post.title}
            </h1>
          </div>
        </motion.div>
      )}

      <article className="mx-auto max-w-4xl px-6 py-16">
        {/* Meta */}
        <div className="mb-8 text-sm text-gray-600 dark:text-gray-400 flex flex-wrap items-center gap-4">
          <span>
            📅 {new Date(post.published_at).toLocaleDateString("ru-RU")}
          </span>
          {post.categories.map((cat) => (
            <Link
              key={cat.id}
              href={`/blog?category=${cat.slug}`}
              className="px-3 py-1 rounded-full bg-pink-100 dark:bg-pink-900/30 text-pink-700 dark:text-pink-300 text-xs font-medium"
            >
              {cat.title}
            </Link>
          ))}
        </div>

        {/* Content */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="prose dark:prose-invert max-w-none prose-lg prose-img:rounded-xl prose-a:text-pink-600 hover:prose-a:text-pink-700"
          dangerouslySetInnerHTML={{ __html: post.content }}
        />

        {/* Tags */}
        {post.tags.length > 0 && (
          <div className="mt-10 flex flex-wrap gap-2">
            {post.tags.map((tag) => (
              <span
                key={tag.id}
                className="px-3 py-1 rounded-full bg-gray-200 dark:bg-neutral-800 text-gray-700 dark:text-gray-300 text-xs font-medium"
              >
                #{tag.title}
              </span>
            ))}
          </div>
        )}

        {/* Comments */}
        <section className="mt-16">
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-6">
            Комментарии ({post.comments.length})
          </h2>

          <div className="space-y-6">
            {post.comments.map((c) => (
              <div
                key={c.id}
                className="p-4 rounded-lg bg-gray-100 dark:bg-neutral-900"
              >
                <p className="text-sm text-gray-700 dark:text-gray-300 font-semibold">
                  {c.name}
                </p>
                <p className="text-gray-600 dark:text-gray-400">{c.content}</p>
                <span className="text-xs text-gray-500">
                  {new Date(c.created_at).toLocaleDateString("ru-RU")}
                </span>
              </div>
            ))}
          </div>

          {/* Add Comment */}
          <form onSubmit={handleAddComment} className="mt-8">
            <textarea
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder="Оставьте комментарий..."
              className="w-full rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-neutral-900 p-3 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-pink-600"
              rows={4}
            />
            <button
              type="submit"
              disabled={sending}
              className="mt-4 rounded-full bg-pink-600 px-6 py-2 text-white font-medium shadow hover:bg-pink-700 transition disabled:opacity-50"
            >
              {sending ? "Отправка..." : "Отправить"}
            </button>
          </form>
        </section>
      </article>
    </main>
  );
}
