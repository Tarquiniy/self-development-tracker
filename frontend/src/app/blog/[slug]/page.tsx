// SSR-safe page that fetches post from API_URL and renders its content server-side
import React from "react";
import Image from "next/image";
import { notFound } from "next/navigation";

export const revalidate = 60;

const API_BASE = (process.env.API_URL || process.env.NEXT_PUBLIC_API_URL || "").replace(/\/$/, "");

async function fetchPost(slug: string) {
  if (!API_BASE) return null;
  try {
    const res = await fetch(`${API_BASE}/api/blog/posts/${encodeURIComponent(slug)}/`, { cache: "no-store" });
    if (!res.ok) return { status: res.status, text: await res.text() };
    const data = await res.json();
    return { status: 200, data };
  } catch (err: any) {
    return { status: 0, error: String(err) };
  }
}

export default async function BlogPostPage({ params }: any) {
  const slug = params?.slug;
  if (!slug) return notFound();

  const result = await fetchPost(slug);

  // Если получили успешный JSON — рендерим
  if (result && result.status === 200 && result.data) {
    const post = result.data;
    return (
      <main className="max-w-3xl mx-auto p-6">
        <h1 className="text-3xl font-bold mb-2">{post.title}</h1>
        <p className="text-sm text-muted-foreground mb-4">Опубликовано: {new Date(post.published_at).toLocaleDateString("ru-RU")}</p>
        {post.featured_image && (
          <div className="mb-6 relative h-64">
            <Image src={post.featured_image} alt={post.title || ""} fill sizes="100vw" style={{ objectFit: "cover" }} />
          </div>
        )}
        <article dangerouslySetInnerHTML={{ __html: post.content ?? "" }} />
      </main>
    );
  }

  // Если backend ответил не OK — покажем диагностическую страницу (не выдаём 404 сразу)
  return (
    <main style={{ padding: 24 }}>
      <h1>Не удалось загрузить пост «{slug}»</h1>
      <pre style={{ whiteSpace: "pre-wrap", marginTop: 12 }}>
        {JSON.stringify(result, null, 2)}
      </pre>
      <p style={{ marginTop: 12 }}>
        Проверьте, что в runtime env заданы <code>API_URL</code> или <code>NEXT_PUBLIC_API_URL</code> и что backend доступен с Vercel.
      </p>
    </main>
  );
}
