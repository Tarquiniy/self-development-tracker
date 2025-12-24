// src/app/blog/[slug]/ClientPost.tsx
"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";

type Post = {
  id: number;
  title: string;
  content: string;
  published_at: string;
  slug: string;
  featured_image?: string | null;
  excerpt?: string | null;
};

export default function ClientPost({ slug: initialSlug }: { slug?: string }) {
  const [post, setPost] = useState<Post | null>(null);
  const [loading, setLoading] = useState(true);
  const [errorText, setErrorText] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;

    function extractSlugFromLocation(): string | null {
      try {
        if (typeof window === "undefined") return null;
        const path = window.location.pathname || "";
        const parts = path.split("/").filter(Boolean);
        if (parts.length === 0) return null;
        return parts[parts.length - 1] || null;
      } catch {
        return null;
      }
    }

    async function load() {
      setLoading(true);
      setErrorText(null);
      setPost(null);

      const slugFromProp = typeof initialSlug === "string" && initialSlug.trim() !== "" ? initialSlug.trim() : null;
      const slugCandidate = slugFromProp || extractSlugFromLocation();

      if (!slugCandidate) {
        setErrorText("Не удалось определить идентификатор поста (slug).");
        setLoading(false);
        return;
      }

      const API_BASE = (process.env.NEXT_PUBLIC_API_URL || "").replace(/\/$/, "");
      const candidates: string[] = [];
      if (API_BASE) candidates.push(`${API_BASE}/api/blog/posts/${encodeURIComponent(slugCandidate)}/`);
      // fallback to relative path
      candidates.push(`/api/blog/posts/${encodeURIComponent(slugCandidate)}/`);

      let lastErr: any = null;
      for (const url of candidates) {
        try {
          const res = await fetch(url, { cache: "no-store", credentials: "include" });
          if (!res.ok) {
            lastErr = { url, status: res.status };
            continue;
          }
          const data = await res.json();
          if (!mounted) return;
          setPost(data);
          setLoading(false);
          return;
        } catch (e) {
          lastErr = e;
          continue;
        }
      }

      if (!mounted) return;
      console.warn("ClientPost: all fetch attempts failed", lastErr);
      setErrorText("Пост не найден или сервер недоступен.");
      setLoading(false);
    }

    load();

    return () => {
      mounted = false;
    };
  }, [initialSlug]);

  if (loading) {
    return (
      <main className="post-main">
        <div className="post-body post-body--centered">Загрузка поста…</div>
      </main>
    );
  }

  if (errorText) {
    return (
      <main className="post-main">
        <div className="post-body post-body--centered">
          <h2>{errorText}</h2>
          <p>
            <Link href="/blog">← Вернуться в блог</Link>
          </p>
        </div>
      </main>
    );
  }

  if (!post) {
    return (
      <main className="post-main">
        <div className="post-body post-body--centered">
          <h2>Пост не найден</h2>
          <p>
            <Link href="/blog">← Вернуться в блог</Link>
          </p>
        </div>
      </main>
    );
  }

  return (
    <main className="post-main">
      {/* Featured header */}
      {post.featured_image ? (
        <header className="post-header hero-image" role="banner" aria-hidden={false}>
          <img src={post.featured_image} alt={post.title} className="hero-image__img" />
          <div className="hero-image__overlay" />
          <div className="hero-image__content">
            <h1 className="hero-title">{post.title}</h1>
            <div className="hero-meta">Опубликовано {new Date(post.published_at).toLocaleDateString("ru-RU")}</div>

            {/* breadcrumbs */}
            <nav className="breadcrumbs" aria-label="Навигация по сайту">
              <Link href="/">Главная</Link>
              <span className="sep">›</span>
              <Link href="/blog">Блог</Link>
              <span className="sep">›</span>
              <span aria-current="page">{post.title}</span>
            </nav>
          </div>
        </header>
      ) : (
        <div style={{ paddingTop: 18, paddingBottom: 6 }} className="post-header--noimage">
          <div className="container" style={{ maxWidth: 1100, margin: "0 auto", padding: "0 12px" }}>
            <h1 style={{ margin: 0, fontSize: "clamp(1.6rem, 3.6vw, 3rem)" }}>{post.title}</h1>
            <div style={{ color: "#667085", marginTop: 8 }}>Опубликовано {new Date(post.published_at).toLocaleDateString("ru-RU")}</div>

            {/* breadcrumbs */}
            <nav className="breadcrumbs" aria-label="Навигация по сайту">
              <Link href="/">Главная</Link>
              <span className="sep">›</span>
              <Link href="/blog">Блог</Link>
              <span className="sep">›</span>
              <span aria-current="page">{post.title}</span>
            </nav>
          </div>
        </div>
      )}

      {/* Article content */}
      <div className="post-body">
        <div className="container" style={{ maxWidth: 1100, margin: "0 auto", padding: "0 18px" }}>
          <article
            className="post-content"
            // keep author's inline styles intact
            dangerouslySetInnerHTML={{ __html: post.content }}
          />

          {/* spacer so fixed buttons don't cover content */}
          <div style={{ height: 96 }} />
        </div>
      </div>

      {/* Fixed bottom CTA */}
      <div className="fixed-cta" role="complementary" aria-hidden={false}>
        <div className="fixed-cta__inner">
          <Link href="/blog" className="btn btn-secondary" aria-label="Вернуться в блог">
            ← Вернуться в блог
          </Link>
          <Link href="/tables" className="btn btn-primary" aria-label="Открыть трекер">
            Открыть трекер
          </Link>
        </div>
      </div>

      <style jsx>{`
        /* Layout helpers */
        .post-main { padding-bottom: 48px; }
        .post-header--noimage { padding: 20px 0 8px; }
        .post-body { padding: 28px 0; }

        /* Featured hero image */
        .hero-image {
          position: relative;
          width: 100%;
          min-height: 300px;
          display: flex;
          align-items: flex-end;
          box-shadow: 0 8px 40px rgba(2,6,23,0.06);
          margin-bottom: 8px;
        }
        .hero-image__img {
          position: absolute;
          inset: 0;
          width: 100%;
          height: 100%;
          object-fit: cover;
          object-position: center;
          filter: saturate(0.98) contrast(0.98);
        }
        .hero-image__overlay {
          position: absolute;
          inset: 0;
          background: linear-gradient(180deg, rgba(0,0,0,0.36) 0%, rgba(0,0,0,0.06) 55%);
        }
        .hero-image__content {
          position: relative;
          z-index: 2;
          padding: 36px 22px;
          max-width: 1100px;
          margin: 0 auto 18px;
          color: #fff;
        }
        .hero-title {
          margin: 0 0 6px;
          font-size: clamp(1.75rem, 4vw, 3.25rem);
          line-height: 1.02;
          font-weight: 800;
          text-shadow: 0 6px 24px rgba(0,0,0,0.35);
        }
        .hero-meta { color: rgba(255,255,255,0.85); font-weight: 500; font-size: 0.95rem; }

        /* breadcrumbs */
        .breadcrumbs {
          margin-top: 12px;
          display: inline-flex;
          gap: 10px;
          align-items: center;
          font-size: 0.95rem;
          color: rgba(255,255,255,0.85);
        }
        .breadcrumbs a { color: rgba(255,255,255,0.95); text-decoration: underline; text-underline-offset: 4px; }
        .breadcrumbs .sep { opacity: 0.6; margin: 0 4px; }

        /* when no image variant: darker text for breadcrumbs */
        .post-header--noimage .breadcrumbs { color: rgba(15,23,36,0.75); }
        .post-header--noimage .breadcrumbs a { color: rgba(15,23,36,0.9); }

        /* Article body container */
        .post-content {
          max-width: 820px;
          margin: 18px auto;
          color: var(--foreground);
          font-size: 1.03rem;
          line-height: 1.85;
          letter-spacing: 0.1px;
        }

        /* Respect author's inline text-align — do NOT override */
        .post-content p { margin: 0 0 1.1em; color: rgba(15,23,36,0.92); }
        .post-content h1, .post-content h2, .post-content h3, .post-content h4 {
          margin: 1.1em 0 0.6em;
          line-height: 1.16;
          color: var(--foreground);
        }

        /* Images: centered, responsive */
        .post-content img {
          display: block;
          margin: 18px auto;
          max-width: 100%;
          height: auto;
          border-radius: 8px;
          box-shadow: 0 8px 24px rgba(2,6,23,0.06);
        }

        /* Blockquote styling */
        .post-content blockquote {
          border-left: 4px solid rgba(11,102,255,0.12);
          background: color-mix(in srgb, rgba(11,102,255,0.02) 85%, transparent 15%);
          padding: 12px 16px;
          margin: 1em 0;
          border-radius: 8px;
          color: rgba(15,23,36,0.85);
        }

        /* Lists */
        .post-content ul, .post-content ol {
          margin: 0 0 1em 1.25rem;
          padding: 0;
        }
        .post-content li { margin: 0.45em 0; }

        /* Code blocks & inline code */
        .post-content pre {
          background: #0b1220;
          color: #e6eef9;
          padding: 12px 14px;
          border-radius: 8px;
          overflow: auto;
          font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, "Roboto Mono", "Courier New", monospace;
          font-size: 0.92rem;
          margin: 0.9em 0;
        }
        .post-content code {
          background: rgba(2,6,23,0.04);
          padding: 2px 6px;
          border-radius: 6px;
          font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, "Roboto Mono", "Courier New", monospace;
          font-size: 0.95em;
        }

        /* Tables */
        .post-content table {
          width: 100%;
          border-collapse: collapse;
          overflow: auto;
          display: block;
          margin: 12px 0;
        }
        .post-content th,
        .post-content td {
          border: 1px solid rgba(15,23,36,0.06);
          padding: 10px 12px;
          text-align: left;
        }
        .post-content thead th {
          background: color-mix(in srgb, hsl(var(--muted)) 80%, transparent 20%);
          font-weight: 700;
        }

        /* Fixed CTA bottom center */
        .fixed-cta {
          position: fixed;
          left: 50%;
          transform: translateX(-50%);
          bottom: calc(env(safe-area-inset-bottom, 12px) + 10px);
          z-index: 1200;
          width: auto;
          max-width: min(92%, 760px);
          pointer-events: none; /* allow inner to control pointer */
        }
        .fixed-cta__inner {
          pointer-events: auto;
          display: flex;
          gap: 12px;
          background: rgba(255,255,255,0.96);
          border-radius: 999px;
          padding: 8px;
          box-shadow: 0 10px 30px rgba(2,6,23,0.12);
          justify-content: center;
          align-items: center;
        }

        /* button overrides inside fixed-cta - prefer existing .btn styles but ensure visual */
        .fixed-cta__inner .btn {
          padding: 10px 16px;
          border-radius: 999px;
          font-weight: 700;
        }

        /* Make sure page content isn't obscured by fixed CTA (desktop already has spacer) */
        @media (max-width: 880px) {
          .hero-image { min-height: 220px; }
          .hero-image__content { padding: 20px; }
          .post-content { padding: 0 6px; margin: 12px auto; }
          .fixed-cta__inner { width: calc(100vw - 48px); max-width: none; border-radius: 12px; justify-content: space-between; }
        }
      `}</style>
    </main>
  );
}
