import Link from 'next/link'

export default function LoginPage() {
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
          </div>
        </div>
      </header>

      <main className="flex-grow py-12">
        <div className="container mx-auto px-4 max-w-md">
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-8">
            <h1 className="text-2xl font-bold text-gray-900 mb-6">Вход в аккаунт</h1>
            <form className="space-y-4">
              <input type="email" placeholder="Email" className="w-full p-3 border border-gray-300 rounded-lg" />
              <input type="password" placeholder="Пароль" className="w-full p-3 border border-gray-300 rounded-lg" />
              <button type="submit" className="w-full bg-blue-500 text-white p-3 rounded-lg hover:bg-blue-600">
                Войти
              </button>
            </form>
            <Link href="/" className="block text-center text-blue-500 hover:text-blue-600 mt-4">
              ← Вернуться на главную
            </Link>
          </div>
        </div>
      </main>
    </div>
  )
}