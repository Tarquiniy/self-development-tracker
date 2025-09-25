// app/blog/page.tsx
"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

type Post = {
  id: number;
  title: string;
  slug: string;
  excerpt: string;
  featured_image?: string | null;
};

export default function BlogPage() {
  const [posts, setPosts] = useState<Post[]>([]);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [nextPage, setNextPage] = useState<string | null>(null);
  const [prevPage, setPrevPage] = useState<string | null>(null);

  useEffect(() => {
    async function loadPosts() {
      setLoading(true);
      try {
        const res = await fetch(
          `${process.env.NEXT_PUBLIC_API_URL}/api/blog/posts/?page=${page}`
        );
        if (!res.ok) throw new Error("Ошибка загрузки постов");
        const data = await res.json();
        setPosts(data.results || data);
        setNextPage(data.next || null);
        setPrevPage(data.previous || null);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    }
    loadPosts();
  }, [page]);

  return (
    <main className="max-w-6xl mx-auto px-4 py-20">
      <motion.h1
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        className="text-4xl font-extrabold mb-10"
      >
        Блог
      </motion.h1>

      {loading ? (
        <p className="text-muted-foreground">Загрузка...</p>
      ) : posts.length === 0 ? (
        <p className="text-muted-foreground">Постов пока нет.</p>
      ) : (
        <div className="grid gap-8 md:grid-cols-2 lg:grid-cols-3">
          {posts.map((post) => (
            <Card key={post.id} className="hover:shadow-xl transition">
              <div className="h-48 bg-muted flex items-center justify-center overflow-hidden">
                {post.featured_image ? (
                  <img
                    src={post.featured_image}
                    alt={post.title}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <span className="text-muted-foreground">Нет изображения</span>
                )}
              </div>
              <CardContent className="flex flex-col justify-between h-56">
                <div>
                  <h2 className="text-xl font-semibold mb-2">{post.title}</h2>
                  <p className="text-sm text-muted-foreground line-clamp-3">
                    {post.excerpt || "Без описания"}
                  </p>
                </div>
                <Link
                  href={`/blog/${post.slug}`}
                  className="mt-4 text-primary font-medium hover:underline"
                >
                  Читать →
                </Link>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Пагинация */}
      <div className="flex justify-center gap-4 mt-12">
        <Button
          disabled={!prevPage}
          onClick={() => setPage((p) => Math.max(1, p - 1))}
          variant="secondary"
        >
          ← Назад
        </Button>
        <Button
          disabled={!nextPage}
          onClick={() => setPage((p) => p + 1)}
        >
          Вперёд →
        </Button>
      </div>
    </main>
  );
}
