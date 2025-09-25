// frontend/src/app/signup/page.tsx
import Header from "@/components/Header";
import Link from "next/link";

export default function SignupPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-neutral-50 via-white to-blue-50/20">
      <Header />
      
      <section className="pt-32 pb-20 px-4">
        <div className="container-max max-w-md mx-auto">
          <div className="bg-white rounded-3xl shadow-lg p-8">
            <h1 className="text-3xl font-heading font-bold mb-6 text-center">Регистрация</h1>
            
            <form className="space-y-6">
              <div>
                <label className="block text-sm font-medium text-neutral-700 mb-2">
                  Имя
                </label>
                <input 
                  type="text" 
                  className="w-full px-4 py-3 rounded-xl border border-neutral-200 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="Ваше имя"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-neutral-700 mb-2">
                  Email
                </label>
                <input 
                  type="email" 
                  className="w-full px-4 py-3 rounded-xl border border-neutral-200 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="your@email.com"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-neutral-700 mb-2">
                  Пароль
                </label>
                <input 
                  type="password" 
                  className="w-full px-4 py-3 rounded-xl border border-neutral-200 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="••••••••"
                />
              </div>
              
              <button type="submit" className="btn btn-primary w-full">
                Зарегистрироваться
              </button>
            </form>
            
            <div className="mt-6 text-center">
              <p className="text-neutral-600">
                Уже есть аккаунт?{' '}
                <Link href="/login" className="text-blue-500 hover:text-blue-600 font-medium">
                  Войти
                </Link>
              </p>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}