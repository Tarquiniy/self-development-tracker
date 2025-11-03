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

  const HEADER_PADDING = "calc(var(--header-height, 64px) + 16px)";

  return (
    <main style={{ backgroundColor: "hsl(var(--background))", paddingTop: HEADER_PADDING }}>
      <section className="container py-20" style={{ maxWidth: 1100, margin: "0 auto", paddingLeft: 16, paddingRight: 16 }}>
        <motion.h1
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          style={{
            textAlign: "center",
            marginBottom: 32,
            color: "hsl(var(--foreground))",
            scrollMarginTop: "calc(var(--header-height, 64px) + 8px)",
          }}
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
          <div className="posts-grid" style={{ marginTop: 12 }}>
            {posts.map((post) => (
              <motion.div
                key={post.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.35 }}
              >
                <Card className="post-card" style={{ overflow: "hidden" }}>
                  {post.featured_image ? (
                    <div className="card-media" style={{ minHeight: 160, display: "flex", alignItems: "center", justifyContent: "center", background: "#f6f8fb" }}>
                      <img src={post.featured_image} alt={post.title} style={{ width: "100%", height: "auto", display: "block" }} />
                    </div>
                  ) : (
                    <div className="card-media" style={{ minHeight: 120, display: "flex", alignItems: "center", justifyContent: "center", background: "#f6f8fb", color: "rgba(15,23,36,0.6)" }}>
                      Нет изображения
                    </div>
                  )}

                  <CardHeader>
                    <CardTitle style={{ fontSize: "1.125rem", marginBottom: 6 }}>{post.title}</CardTitle>
                  </CardHeader>

                  <CardContent>
                    <div
                      className="prose"
                      dangerouslySetInnerHTML={{ __html: post.excerpt || "" }}
                      style={{ color: "hsl(var(--muted-foreground))" }}
                    />
                  </CardContent>

                  <div className="card-footer" style={{ padding: "16px" }}>
                    <Link href={`/blog/${post.slug}`} className="btn btn-primary" style={{ textDecoration: "none" }}>
                      Читать →
                    </Link>
                  </div>
                </Card>
              </motion.div>
            ))}
          </div>
        )}

        {/* Пагинация — отдельный блок с отступом сверху */}
        <div className="posts-pagination" style={{ marginTop: 28, display: "flex", gap: 12, justifyContent: "center", alignItems: "center" }}>
          <Button
            variant="secondary"
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page === 1}
          >
            ← Назад
          </Button>
          <span style={{ fontWeight: 600 }}>{page}</span>
          <Button variant="default" onClick={() => setPage((p) => p + 1)}>
            Вперёд →
          </Button>
        </div>
      </section>

      <style jsx>{`
        /* Ensure headings and anchors are visible when header is fixed */
        :global(h1, h2, h3) {
          scroll-margin-top: calc(var(--header-height, 64px) + 8px);
        }

        /* small responsive tweaks */
        @media (max-width: 640px) {
          .container { padding-left: 12px; padding-right: 12px; }
          :global(.text-4xl) { font-size: 1.6rem; }
        }

        /* Improve posts grid spacing when images present */
        .posts-grid {
          display: grid;
          grid-template-columns: repeat(3, minmax(0, 1fr));
          gap: 1.25rem;
        }
        @media (max-width: 960px) {
          .posts-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
        }
        @media (max-width: 640px) {
          .posts-grid { grid-template-columns: 1fr; }
        }

        .post-card {
          border-radius: 12px;
          box-shadow: 0 6px 18px rgba(2,6,23,0.06);
          background: hsl(var(--card));
        }

        .card-footer .btn {
          display: inline-block;
          padding: 8px 12px;
          border-radius: 8px;
          background: hsl(var(--primary));
          color: hsl(var(--primary-foreground));
          font-weight: 700;
        }
      `}</style>
    </main>
  );
}
