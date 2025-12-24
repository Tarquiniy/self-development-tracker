// frontend/src/app/blog/posts/[slug]/page.tsx
import { notFound } from "next/navigation";
import type { Metadata } from "next";

type Post = {
  id: number;
  title: string;
  slug: string;
  content: string;
  excerpt?: string;
  meta_title?: string | null;
  meta_description?: string | null;
  og_image?: string | null;
  featured_image?: string | null;
  published_at?: string | null;
  author?: string | null;
};

const API_BASE =
  (process.env.API_URL || process.env.NEXT_PUBLIC_API_URL || "").replace(/\/$/, "") ||
  "https://positive-theta.onrender.com";

export const revalidate = 60; // ISR: change to 300/3600 if you prefer

async function fetchPost(slug: string): Promise<Post | null> {
  try {
    const url = `${API_BASE}/api/blog/posts/${encodeURIComponent(slug)}/`;
    const res = await fetch(url, { cache: "no-store" });
    if (!res.ok) return null;
    return (await res.json()) as Post;
  } catch {
    return null;
  }
}

function excerptFrom(post: Post) {
  const src = post.meta_description || post.excerpt || post.content || "";
  return src.replace(/<[^>]+>/g, "").slice(0, 160);
}

/* -------------------------
   SEO metadata (server)
   ------------------------- */
export async function generateMetadata({ params }: { params: { slug: string } }): Promise<Metadata> {
  const slug = params.slug;
  const post = await fetchPost(slug);
  if (!post) {
    return {
      title: "Пост — Positive Theta",
      description: "Статья в блоге Positive Theta",
    };
  }

  const title = post.meta_title || post.title;
  const description = excerptFrom(post);
  const image = post.og_image || post.featured_image || `${process.env.NEXT_PUBLIC_SITE_URL || ""}/default-og.jpg`;

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      url: `${process.env.NEXT_PUBLIC_SITE_URL || ""}/blog/posts/${post.slug}`,
      type: "article",
      images: image ? [{ url: image }] : [],
      publishedTime: post.published_at ? new Date(post.published_at).toISOString() : undefined,
    },
    twitter: {
      card: image ? "summary_large_image" : "summary",
      title,
      description,
      images: image ? [image] : [],
    },
    robots: { index: true, follow: true },
  };
}

/* -------------------------
   Page (server) — renders full HTML with content
   ------------------------- */
export default async function PostPage({ params }: { params: { slug: string } }) {
  const slug = params.slug;
  if (!slug) return notFound();

  const post = await fetchPost(slug);
  if (!post) return notFound();

  const og = post.og_image || post.featured_image || null;

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: post.title,
    description: excerptFrom(post),
    image: og || undefined,
    author: post.author ? { "@type": "Person", name: post.author } : undefined,
    datePublished: post.published_at ? new Date(post.published_at).toISOString() : undefined,
    mainEntityOfPage: {
      "@type": "WebPage",
      "@id": `${process.env.NEXT_PUBLIC_SITE_URL || ""}/blog/posts/${post.slug}`,
    },
  };

  return (
    <main style={{ maxWidth: 900, margin: "0 auto", padding: 24, fontFamily: "Inter, system-ui, sans-serif" }}>
      <article>
        <header style={{ marginBottom: 18 }}>
          <h1 style={{ fontSize: "2rem", margin: 0 }}>{post.title}</h1>
          {post.published_at && (
            <time dateTime={post.published_at} style={{ color: "#666", display: "block", marginTop: 6 }}>
              {new Date(post.published_at).toLocaleDateString("ru-RU")}
            </time>
          )}
        </header>

        {og && (
          <div style={{ marginBottom: 18 }}>
            <img src={og} alt={post.title || ""} style={{ width: "100%", borderRadius: 8 }} />
          </div>
        )}

        <section dangerouslySetInnerHTML={{ __html: post.content || "" }} style={{ lineHeight: 1.7 }} />

        <script type="application/ld+json" // eslint-disable-next-line react/no-danger
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
      </article>
    </main>
  );
}
