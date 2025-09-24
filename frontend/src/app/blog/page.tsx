import Header from "@/components/Header";
import StyledPostCard from "@/components/StyledPostCard";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";
export const revalidate = 3600;

interface Category {
  title: string;
  slug: string;
}

interface Post {
  slug: string;
  title: string;
  excerpt?: string;
  featured_image?: string;
  og_image?: string;
  published_at: string;
  categories?: Category[];
  reading_time?: number;
}

async function getAllPosts(): Promise<Post[]> {
  try {
    const res = await fetch(`${API_URL}/api/blog/posts/?page=1&per_page=12`, { 
      next: { revalidate } 
    });
    
    if (res.ok) {
      const data = await res.json();
      return Array.isArray(data) ? data : data.results ?? [];
    }
  } catch (e) {
    console.error("Ошибка загрузки постов:", e);
  }
  return [];
}

export default async function BlogPage() {
  const posts: Post[] = await getAllPosts();

  return (
    <div className="min-h-screen bg-gradient-to-br from-neutral-50 via-white to-primary-50/20">
      <Header />
      
      {/* Blog Header */}
      <section className="pt-32 pb-20 px-4">
        <div className="container-max text-center">
          <h1 className="text-5xl lg:text-6xl font-heading font-bold mb-6">
            Наш <span className="text-gradient">Блог</span>
          </h1>
          <p className="text-xl text-neutral-600 max-w-3xl mx-auto leading-relaxed">
            Исследуйте коллекцию статей, руководств и исследований, созданных чтобы вдохновлять 
            и помогать вам на пути личностного роста и саморазвития.
          </p>
        </div>
      </section>

      {/* Blog Posts Grid */}
      <section className="pb-28 px-4">
        <div className="container-max">
          {posts.length > 0 ? (
            <>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                {posts.map((post: Post, index: number) => (
                  <div 
                    key={post.slug}
                    className="animate-slide-up"
                    style={{ animationDelay: `${index * 0.1}s` }}
                  >
                    <StyledPostCard post={post} />
                  </div>
                ))}
              </div>
              
              {/* Load More (будет реализовано позже) */}
              <div className="text-center mt-12">
                <button className="btn btn-ghost px-8 py-3">
                  Загрузить еще
                </button>
              </div>
            </>
          ) : (
            <div className="text-center py-20">
              <div className="w-24 h-24 bg-neutral-100 rounded-2xl flex items-center justify-center mx-auto mb-6">
                <span className="text-4xl">📝</span>
              </div>
              <h3 className="text-2xl font-heading font-bold mb-3">Статей пока нет</h3>
              <p className="text-neutral-600 max-w-md mx-auto">
                Мы активно работаем над созданием качественного контента. 
                Скюда здесь появятся интересные материалы!
              </p>
            </div>
          )}
        </div>
      </section>

      {/* Newsletter Section */}
      <section className="py-16 px-4 bg-white border-t border-neutral-200">
        <div className="container-max text-center max-w-2xl mx-auto">
          <h3 className="text-3xl font-heading font-bold mb-4">
            Будьте в курсе новых статей
          </h3>
          <p className="text-neutral-600 mb-6">
            Подпишитесь на рассылку и получайте уведомления о новых публикациях
          </p>
          <div className="flex flex-col sm:flex-row gap-3 max-w-md mx-auto">
            <input 
              type="email" 
              placeholder="Ваш email" 
              className="flex-1 px-4 py-3 rounded-xl border border-neutral-200 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
            />
            <button className="btn btn-primary px-6 py-3 whitespace-nowrap">
              Подписаться
            </button>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-12 px-4 bg-neutral-900 text-white">
        <div className="container-max text-center">
          <p className="text-neutral-400">
            © {new Date().getFullYear()} Positive Theta. Все права защищены.
          </p>
        </div>
      </footer>
    </div>
  );
}