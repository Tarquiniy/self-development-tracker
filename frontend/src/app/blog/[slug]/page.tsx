// frontend/src/app/blog/[slug]/page.tsx
import { notFound } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import type { Metadata } from "next";
import "./page.css";

type Post = {
  id: number;
  title: string;
  slug: string;
  content: string;
  featured_image?: string | null;
  categories: { id: number; title: string; slug: string }[];
  tags: { id: number; title: string; slug: string }[];
  published_at: string;
  meta_title?: string | null;
  meta_description?: string | null;
  og_image?: string | null;
  comments?: any[];
};

// build SITE_URL fallback set (kept for OGs)
const SITE_URL = (() => {
  const candidate =
    (process.env.NEXT_PUBLIC_SITE_URL && String(process.env.NEXT_PUBLIC_SITE_URL)) ||
    (process.env.NEXT_PUBLIC_FRONTEND_URL && String(process.env.NEXT_PUBLIC_FRONTEND_URL)) ||
    (process.env.NEXT_PUBLIC_SITE_ORIGIN && String(process.env.NEXT_PUBLIC_SITE_ORIGIN)) ||
    "";
  if (candidate) return candidate.replace(/\/$/, "");
  if (process.env.NEXT_PUBLIC_VERCEL_URL) return (`https://${String(process.env.NEXT_PUBLIC_VERCEL_URL)}`).replace(/\/$/, "");
  if (process.env.VERCEL_URL) return (`https://${String(process.env.VERCEL_URL)}`).replace(/\/$/, "");
  return "";
})();

async function fetchJson(url: string) {
  const init = { cache: "no-store" } as RequestInit;
  const res = await fetch(url, init);
  if (!res.ok) return null;
  return res.json();
}

async function getPost(slug: string): Promise<Post | null> {
  const slugEnc = encodeURIComponent(slug);
  // Try relative proxy first so SSR calls our API route which proxies to backend
  const candidates: string[] = [
    `/api/blog/posts/${slugEnc}/`, // <- our proxy (preferred)
  ];

  // Then try direct backends if they exist in env (kept as fallback)
  const apiBase =
    (process.env.NEXT_PUBLIC_API_URL && String(process.env.NEXT_PUBLIC_API_URL)) ||
    (process.env.NEXT_PUBLIC_BACKEND_URL && String(process.env.NEXT_PUBLIC_BACKEND_URL)) ||
    (process.env.NEXT_PUBLIC_API_BASE && String(process.env.NEXT_PUBLIC_API_BASE)) ||
    "";
  if (apiBase) candidates.push(`${apiBase.replace(/\/$/, "")}/api/blog/posts/${slugEnc}/`);

  const siteCandidate = SITE_URL;
  if (siteCandidate) candidates.push(`${siteCandidate.replace(/\/$/, "")}/api/blog/posts/${slugEnc}/`);

  for (const url of candidates) {
    try {
      const json = await fetchJson(url);
      if (json) return json as Post;
    } catch (e) {
      // try next candidate
    }
  }
  return null;
}

export async function generateMetadata({ params }: any): Promise<Metadata> {
  try {
    const post: Post | null = await getPost(params?.slug);
    if (!post) {
      return { title: "Пост не найден | Positive Theta" };
    }

    const desc =
      post.meta_description ||
      post.meta_title ||
      (post.content ? post.content.replace(/<[^>]+>/g, "").slice(0, 160) : "");

    const image = post.og_image || post.featured_image || `${SITE_URL}/default-og.jpg`;

    return {
      title: `${post.meta_title || post.title} | Positive Theta`,
      description: desc || undefined,
      openGraph: {
        title: post.meta_title || post.title,
        description: desc || undefined,
        url: `${SITE_URL || ""}/blog/${post.slug}`,
        type: "article",
        images: image ? [image] : [],
      },
      twitter: {
        card: "summary_large_image",
        title: post.meta_title || post.title,
        description: desc || undefined,
        images: image ? [image] : [],
      },
    };
  } catch {
    return { title: "Positive Theta" };
  }
}

export default async function BlogPostPage({ params }: any) {
  const slug = params?.slug;
  if (!slug) return notFound();

  const post: Post | null = await getPost(slug);
  if (!post) return notFound();

  return (
    <main className="post-main">
      {post.featured_image && (
        <header className="post-header">
          <Image
            src={post.featured_image}
            alt={post.title}
            fill
            priority
            sizes="100vw"
            style={{ objectFit: "cover", transform: "translateZ(0)" }}
          />
          <div className="post-header-overlay" />
          <div className="post-header-text">
            <h1>{post.title}</h1>
            <p>Опубликовано {new Date(post.published_at).toLocaleDateString("ru-RU")}</p>
          </div>
        </header>
      )}

      <div className="post-body">
        <div className="post-tags">
          {post.categories?.map((cat) => (
            <Badge key={cat.id} className="tag">{cat.title}</Badge>
          ))}
          {post.tags?.map((t) => (
            <Badge key={t.id} className="tag">#{t.title}</Badge>
          ))}
        </div>

        <article className="prose prose-lg dark:prose-invert" dangerouslySetInnerHTML={{ __html: post.content }} />

        <div className="post-buttons">
          <Link href="/blog" prefetch={false} className="btn btn-secondary">← Вернуться в блог</Link>
          <Link href="/tables" prefetch={false} className="btn btn-primary">Открыть трекер</Link>
        </div>
      </div>
    </main>
  );
}
