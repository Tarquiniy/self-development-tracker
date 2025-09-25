// frontend/src/app/page.tsx
import Link from 'next/link'
import PostCard from '@/components/PostCard'

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'https://sdracker.onrender.com'

interface Post {
  id: number
  slug: string
  title: string
  excerpt: string
  featured_image?: string
  og_image?: string
  published_at: string
  categories?: Array<{ title: string; slug: string }>
}

async function getFeaturedPosts(): Promise<Post[]> {
  try {
    const res = await fetch(`${API_BASE_URL}/api/blog/posts/?page=1&per_page=3`, {
      next: { 
        revalidate: 3600,
        tags: ['posts'] 
      }
    })
    
    if (!res.ok) return []
    const data = await res.json()
    return Array.isArray(data) ? data : data.results || []
  } catch (error) {
    return []
  }
}

export default async function Home() {
  const featuredPosts = await getFeaturedPosts()

  return (
    <div className="min-h-screen flex flex-col">
      <header className="bg-white shadow-sm border-b border-gray-200">
        <div className="container mx-auto px-4">
          <div className="flex justify-between items-center py-4">
            <Link href="/" className="flex items-center space-x-3">
              <div className="w-10 h-10 bg-blue-500 rounded-lg flex items-center justify-center">
                <span className="text-white font-bold text-lg">Θ</span>
              </div>
              <span className="text-xl font-bold text-gray-900">Positive Theta</span>
            </Link>
            
            <nav className="hidden md:flex space-x-8">
              <Link href="/" className="text-blue-500 font-medium">Главная</Link>
              <Link href="/blog" className="text-gray-700 hover:text-blue-500 font-medium">Блог</Link>
              <Link href="/about" className="text-gray-700 hover:text-blue-500 font-medium">О нас</Link>
            </nav>
            
            <div className="flex space-x-4">
              <Link href="/login" className="text-gray-700 hover:text-blue-500 font-medium">Войти</Link>
              <Link href="/signup" className="bg-blue-500 text-white px-4 py-2 rounded-lg hover:bg-blue-600 font-medium">
                Регистрация
              </Link>
            </div>
          </div>
        </div>
      </header>

      <main className="flex-grow">
        <section className="py-20 bg-gradient-to-br from-blue-50 to-white">
          <div className="container mx-auto px-4 text-center">
            <h1 className="text-4xl md:text-6xl font-bold text-gray-900 mb-6">
              Раскройте свой <span className="text-blue-500">потенциал</span>
            </h1>
            <p className="text-xl text-gray-600 mb-8 max-w-2xl mx-auto">
              Современный подход к саморазвитию через науку, практику и вдохновение
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link href="/blog" className="bg-blue-500 text-white px-8 py-3 rounded-lg hover:bg-blue-600 font-medium">
                Начать читать
              </Link>
              <Link href="/about" className="border border-gray-300 text-gray-700 px-8 py-3 rounded-lg hover:border-blue-300 font-medium">
                Узнать больше
              </Link>
            </div>
          </div>
        </section>

        {featuredPosts.length > 0 && (
          <section className="py-16 bg-white">
            <div className="container mx-auto px-4">
              <div className="text-center mb-12">
                <h2 className="text-3xl font-bold text-gray-900 mb-4">Последние статьи</h2>
                <p className="text-gray-600 text-lg">Самые свежие материалы из нашего блога</p>
              </div>
              
              <div className="grid md:grid-cols-3 gap-8">
                {featuredPosts.map((post) => (
                  <PostCard key={post.id} post={post} />
                ))}
              </div>
              
              <div className="text-center mt-12">
                <Link href="/blog" className="bg-blue-500 text-white px-6 py-3 rounded-lg hover:bg-blue-600 font-medium">
                  Смотреть все статьи
                </Link>
              </div>
            </div>
          </section>
        )}
      </main>

      <footer className="bg-gray-900 text-white py-12">
        <div className="container mx-auto px-4">
          <div className="flex flex-col md:flex-row justify-between items-center">
            <div className="mb-6 md:mb-0">
              <Link href="/" className="flex items-center space-x-3">
                <div className="w-10 h-10 bg-blue-500 rounded-lg flex items-center justify-center">
                  <span className="text-white font-bold text-lg">Θ</span>
                </div>
                <span className="text-xl font-bold">Positive Theta</span>
              </Link>
              <p className="text-gray-400 mt-2">Блог о саморазвитии</p>
            </div>
            
            <div className="flex space-x-6">
              <Link href="/privacy" className="text-gray-400 hover:text-white">Политика</Link>
              <Link href="/terms" className="text-gray-400 hover:text-white">Условия</Link>
              <Link href="/contact" className="text-gray-400 hover:text-white">Контакты</Link>
            </div>
          </div>
          
          <div className="border-t border-gray-800 mt-8 pt-8 text-center text-gray-400">
            <p>© {new Date().getFullYear()} Positive Theta. Все права защищены.</p>
          </div>
        </div>
      </footer>
    </div>
  )
}