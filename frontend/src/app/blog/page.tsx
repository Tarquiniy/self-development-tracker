// frontend/src/app/blog/page.tsx
import Header from "@/components/Header";
import StyledPostCard from "@/components/StyledPostCard";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";
export const revalidate = 3600;

export default async function BlogPage() {
  // fetch posts
  let posts: any[] = [];
  try {
    const res = await fetch(`${API_URL}/api/blog/posts/?page=1&per_page=12`, { next: { revalidate } });
    if (res.ok) {
      const data = await res.json();
      posts = Array.isArray(data) ? data : data.results ?? [];
    }
  } catch (e) {
    console.error("Ошибка загрузки постов:", e);
  }

  return (
    <div>
      <Header />
      <main className="py-12 container-max mx-auto px-4">
        <h1 className="text-4xl font-heading text-text-primary mb-6">Блог</h1>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8">
          {posts.length > 0
            ? posts.map((post) => (
                <StyledPostCard key={post.slug} post={post} />
              ))
            : (
              <div className="col-span-full text-center text-muted">
                Пока нет постов
              </div>
            )}
        </div>
      </main>
    </div>
  );
}
