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
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // BUILD-TIME env var (may be empty). Keep it trimmed (no trailing slash).
  const API_BASE = (process.env.NEXT_PUBLIC_API_URL || "").replace(/\/$/, "");

  // Runtime helper: build correct absolute URL with safe fallback.
  function getApiUrl(path: string) {
    if (API_BASE) {
      return `${API_BASE}${path}`;
    }
    // Fallback to same-origin (works when backend is proxied or served from same host)
    if (typeof window !== "undefined") {
      return `${window.location.origin}${path}`;
    }
    return path; // last resort (server-side — but this is client component)
  }

  useEffect(() => {
    let cancelled = false;

    async function loadPosts() {
      setLoading(true);
      setErrorMsg(null);
      try {
        const url = getApiUrl(`/api/blog/posts/?page=${encodeURIComponent(String(page))}`);
        const res = await fetch(url, {
          // you can enable credentials if your backend expects cookies:
          // credentials: "include"
        });
        if (!res.ok) {
          // Try to surface helpful info in dev
          const text = await res.text().catch(() => "");
          throw new Error(`Ошибка загрузки постов: ${res.status} ${res.statusText} ${text ? (" — " + text.slice(0, 200)) : ""}`);
        }
        const data = await res.json();
        // DRF paginated responses expose `results`, otherwise may be array
        const items = Array.isArray(data) ? data : data.results ?? [];
        if (!cancelled) {
          setPosts(items || []);
        }
      } catch (err: any) {
        console.error("Ошибка при загрузке постов:", err);
        if (!cancelled) {
          setPosts([]);
          setErrorMsg(err?.message || "Неизвестная ошибка при загрузке постов");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    loadPosts();
    return () => {
      cancelled = true;
    };
  }, [page, API_BASE]);

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
        ) : errorMsg ? (
          <div style={{ textAlign: "center", color: "hsl(var(--muted-foreground))", fontSize: 18 }}>
            <p>Не удалось загрузить посты.</p>
            <pre style={{ whiteSpace: "pre-wrap", maxWidth: 800, margin: "0.5rem auto", color: "rgba(200,50,50,0.9)" }}>{errorMsg}</pre>
            <p>Проверьте переменную окружения <code>NEXT_PUBLIC_API_URL</code> или доступность бекенда.</p>
          </div>
        ) : posts.length === 0 ? (
          <p style={{ textAlign: "center", color: "hsl(var(--muted-foreground))", fontSize: 18 }}>
            Постов пока нет.
          </p>
        ) : (
          <div className="posts-grid" style={{ display: "grid", gridTemplateColumns: "repeat(1, 1fr)", gap: 20 }}>
            {posts.map((p) => (
              <Card key={p.id}>
                <CardHeader>
                  <CardTitle>
                    <Link href={`/blog/${encodeURIComponent(p.slug)}`} prefetch={false}>
                      {p.title}
                    </Link>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p style={{ color: "hsl(var(--muted-foreground))" }}>{p.excerpt}</p>
                  <div style={{ marginTop: 12, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <small>{new Date(p.published_at).toLocaleDateString("ru-RU")}</small>
                    <Link href={`/blog/${encodeURIComponent(p.slug)}`} prefetch={false}>
                      <Button>Читать</Button>
                    </Link>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {/* Pagination controls (simple) */}
        <div style={{ marginTop: 24, display: "flex", gap: 12, justifyContent: "center" }}>
          <button
            onClick={() => setPage((s) => Math.max(1, s - 1))}
            disabled={page === 1}
            className="btn btn-ghost"
          >
            ← Назад
          </button>
          <div style={{ alignSelf: "center" }}>Страница {page}</div>
          <button onClick={() => setPage((s) => s + 1)} className="btn btn-ghost">
            Вперёд →
          </button>
        </div>
      </section>
    </main>
  );
}
