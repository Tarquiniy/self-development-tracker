// frontend/src/app/contact/page.tsx
import Header from "@/components/Header";
import Link from "next/link";

export default function ContactPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-neutral-50 via-white to-blue-50/20">
      <Header />
      
      <section className="pt-32 pb-20 px-4">
        <div className="container-max max-w-4xl mx-auto">
          <h1 className="text-4xl lg:text-5xl font-heading font-bold mb-8 text-center">Контакты</h1>
          
          <div className="bg-white rounded-3xl shadow-lg p-8 lg:p-12">
            <div className="grid md:grid-cols-2 gap-8">
              <div>
                <h2 className="text-2xl font-heading font-bold mb-4">Свяжитесь с нами</h2>
                <p className="text-neutral-600 mb-6">
                  Есть вопросы или предложения? Мы всегда рады помочь!
                </p>
                
                <div className="space-y-4">
                  <div>
                    <h3 className="font-semibold text-neutral-900">Email</h3>
                    <p className="text-neutral-600">hello@positivetheta.com</p>
                  </div>
                </div>
              </div>
              
              <div>
                <form className="space-y-4">
                  <input 
                    type="text" 
                    placeholder="Ваше имя"
                    className="w-full px-4 py-3 rounded-xl border border-neutral-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  <input 
                    type="email" 
                    placeholder="Email"
                    className="w-full px-4 py-3 rounded-xl border border-neutral-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  <textarea 
                    placeholder="Сообщение"
                    rows={4}
                    className="w-full px-4 py-3 rounded-xl border border-neutral-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  ></textarea>
                  <button type="submit" className="btn btn-primary w-full">
                    Отправить сообщение
                  </button>
                </form>
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}