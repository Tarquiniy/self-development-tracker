"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

type Post = {
  id: number;
  title: string;
  slug: string;
  excerpt: string;
  featured_image?: string | null;
  published_at: string;
};

export default function BlogPage() {
  const [posts, setPosts] = useState<Post[]>([]);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);

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
      } catch (err) {
        console.error(err);
        setPosts([]);
      } finally {
        setLoading(false);
      }
    }
    loadPosts();
  }, [page]);

  return (
    <main style={{ backgroundColor: "hsl(var(--background))" }}>
      <section className="container py-20">
        <motion.h1
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          style={{ textAlign: "center", marginBottom: 32 }}
          className="text-4xl md:text-5xl font-extrabold"
        >
          Узнай о саморазвитии с Positive Theta!
        </motion.h1>

        {loading ? (
          <p style={{ textAlign: "center", color: "hsl(var(--muted-foreground))", fontSize: 18 }}>
            Загрузка...
          </p>
        ) : posts.length === 0 ? (
          <p style={{ textAlign: "center", color: "hsl(var(--muted-foreground))", fontSize: 18 }}>
            Постов пока нет.
          </p>
        ) : (
          <div className="posts-grid">
            {posts.map((post) => (
              <motion.div
                key={post.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.35 }}
              >
                <Card className="post-card">
                  {post.featured_image ? (
                    <div className="card-media">
                      <img src={post.featured_image} alt={post.title} />
                    </div>
                  ) : (
                    <div className="card-media">Нет изображения</div>
                  )}

                  <CardHeader>
                    <CardTitle>{post.title}</CardTitle>
                  </CardHeader>

                  <CardContent>
                    <div
                      className="prose"
                      dangerouslySetInnerHTML={{ __html: post.excerpt || "" }}
                    />
                  </CardContent>

                  <div className="card-footer">
                    <Link href={`/blog/${post.slug}`}>
                      <a className="btn btn-primary">Читать →</a>
                    </Link>
                  </div>
                </Card>
              </motion.div>
            ))}
          </div>
        )}

        {/* Пагинация — отдельный блок с отступом сверху */}
        <div className="posts-pagination">
          <Button
            variant="secondary"
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page === 1}
          >
            ← Назад
          </Button>
          <Button variant="default" onClick={() => setPage((p) => p + 1)}>
            Вперёд →
          </Button>
        </div>
      </section>
    </main>
  );
}
