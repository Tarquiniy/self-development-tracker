// frontend/src/app/blog/[slug]/page.tsx
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Header from "@/components/Header";
import ArticleMeta from "@/components/ArticleMeta";

/**
 * Тип поста: все поля, которые могут прийти от API.
 * Поля meta_title и meta_description делаем опциональными, потому что
 * не у всех записей они могут присутствовать — это устраняет ошибку TS.
 */
type PostData = {
  slug: string;
  title: string;
  content: string;
  excerpt?: string;
  og_image?: string;
  published_at?: string;
  categories?: { title: string }[];
  author?: { name?: string };
  // optional SEO fields from backend:
  meta_title?: string;
  meta_description?: string;
  // любые другие поля можно добавить при необходимости
};

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";
export const revalidate = 3600;

/** Генерируем параметры (списки slug) — теперь с корректной типизацией */
export async function generateStaticParams(): Promise<{ slug: string }[]> {
  if (!API_URL) return [];
  try {
    const res = await fetch(`${API_URL}/api/blog/posts/?per_page=200`, { next: { revalidate } });
    if (!res.ok) return [];
    const data = await res.json();
    const posts: PostData[] = Array.isArray(data) ? data : (data.results ?? []);
    return posts.map((p: PostData) => ({ slug: p.slug }));
  } catch {
    return [];
  }
}

/** Динамическая мета — используем поля meta_title / meta_description, если они есть */
export async function generateMetadata(props: PageProps<'/blog/[slug]'>): Promise<Metadata> {
  const { slug } = await props.params;
  try {
    const res = await fetch(`${API_URL}/api/blog/posts/${slug}/`, { next: { revalidate } });
    if (!res.ok) return { title: "Пост" };
    const post: PostData = await res.json();

    return {
      title: post.meta_title ?? post.title,
      description: post.meta_description ?? post.excerpt,
      openGraph: {
        images: post.og_image ? [post.og_image] : undefined,
      },
    };
  } catch {
    return { title: "Пост" };
  }
}

/** Статья — также типизированная работа с ответом API */
export default async function Page(props: PageProps<'/blog/[slug]'>) {
  const { slug } = await props.params;
  try {
    const res = await fetch(`${API_URL}/api/blog/posts/${slug}/`, { next: { revalidate } });
    if (!res.ok) return notFound();
    const post: PostData = await res.json();

    return (
      <>
        <Header />
        <main className="py-12 container-max mx-auto px-4">
          <article className="bg-surface rounded-2xl shadow-card p-8">
            {post.og_image && (
              <div className="rounded-2xl overflow-hidden mb-6">
                <img src={post.og_image} alt={post.title} className="w-full h-64 object-cover" />
              </div>
            )}

            <h1 className="text-4xl font-heading text-text-primary mb-4">{post.title}</h1>

            <ArticleMeta author={post.author} date={post.published_at} tags={post.categories || []} />

            <div className="mt-6 prose prose-lg text-text-primary">
              <div dangerouslySetInnerHTML={{ __html: post.content }} />
            </div>
          </article>
        </main>
      </>
    );
  } catch {
    return notFound();
  }
}
