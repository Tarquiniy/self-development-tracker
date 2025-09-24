// frontend/src/app/page.tsx
"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import Image from "next/image";
import { useState, useEffect } from "react";

interface Post {
  id: number;
  title: string;
  excerpt: string;
  featured_image?: string;
  slug: string;
  published_at: string;
}

export default function HomePage() {
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchPosts() {
      try {
        const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/blog/posts/`);
        const data = await res.json();
        setPosts(data.results || data);
      } catch (err) {
        console.error("Ошибка загрузки постов", err);
      } finally {
        setLoading(false);
      }
    }
    fetchPosts();
  }, []);

  return (
    <main className="min-h-screen bg-white dark:bg-neutral-950 transition-colors duration-300">
      {/* Hero Section */}
      <section className="relative overflow-hidden bg-gradient-to-r from-pink-500/10 via-purple-500/10 to-blue-500/10 dark:from-pink-500/5 dark:via-purple-500/5 dark:to-blue-500/5">
        <div className="mx-auto max-w-7xl px-6 py-24 text-center">
          <motion.h1
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8 }}
            className="text-4xl font-extrabold tracking-tight text-gray-900 dark:text-white sm:text-6xl"
          >
            Добро пожаловать в <span className="text-pink-600">Positive Theta</span>
          </motion.h1>
          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3, duration: 0.8 }}
            className="mt-6 text-lg leading-8 text-gray-600 dark:text-gray-300 max-w-2xl mx-auto"
          >
            Здесь вы найдете статьи, которые вдохновляют, обучают и помогают развиваться. 
            Наш блог — это источник идей и энергии для вашего пути.
          </motion.p>
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.6, duration: 0.8 }}
            className="mt-10 flex justify-center gap-4"
          >
            <Link
              href="/blog"
              className="rounded-full bg-pink-600 px-6 py-3 text-white font-medium shadow-lg hover:bg-pink-700 transition"
            >
              Читать блог
            </Link>
            <Link
              href="/about"
              className="rounded-full border border-gray-300 dark:border-gray-700 px-6 py-3 text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-neutral-800 transition"
            >
              О нас
            </Link>
          </motion.div>
        </div>
      </section>

      {/* Posts Grid */}
      <section className="mx-auto max-w-7xl px-6 py-16">
        <h2 className="text-3xl font-bold tracking-tight text-gray-900 dark:text-white mb-10 text-center">
          Последние статьи
        </h2>

        {loading ? (
          <p className="text-center text-gray-500">Загрузка...</p>
        ) : (
          <div className="grid gap-10 sm:grid-cols-2 lg:grid-cols-3">
            {posts.map((post) => (
              <motion.div
                key={post.id}
                whileHover={{ scale: 1.02 }}
                className="rounded-2xl overflow-hidden bg-white dark:bg-neutral-900 shadow-md hover:shadow-xl transition"
              >
                {post.featured_image && (
                  <Image
                    src={post.featured_image}
                    alt={post.title}
                    width={400}
                    height={250}
                    className="h-56 w-full object-cover"
                  />
                )}
                <div className="p-6 flex flex-col h-full">
                  <h3 className="text-xl font-semibold text-gray-900 dark:text-white line-clamp-2">
                    {post.title}
                  </h3>
                  <p className="mt-3 text-gray-600 dark:text-gray-300 text-sm line-clamp-3">
                    {post.excerpt}
                  </p>
                  <div className="mt-auto pt-4">
                    <Link
                      href={`/blog/${post.slug}`}
                      className="text-pink-600 hover:text-pink-700 font-medium"
                    >
                      Читать →
                    </Link>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </section>

      {/* CTA Section */}
      <section className="bg-gradient-to-r from-pink-600 to-purple-600 text-white py-20">
        <div className="mx-auto max-w-4xl text-center px-6">
          <h2 className="text-3xl sm:text-4xl font-bold">
            Присоединяйтесь к нашему сообществу
          </h2>
          <p className="mt-4 text-lg text-pink-100">
            Подпишитесь на рассылку, чтобы получать лучшие статьи и эксклюзивные материалы прямо на почту.
          </p>
          <form className="mt-8 flex flex-col sm:flex-row gap-4 justify-center">
            <input
              type="email"
              placeholder="Ваш email"
              className="w-full sm:w-80 px-4 py-3 rounded-full text-gray-900 focus:outline-none focus:ring-2 focus:ring-white"
            />
            <button
              type="submit"
              className="rounded-full bg-white px-6 py-3 text-pink-600 font-medium shadow hover:bg-gray-100 transition"
            >
              Подписаться
            </button>
          </form>
        </div>
      </section>
    </main>
  );
}
