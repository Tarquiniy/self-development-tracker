// frontend/src/pages/blog/posts/[slug].tsx
import Head from "next/head";
import React from "react";
import Link from "next/link";
import Navbar from "@/components/navbar";

type Post = {
  id?: number;
  title?: string;
  content?: string;
  published_at?: string;
  featured_image?: string | null;
  og_image?: string | null;
  meta_title?: string | null;
  meta_description?: string | null;
  author?: string | null;
};

const API_BASE =
  (process.env.API_URL || process.env.NEXT_PUBLIC_API_URL || "").replace(/\/$/, "") ||
  "https://positive-theta.onrender.com";

export async function getServerSideProps(context: any) {
  const slug = context.params?.slug;
  if (!slug) return { notFound: true };

  try {
    const url = `${API_BASE}/api/blog/posts/${encodeURIComponent(slug)}/`;
    const res = await fetch(url);
    if (!res.ok) {
      if (res.status === 404) return { notFound: true };
      return { props: { __error: `Backend returned ${res.status}`, __status: res.status } };
    }
    const post: Post = await res.json();
    return { props: { post } };
  } catch (err: any) {
    return { props: { __error: String(err) } };
  }
}

export default function PostPage({ post, __error }: { post?: Post; __error?: string }) {
  if (__error) {
    return (
      <>
        <Head>
          <title>Ошибка — Positive Theta</title>
        </Head>
        <Navbar />
        <main className="container page-offset u-mt-12">
          <h1>Ошибка при загрузке поста</h1>
          <pre>{String(__error)}</pre>
        </main>
        <footer className="site-footer">
          <div className="container">© Positive Theta</div>
        </footer>
      </>
    );
  }

  if (!post) {
    return (
      <>
        <Head>
          <title>Пост не найден — Positive Theta</title>
        </Head>
        <Navbar />
        <main className="container page-offset u-mt-12">
          <h1>Пост не найден</h1>
        </main>
        <footer className="site-footer">
          <div className="container">© Positive Theta</div>
        </footer>
      </>
    );
  }

  const title = post.meta_title || post.title || "Пост";
  const desc = post.meta_description || (post.content || "").replace(/<[^>]+>/g, "").slice(0, 160);
  const img = post.og_image || post.featured_image || "";

  return (
    <>
      <Head>
        <title>{title} — Positive Theta</title>
        <meta name="description" content={desc} />
        {img ? <meta property="og:image" content={img} /> : null}
      </Head>

      <Navbar />

      <main>
        <div className="container page-offset u-mt-12">
          <article className="card no-hover post-article" style={{ padding: 20 }}>
            {/* Title */}
            <header style={{ marginBottom: 6 }}>
              <h1 className="card-title" style={{ marginBottom: 6 }}>{post.title}</h1>

              {/* breadcrumbs */}
              <nav className="breadcrumbs" aria-label="Breadcrumb">
                <Link href="/">Главная</Link>
                <span>/</span>
                <Link href="/blog">Блог</Link>
                <span>/</span>
                <span style={{ color: "hsl(var(--muted-foreground))", fontWeight: 600 }}>{post.title}</span>
              </nav>

              {post.published_at && (
                <time dateTime={post.published_at} style={{ color: "hsl(var(--muted-foreground))", display: "block", marginTop: 6 }}>
                  {new Date(post.published_at).toLocaleDateString("ru-RU")}
                </time>
              )}
            </header>

            {img && (
              <div style={{ marginBottom: 18 }}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={img} alt={post.title || ""} style={{ width: "100%", borderRadius: 8 }} />
              </div>
            )}

            <section className="prose post-content" dangerouslySetInnerHTML={{ __html: post.content || "" }} />
          </article>
        </div>
      </main>

      <footer className="site-footer">
        <div className="container">© Positive Theta</div>
      </footer>
    </>
  );
}
