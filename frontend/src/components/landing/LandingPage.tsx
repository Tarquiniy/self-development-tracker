import React from 'react';
import { Link } from 'react-router-dom';
import { Brain, Target, TrendingUp, Calendar, Users, Award, ArrowRight } from 'lucide-react';

const LandingPage: React.FC = () => {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 text-white">
      {/* Navigation */}
      <nav className="container mx-auto px-4 py-6 flex justify-between items-center">
        <div className="flex items-center space-x-2">
          <Brain className="h-8 w-8 text-purple-400" />
          <span className="text-2xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-purple-400 to-pink-400">
            SelfDevTracker
          </span>
        </div>
        <div className="flex items-center space-x-6">
          <Link to="/blog" className="hover:text-purple-300 transition-colors">
            Блог
          </Link>
          <Link to="/login" className="hover:text-purple-300 transition-colors">
            Вход
          </Link>
          <Link 
            to="/register" 
            className="bg-purple-600 hover:bg-purple-700 px-4 py-2 rounded-lg font-medium transition-colors"
          >
            Регистрация
          </Link>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="container mx-auto px-4 py-20 text-center">
        <h1 className="text-5xl md:text-6xl font-bold mb-6 leading-tight">
          Преобразуйте ваше 
          <span className="bg-clip-text text-transparent bg-gradient-to-r from-purple-400 to-pink-400"> саморазвитие </span>
          в измеримый прогресс
        </h1>
        <p className="text-xl text-gray-300 mb-12 max-w-3xl mx-auto">
          Современная платформа для отслеживания личного роста, формирования привычек и достижения целей. 
          Статистика, аналитика и персональные рекомендации на основе вашего прогресса.
        </p>
        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <Link 
            to="/register" 
            className="bg-purple-600 hover:bg-purple-700 px-8 py-4 rounded-lg font-semibold text-lg transition-all transform hover:scale-105 flex items-center justify-center space-x-2"
          >
            <span>Начать бесплатно</span>
            <ArrowRight className="h-5 w-5" />
          </Link>
          <Link 
            to="/blog" 
            className="border border-purple-400 text-purple-300 hover:bg-purple-800 px-8 py-4 rounded-lg font-semibold text-lg transition-all"
          >
            Узнать больше
          </Link>
        </div>
      </section>

      {/* Features Section */}
      <section className="container mx-auto px-4 py-20">
        <div className="text-center mb-16">
          <h2 className="text-3xl md:text-4xl font-bold mb-4">Почему саморазвитие важно в 2025?</h2>
          <p className="text-xl text-gray-300 max-w-2xl mx-auto">
            В быстро меняющемся мире постоянное обучение и развитие - ключ к успеху и удовлетворенности жизнью
          </p>
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
          <div className="bg-slate-800/50 p-6 rounded-xl backdrop-blur-sm">
            <Target className="h-12 w-12 text-purple-400 mb-4" />
            <h3 className="text-xl font-semibold mb-3">Четкие цели</h3>
            <p className="text-gray-300">
              Ставьте конкретные, измеримые цели и отслеживайте прогресс в реальном времени. 
              Визуализация помогает сохранять мотивацию и фокус.
            </p>
          </div>

          <div className="bg-slate-800/50 p-6 rounded-xl backdrop-blur-sm">
            <TrendingUp className="h-12 w-12 text-purple-400 mb-4" />
            <h3 className="text-xl font-semibold mb-3">Измеримый прогресс</h3>
            <p className="text-gray-300">
              Анализируйте свои достижения с помощью продвинутой статистики и графиков. 
              Понимание трендов помогает корректировать стратегию развития.
            </p>
          </div>

          <div className="bg-slate-800/50 p-6 rounded-xl backdrop-blur-sm">
            <Calendar className="h-12 w-12 text-purple-400 mb-4" />
            <h3 className="text-xl font-semibold mb-3">Привычки и рутины</h3>
            <p className="text-gray-300">
              Формируйте полезные привычки с помощью ежедневного трекинга. 
              Небольшие ежедневные действия приводят к значительным долгосрочным результатам.
            </p>
          </div>

          <div className="bg-slate-800/50 p-6 rounded-xl backdrop-blur-sm">
            <Users className="h-12 w-12 text-purple-400 mb-4" />
            <h3 className="text-xl font-semibold mb-3">Сообщество</h3>
            <p className="text-gray-300">
              Присоединяйтесь к сообществу единомышленников, делитесь успехами и 
              получайте поддержку в вашем путешествии саморазвития.
            </p>
          </div>

          <div className="bg-slate-800/50 p-6 rounded-xl backdrop-blur-sm">
            <Award className="h-12 w-12 text-purple-400 mb-4" />
            <h3 className="text-xl font-semibold mb-3">Персональные инсайты</h3>
            <p className="text-gray-300">
              Искусственный интеллект анализирует ваши данные и предоставляет 
              персонализированные рекомендации для оптимального развития.
            </p>
          </div>

          <div className="bg-slate-800/50 p-6 rounded-xl backdrop-blur-sm">
            <Brain className="h-12 w-12 text-purple-400 mb-4" />
            <h3 className="text-xl font-semibold mb-3">Нейронаука</h3>
            <p className="text-gray-300">
              Методы, основанные на последних исследованиях в области нейропластичности 
              и когнитивной психологии для максимальной эффективности.
            </p>
          </div>
        </div>
      </section>

      {/* Stats Section */}
      <section className="container mx-auto px-4 py-20">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-8 text-center">
          <div>
            <div className="text-3xl md:text-4xl font-bold text-purple-400 mb-2">92%</div>
            <p className="text-gray-300">пользователей отмечают рост продуктивности</p>
          </div>
          <div>
            <div className="text-3xl md:text-4xl font-bold text-purple-400 mb-2">47%</div>
            <p className="text-gray-300">увеличивают скорость достижения целей</p>
          </div>
          <div>
            <div className="text-3xl md:text-4xl font-bold text-purple-400 mb-2">84%</div>
            <p className="text-gray-300">лучше понимают свои сильные стороны</p>
          </div>
          <div>
            <div className="text-3xl md:text-4xl font-bold text-purple-400 mb-2">68%</div>
            <p className="text-gray-300">формируют устойчивые полезные привычки</p>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="container mx-auto px-4 py-20 text-center">
        <h2 className="text-3xl md:text-4xl font-bold mb-6">Начните свой путь к лучшей версии себя</h2>
        <p className="text-xl text-gray-300 mb-8 max-w-2xl mx-auto">
          Присоединяйтесь к тысячам пользователей, которые уже трансформировали свою жизнь 
          с помощью системного подхода к саморазвитию
        </p>
        <Link 
          to="/register" 
          className="bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 px-8 py-4 rounded-lg font-semibold text-lg inline-block transition-all transform hover:scale-105"
        >
          Создать аккаунт бесплатно
        </Link>
      </section>

      {/* Footer */}
      <footer className="border-t border-gray-800 py-8">
        <div className="container mx-auto px-4 text-center text-gray-400">
          <p>© 2025 SelfDevTracker. Все права защищены.</p>
        </div>
      </footer>
    </div>
  );
};

export default LandingPage;