// frontend/src/app/blog/[slug]/page.tsx
// Серверный компонент Next.js (App Router).
// Положи этот файл на место старого page.tsx для /app/blog/[slug].

import React from "react";
import Image from "next/image";
import Link from "next/link";
import ArticleMeta from "@/components/ArticleMeta";
import { Button } from "@/components/ui/button";

type Post = {
  id: number;
  title: string;
  slug: string;
  excerpt?: string;
  content?: string;
  featured_image?: string | null;
  published_at?: string | null;
  author?: { name?: string } | null;
  attachments?: { id: number; url?: string }[] | null;
  meta_title?: string | null;
  meta_description?: string | null;
};

type Props = {
  params: {
    slug: string;
  };
};

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "";

async function fetchPostBySlug(slug: string): Promise<Post | null> {
  if (!API_BASE) return null;
  // Query posts by slug — backend list view is expected to support ?slug=<slug>
  const url = `${API_BASE.replace(/\/$/, "")}/api/blog/posts/?slug=${encodeURIComponent(slug)}`;
  const res = await fetch(url, { next: { revalidate: 60 } });
  if (!res.ok) return null;
  const data = await res.json();
  // Expecting DRF-style list response { results: [...] } or plain list
  const list = data?.results ?? data ?? [];
  return Array.isArray(list) && list.length ? list[0] : null;
}

export default async function Page({ params }: Props) {
  const slug = params.slug;
  const post = await fetchPostBySlug(slug);

  if (!post) {
    return (
      <main className="container mx-auto px-4 py-12">
        <div className="max-w-3xl mx-auto text-center">
          <h1 className="text-3xl font-bold mb-4">Пост не найден</h1>
          <p className="text-muted-foreground mb-6">К сожалению, пост с таким адресом не найден.</p>
          <Link href="/blog">
            <Button variant="default">Вернуться к списку постов</Button>
          </Link>
        </div>
      </main>
    );
  }

  // determine image to show: featured_image or first attachment
  let imageUrl = post.featured_image ?? null;
  if (!imageUrl && Array.isArray(post.attachments) && post.attachments.length > 0) {
    imageUrl = post.attachments[0].url ?? null;
  }

  return (
    <main className="container mx-auto px-4 py-10">
      <div className="max-w-5xl mx-auto">
        <article className="prose prose-lg dark:prose-invert mx-auto">
          {/* Title */}
          <header className="mb-6">
            <h1 className="text-3xl md:text-4xl font-extrabold leading-tight">{post.title}</h1>

            {/* Article meta: author, date, tags */}
            <div className="mt-4 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
              <ArticleMeta
                author={post.author ?? undefined}
                date={post.published_at ?? undefined}
                tags={undefined}
              />
            </div>
          </header>

          {/* Featured image */}
          {imageUrl ? (
            <div className="mb-6 rounded-lg overflow-hidden shadow-lg">
              {/* Use next/image only for external allowed domains — your next.config.js should contain supabase domain */}
              <Image
                src={imageUrl}
                alt={post.title}
                width={1200}
                height={675}
                style={{ width: "100%", height: "auto", objectFit: "cover" }}
                priority
              />
            </div>
          ) : null}

          {/* Excerpt */}
          {post.excerpt ? (
            <p className="text-lg text-muted-foreground mb-4">{stripHtml(post.excerpt)}</p>
          ) : null}

          {/* Post content */}
          <section
            className="prose prose-lg dark:prose-invert max-w-none"
            // eslint-disable-next-line react/no-danger
            dangerouslySetInnerHTML={{ __html: post.content ?? "<p>Нет содержимого</p>" }}
          />

          {/* Footer actions */}
          <footer className="mt-10 flex items-center justify-between gap-4">
            <div>
              <Link href="/blog">
                <Button variant="ghost">← Все статьи</Button>
              </Link>
            </div>
            <div className="text-sm text-muted-foreground">Опубликовано: {post.published_at ? new Date(post.published_at).toLocaleDateString('ru-RU') : "—"}</div>
          </footer>
        </article>
      </div>
    </main>
  );
}

/** Utility: strip HTML tags for excerpt preview */
function stripHtml(html?: string) {
  if (!html) return "";
  return html.replace(/<[^>]*>/g, "").slice(0, 300);
}
