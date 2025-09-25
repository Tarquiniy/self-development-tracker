// app/page.tsx
"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

type Post = {
  id: number;
  title: string;
  slug: string;
  excerpt: string;
  featured_image?: string | null;
  published_at: string;
};

export default function HomePage() {
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadPosts() {
      try {
        const res = await fetch(
          `${process.env.NEXT_PUBLIC_API_URL}/api/blog/posts`
        );
        if (!res.ok) throw new Error("Ошибка загрузки постов");
        const data = await res.json();
        setPosts(data.results || data);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    }
    loadPosts();
  }, []);

  return (
    <main className="min-h-screen bg-gradient-to-b from-background to-muted">
      {/* Hero */}
      <section className="flex flex-col items-center justify-center text-center py-32">
        <motion.h1
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-5xl md:text-6xl font-extrabold tracking-tight"
        >
          Positive Theta
        </motion.h1>
        <motion.p
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8 }}
          className="mt-6 text-lg md:text-xl text-muted-foreground max-w-2xl"
        >
          Современный блог и платформа для саморазвития.
        </motion.p>
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="mt-8">
          <Button asChild size="lg">
            <Link href="/blog">Перейти к блогу</Link>
          </Button>
        </motion.div>
      </section>

      {/* Latest Posts */}
      <section className="py-20 max-w-6xl mx-auto px-4">
        <h2 className="text-3xl font-bold mb-10">Последние статьи</h2>

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
                    <h3 className="text-xl font-semibold mb-2">{post.title}</h3>
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
      </section>
    </main>
  );
}
