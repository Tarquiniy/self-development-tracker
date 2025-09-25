// frontend/src/app/blog/page.tsx
import Link from 'next/link'
import PostCard from '@/components/PostCard'

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'https://sdracker.onrender.com'

interface Category {
  title: string
  slug: string
}

interface Post {
  id: number
  slug: string
  title: string
  excerpt: string
  featured_image?: string
  og_image?: string
  published_at: string
  categories?: Category[]
}

async function getPosts(): Promise<Post[]> {
  try {
    const res = await fetch(`${API_BASE_URL}/api/blog/posts/?page=1&per_page=20`, {
      next: { 
        revalidate: 3600, // 1 час кэша
        tags: ['posts'] // Тег для ревалидации
      }
    })
    
    if (!res.ok) {
      throw new Error(`Failed to fetch posts: ${res.status}`)
    }
    
    const data = await res.json()
    return Array.isArray(data) ? data : data.results || []
  } catch (error) {
    console.error('Error fetching posts:', error)
    return []
  }
}

export default async function BlogPage() {
  const posts = await getPosts()

  return (
    <div className="min-h-screen flex flex-col">
      {/* Header */}
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
              <Link href="/" className="text-gray-700 hover:text-blue-500 font-medium">Главная</Link>
              <Link href="/blog" className="text-blue-500 font-medium">Блог</Link>
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

      {/* Main Content */}
      <main className="flex-grow py-12">
        <div className="container mx-auto px-4">
          <div className="text-center mb-12">
            <h1 className="text-4xl font-bold text-gray-900 mb-4">Блог</h1>
            <p className="text-xl text-gray-600 max-w-2xl mx-auto">
              Исследуйте коллекцию статей о саморазвитии, психологии и личностном росте
            </p>
          </div>

          {posts.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
              {posts.map((post) => (
                <PostCard key={post.id} post={post} />
              ))}
            </div>
          ) : (
            <div className="text-center py-12">
              <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-8 max-w-md mx-auto">
                <p className="text-gray-600 mb-4">Пока нет статей. Скоро здесь появятся интересные материалы!</p>
                <Link href="/" className="text-blue-500 hover:text-blue-600 font-medium">
                  ← Вернуться на главную
                </Link>
              </div>
            </div>
          )}
        </div>
      </main>

      {/* Footer */}
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