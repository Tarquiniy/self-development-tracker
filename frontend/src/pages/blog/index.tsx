// frontend/src/pages/blog/index.tsx
import Head from "next/head";
import Link from "next/link";
import React from "react";
import Navbar from "@/components/navbar";

type PostSummary = {
  id: number;
  title: string;
  slug: string;
  excerpt?: string;
  featured_image?: string | null;
  published_at?: string | null;
};

const API_BASE =
  (process.env.API_URL || process.env.NEXT_PUBLIC_API_URL || "").replace(/\/$/, "") ||
  "https://positive-theta.onrender.com";

export async function getServerSideProps() {
  try {
    const url = `${API_BASE}/api/blog/posts/?page=1`;
    const res = await fetch(url);
    if (!res.ok) return { props: { posts: [] } };
    const json = await res.json();
    const posts = (json.results || json) as PostSummary[];
    return { props: { posts } };
  } catch (e) {
    return { props: { posts: [] } };
  }
}

export default function BlogIndex({ posts }: { posts: PostSummary[] }) {
  return (
    <>
      <Head>
        <title>Блог — Positive Theta</title>
        <meta name="description" content="Статьи и заметки Positive Theta" />
      </Head>

      <Navbar />

      <main>
        <div className="container page-offset u-mb-6">
          <h1 style={{ textAlign: "center", marginBottom: 24 }}>Блог</h1>

          {posts.length === 0 ? (
            <p style={{ textAlign: "center", color: "hsl(var(--muted-foreground))" }}>Постов пока нет.</p>
          ) : (
            <div className="posts-grid">
              {posts.map((p) => (
                <article key={p.id} className="post-card card">
                  <div className="card-media">
                    {p.featured_image ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={p.featured_image} alt={p.title || ""} />
                    ) : null}
                  </div>

                  <div className="card-body">
                    <h3 className="card-title">{p.title}</h3>

                    {/* render excerpt as HTML so existing HTML tags are respected */}
                    <div className="card-excerpt" dangerouslySetInnerHTML={{ __html: p.excerpt || "" }} />

                    <div style={{ marginTop: "auto", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <Link href={`/blog/posts/${p.slug}`} className="btn">
                        Читать
                      </Link>
                      <div style={{ color: "hsl(var(--muted-foreground))", fontSize: 13 }}>
                        {p.published_at ? new Date(p.published_at).toLocaleDateString("ru-RU") : ""}
                      </div>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          )}

          <div className="posts-pagination u-mt-12" />
        </div>
      </main>

      <footer className="site-footer">
        <div className="container">© Positive Theta</div>
      </footer>
    </>
  );
}
