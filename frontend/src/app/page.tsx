// frontend/src/app/page.tsx
import Link from 'next/link'
import { ArrowRight } from 'lucide-react'

export default function Home() {
  return (
    <div className="min-h-screen flex flex-col bg-gradient-to-br from-pink-50 via-white to-purple-50">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-white/70 backdrop-blur-md border-b border-pink-100">
        <div className="container mx-auto px-6 flex justify-between items-center py-5">
          <Link href="/" className="text-2xl font-bold bg-gradient-to-r from-pink-500 to-purple-500 bg-clip-text text-transparent">
            Positive Theta
          </Link>
          <nav className="flex gap-6 text-gray-700 font-medium">
            <Link href="/blog" className="hover:text-pink-500 transition-colors">Блог</Link>
            <Link href="/login" className="hover:text-pink-500 transition-colors">Войти</Link>
            <Link
              href="/signup"
              className="px-5 py-2 rounded-xl bg-gradient-to-r from-pink-400 to-purple-500 text-white font-medium shadow-md hover:shadow-lg transition-all"
            >
              Зарегистрироваться
            </Link>
          </nav>
        </div>
      </header>

      {/* Main */}
      <main className="flex-grow flex items-center justify-center text-center px-6">
        <div className="max-w-3xl animate-fade-in">
          <h1 className="text-5xl lg:text-7xl font-extrabold mb-8 leading-tight bg-gradient-to-r from-pink-500 to-purple-600 bg-clip-text text-transparent">
            Саморазвитие через осознанность
          </h1>
          <p className="text-lg lg:text-xl text-gray-600 mb-10 leading-relaxed">
            Positive Theta — это пространство для вдохновения, личностного роста и поиска гармонии.
            Мы объединяем науку, практику и философию для того, чтобы каждый мог раскрыть свой потенциал.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link
              href="/signup"
              className="px-8 py-4 rounded-xl bg-gradient-to-r from-pink-400 to-purple-500 text-white font-semibold text-lg flex items-center gap-2 hover:shadow-xl transition-all"
            >
              Начать путь <ArrowRight className="w-5 h-5" />
            </Link>
            <Link
              href="/blog"
              className="px-8 py-4 rounded-xl border-2 border-pink-200 text-gray-700 font-semibold text-lg hover:border-pink-400 hover:text-pink-500 transition-all"
            >
              Читать блог
            </Link>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="bg-white border-t border-pink-100 py-8 text-center text-gray-500 text-sm">
        © {new Date().getFullYear()} Positive Theta. Все права защищены.
      </footer>
    </div>
  )
}
