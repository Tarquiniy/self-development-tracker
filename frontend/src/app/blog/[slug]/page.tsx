// frontend/src/app/blog/[slug]/page.tsx
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Header from "@/components/Header";
import ArticleMeta from "@/components/ArticleMeta";

type PostData = {
  slug: string;
  title: string;
  content: string;
  excerpt?: string;
  og_image?: string;
  published_at?: string;
  categories?: { title: string }[];
  author?: { name?: string };
  meta_title?: string;
  meta_description?: string;
};

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";
export const revalidate = 3600;

export async function generateStaticParams(): Promise<{ slug: string }[]> {
  if (!API_URL) return [];
  try {
    const res = await fetch(`${API_URL}/api/blog/posts/?per_page=200`, { next: { revalidate } });
    if (!res.ok) return [];
    const data = await res.json();
    const posts: PostData[] = Array.isArray(data) ? data : data.results ?? [];
    return posts.map((p) => ({ slug: p.slug }));
  } catch {
    return [];
  }
}

// Ключевое изменение: Тип params для generateMetadata также должен быть Promise
export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  // Извлекаем slug с помощью await
  const { slug } = await params;
  try {
    const res = await fetch(`${API_URL}/api/blog/posts/${slug}/`, { next: { revalidate } });
    if (!res.ok) return { title: "Пост" };
    const post: PostData = await res.json();
    return {
      title: post.meta_title ?? post.title,
      description: post.meta_description ?? post.excerpt,
      openGraph: {
        images: post.og_image ? [post.og_image] : undefined,
      }
    };
  } catch {
    return { title: "Пост" };
  }
}

// Ключевое изменение: Тип params для компонента страницы должен быть Promise
export default async function Page(props: { params: Promise<{ slug: string }> }) {
  // Извлекаем slug с помощью await
  const { slug } = await props.params;
  try {
    const res = await fetch(`${API_URL}/api/blog/posts/${slug}/`, { next: { revalidate } });
    if (!res.ok) return notFound();
    const post: PostData = await res.json();

    return (
      <div className="min-h-screen bg-gradient-to-br from-neutral-50 via-white to-primary-50/20">
        <Header />
        <main className="pt-32 pb-20 px-4">
          <div className="container-max mx-auto">
            <article className="bg-white rounded-3xl shadow-card p-8 lg:p-12 max-w-4xl mx-auto">
              {post.og_image && (
                <div className="rounded-2xl overflow-hidden mb-8">
                  <img 
                    src={post.og_image} 
                    alt={post.title} 
                    className="w-full h-64 lg:h-80 object-cover"
                  />
                </div>
              )}
              
              <div className="mb-6">
                {post.categories && post.categories.length > 0 && (
                  <div className="flex flex-wrap gap-2 mb-4">
                    {post.categories.map((category, index) => (
                      <span 
                        key={index} 
                        className="tag-pill bg-primary-100 text-primary-700"
                      >
                        {category.title}
                      </span>
                    ))}
                  </div>
                )}
                
                <h1 className="text-3xl lg:text-5xl font-heading font-bold text-neutral-900 mb-4 leading-tight">
                  {post.title}
                </h1>
                
                <ArticleMeta 
                  author={post.author} 
                  date={post.published_at} 
                  tags={post.categories || []} 
                />
              </div>

              {post.excerpt && (
                <div className="bg-neutral-50 rounded-xl p-6 mb-8">
                  <p className="text-lg text-neutral-700 italic leading-relaxed">
                    {post.excerpt}
                  </p>
                </div>
              )}

              <div 
                className="prose prose-lg max-w-none text-neutral-700"
                dangerouslySetInnerHTML={{ __html: post.content }} 
              />
            </article>
          </div>
        </main>
        
        <footer className="py-12 px-4 bg-neutral-900 text-white">
          <div className="container-max text-center">
            <p className="text-neutral-400">
              © {new Date().getFullYear()} Positive Theta. Все права защищены.
            </p>
          </div>
        </footer>
      </div>
    );
  } catch {
    return notFound();
  }
}