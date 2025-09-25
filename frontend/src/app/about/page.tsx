import Link from 'next/link'

export default function AboutPage() {
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
              <Link href="/" className="text-gray-700 hover:text-blue-500 font-medium">Главная</Link>
              <Link href="/blog" className="text-gray-700 hover:text-blue-500 font-medium">Блог</Link>
              <Link href="/about" className="text-blue-500 font-medium">О нас</Link>
            </nav>
          </div>
        </div>
      </header>

      <main className="flex-grow py-12">
        <div className="container mx-auto px-4 max-w-4xl">
          <h1 className="text-4xl font-bold text-gray-900 mb-6">О нас</h1>
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-8">
            <p className="text-gray-600 mb-4">Positive Theta — это платформа для саморазвития.</p>
            <Link href="/" className="text-blue-500 hover:text-blue-600 font-medium">
              ← Вернуться на главную
            </Link>
          </div>
        </div>
      </main>

      <footer className="bg-gray-900 text-white py-12">
        <div className="container mx-auto px-4 text-center">
          <p>© 2024 Positive Theta. Все права защищены.</p>
        </div>
      </footer>
    </div>
  )
}