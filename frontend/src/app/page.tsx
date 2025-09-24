import Header from "@/components/Header";
import StyledPostCard from "@/components/StyledPostCard";
import { Link } from "lucide-react";

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

async function getFeaturedPosts(): Promise<Post[]> {
  try {
    const res = await fetch(`${API_URL}/api/blog/posts/?page=1&per_page=6`, { 
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

export default async function HomePage() {
  const featuredPosts: Post[] = await getFeaturedPosts();

  return (
    <div className="min-h-screen bg-gradient-to-br from-neutral-50 via-white to-primary-50/30">
      <Header />
      
      {/* Hero Section */}
      <section className="pt-32 pb-20 px-4 relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-r from-primary-500/5 to-secondary-500/5"></div>
        <div className="container-max relative z-10">
          <div className="max-w-4xl mx-auto text-center">
            <div className="inline-flex items-center px-4 py-2 rounded-full bg-primary-50 border border-primary-200 text-primary-700 text-sm font-medium mb-6">
              🚀 Новейшие методики саморазвития 2025
            </div>
            
            <h1 className="text-5xl lg:text-7xl font-heading font-bold mb-6 leading-tight">
              Раскройте свой 
              <span className="text-gradient"> потенциал </span>
              с Positive Theta
            </h1>
            
            <p className="text-xl lg:text-2xl text-neutral-600 mb-8 leading-relaxed">
              Исследуйте мир саморазвития через науку, практику и вдохновение. 
              Преобразуйте свою жизнь с помощью проверенных методик и современных подходов.
            </p>
            
            <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
              <a href="/blog" className="btn btn-primary text-lg px-8 py-4">
                Начать читать
              </a>
              <a href="/about" className="btn btn-ghost text-lg px-8 py-4">
                Узнать больше
              </a>
            </div>
          </div>
        </div>
        
        {/* Декоративные элементы */}
        <div className="absolute top-20 left-10 w-20 h-20 bg-primary-300/20 rounded-full blur-xl"></div>
        <div className="absolute bottom-20 right-10 w-32 h-32 bg-secondary-300/20 rounded-full blur-xl"></div>
      </section>

      {/* Featured Posts Section */}
      {featuredPosts.length > 0 && (
        <section className="section-padding px-4">
          <div className="container-max">
            <div className="text-center mb-16">
              <h2 className="text-4xl lg:text-5xl font-heading font-bold mb-4">
                Последние <span className="text-gradient">публикации</span>
              </h2>
              <p className="text-lg text-neutral-600 max-w-2xl mx-auto">
                Самые свежие и актуальные материалы из мира психологии, 
                нейронауки и практического саморазвития
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
              {featuredPosts.map((post: Post, index: number) => (
                <div 
                  key={post.slug} 
                  className="animate-fade-in"
                  style={{ animationDelay: `${index * 0.1}s` }}
                >
                  <StyledPostCard post={post} />
                </div>
              ))}
            </div>

            <div className="text-center mt-12">
              <a href="/blog" className="btn btn-secondary px-8 py-3">
                Смотреть все статьи
                <span className="ml-2">→</span>
              </a>
            </div>
          </div>
        </section>
      )}

      {/* Features Section */}
      <section className="section-padding px-4 bg-white">
        <div className="container-max">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="text-center p-6">
              <div className="w-16 h-16 bg-primary-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
                <span className="text-2xl">📚</span>
              </div>
              <h3 className="font-heading font-bold text-xl mb-2">Экспертные знания</h3>
              <p className="text-neutral-600">
                Материалы от практикующих психологов, коучей и специалистов по развитию
              </p>
            </div>
            
            <div className="text-center p-6">
              <div className="w-16 h-16 bg-secondary-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
                <span className="text-2xl">🔬</span>
              </div>
              <h3 className="font-heading font-bold text-xl mb-2">Научный подход</h3>
              <p className="text-neutral-600">
                Основано на последних исследованиях в области нейронауки и психологии
              </p>
            </div>
            
            <div className="text-center p-6">
              <div className="w-16 h-16 bg-success/10 rounded-2xl flex items-center justify-center mx-auto mb-4">
                <span className="text-2xl">💫</span>
              </div>
              <h3 className="font-heading font-bold text-xl mb-2">Практическая польза</h3>
              <p className="text-neutral-600">
                Конкретные техники и упражнения для применения в повседневной жизни
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="section-padding px-4 gradient-bg">
        <div className="container-max text-center">
          <h2 className="text-4xl lg:text-5xl font-heading font-bold mb-6">
            Готовы изменить свою жизнь?
          </h2>
          <p className="text-lg text-neutral-600 mb-8 max-w-2xl mx-auto">
            Присоединяйтесь к сообществу людей, стремящихся к росту и развитию. 
            Начните свой путь к лучшей версии себя сегодня.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <a href="/signup" className="btn btn-primary px-8 py-4 text-lg">
              Присоединиться
            </a>
            <a href="/blog" className="btn btn-ghost px-8 py-4 text-lg">
              Узнать больше
            </a>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-12 px-4 bg-neutral-900 text-white">
        <div className="container-max">
          <div className="flex flex-col lg:flex-row justify-between items-center">
            <div className="mb-6 lg:mb-0">
              <Link href="/" className="flex items-center space-x-3">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary-500 to-secondary-500 flex items-center justify-center">
                  <span className="text-white font-heading font-bold text-lg">Θ</span>
                </div>
                <span className="text-2xl font-heading font-bold">Positive Theta</span>
              </Link>
              <p className="text-neutral-400 mt-2">Блог о саморазвитии и личностном росте</p>
            </div>
            
            <div className="flex space-x-6">
              <a href="/privacy" className="text-neutral-400 hover:text-white transition-colors">Политика конфиденциальности</a>
              <a href="/terms" className="text-neutral-400 hover:text-white transition-colors">Условия использования</a>
              <a href="/contact" className="text-neutral-400 hover:text-white transition-colors">Контакты</a>
            </div>
          </div>
          
          <div className="border-t border-neutral-800 mt-8 pt-8 text-center text-neutral-500">
            <p>© {new Date().getFullYear()} Positive Theta. Все права защищены.</p>
          </div>
        </div>
      </footer>
    </div>
  );
}