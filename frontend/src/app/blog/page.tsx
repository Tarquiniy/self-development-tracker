// frontend/src/app/blog/page.tsx
"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import Image from "next/image";
import { motion } from "framer-motion";

interface Category {
  id: number;
  title: string;
  slug: string;
}

interface Post {
  id: number;
  title: string;
  excerpt: string;
  featured_image?: string;
  slug: string;
  published_at: string;
  categories: Category[];
}

export default function BlogPage() {
  const [posts, setPosts] = useState<Post[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [hasNext, setHasNext] = useState(false);

  useEffect(() => {
    async function fetchCategories() {
      try {
        const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/blog/categories/`);
        const data = await res.json();
        setCategories(data);
      } catch (err) {
        console.error("Ошибка загрузки категорий", err);
      }
    }
    fetchCategories();
  }, []);

  useEffect(() => {
    async function fetchPosts() {
      setLoading(true);
      try {
        const query = new URLSearchParams({
          page: String(page),
          search: search,
          ...(selectedCategory ? { "categories__slug": selectedCategory } : {}),
        });
        const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/blog/posts/?${query.toString()}`);
        const data = await res.json();
        setPosts(data.results || data);
        setHasNext(Boolean(data.next));
      } catch (err) {
        console.error("Ошибка загрузки постов", err);
      } finally {
        setLoading(false);
      }
    }
    fetchPosts();
  }, [page, search, selectedCategory]);

  return (
    <main className="min-h-screen bg-white dark:bg-neutral-950 transition-colors duration-300">
      <section className="mx-auto max-w-7xl px-6 py-16">
        <h1 className="text-4xl font-extrabold tracking-tight text-gray-900 dark:text-white mb-10 text-center">
          Блог Positive Theta
        </h1>

        {/* Фильтры */}
        <div className="flex flex-col md:flex-row gap-6 mb-10 justify-between items-center">
          <input
            type="text"
            placeholder="Поиск статей..."
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            className="w-full md:w-1/2 rounded-full border border-gray-300 dark:border-gray-700 bg-white dark:bg-neutral-900 px-4 py-2 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-pink-600"
          />

          <div className="flex flex-wrap gap-3">
            <button
              onClick={() => {
                setSelectedCategory(null);
                setPage(1);
              }}
              className={`px-4 py-2 rounded-full text-sm font-medium transition ${
                !selectedCategory
                  ? "bg-pink-600 text-white"
                  : "bg-gray-200 dark:bg-neutral-800 text-gray-700 dark:text-gray-300"
              }`}
            >
              Все
            </button>
            {categories.map((cat) => (
              <button
                key={cat.id}
                onClick={() => {
                  setSelectedCategory(cat.slug);
                  setPage(1);
                }}
                className={`px-4 py-2 rounded-full text-sm font-medium transition ${
                  selectedCategory === cat.slug
                    ? "bg-pink-600 text-white"
                    : "bg-gray-200 dark:bg-neutral-800 text-gray-700 dark:text-gray-300"
                }`}
              >
                {cat.title}
              </button>
            ))}
          </div>
        </div>

        {/* Список постов */}
        {loading ? (
          <p className="text-center text-gray-500">Загрузка...</p>
        ) : posts.length === 0 ? (
          <p className="text-center text-gray-500">Нет статей по вашему запросу.</p>
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

        {/* Пагинация */}
        <div className="flex justify-center items-center gap-6 mt-12">
          <button
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page === 1}
            className="px-4 py-2 rounded-full border border-gray-300 dark:border-gray-700 text-gray-700 dark:text-gray-300 disabled:opacity-40"
          >
            ← Назад
          </button>
          <span className="text-gray-600 dark:text-gray-400">Страница {page}</span>
          <button
            onClick={() => setPage((p) => p + 1)}
            disabled={!hasNext}
            className="px-4 py-2 rounded-full border border-gray-300 dark:border-gray-700 text-gray-700 dark:text-gray-300 disabled:opacity-40"
          >
            Вперёд →
          </button>
        </div>
      </section>
    </main>
  );
}
