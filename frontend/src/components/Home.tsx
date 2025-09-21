// frontend/src/components/Home.tsx
import React from "react";
import { useNavigate } from "react-router-dom";

const Home: React.FC = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-600 via-purple-600 to-pink-500 flex items-center justify-center px-6">
      <div className="max-w-3xl bg-white/90 rounded-2xl shadow-2xl p-10 text-center backdrop-blur-sm">
        <h1 className="text-4xl md:text-5xl font-extrabold text-gray-900 mb-6">
          Positive Theta
        </h1>
        <p className="text-lg md:text-xl text-gray-700 leading-relaxed mb-10">
          Саморазвитие — это ключ к личному росту и успеху. 
          Наше приложение помогает отслеживать прогресс, 
          формировать полезные привычки и достигать поставленных целей. 
          Делай каждый день шаг вперёд и фиксируй результаты!
        </p>

        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <button
            onClick={() => navigate("/login")}
            className="px-6 py-3 bg-indigo-600 text-white rounded-xl font-semibold shadow hover:bg-indigo-700 transition-transform transform hover:scale-105"
          >
            Вход
          </button>
          <button
            onClick={() => navigate("/register")}
            className="px-6 py-3 bg-green-600 text-white rounded-xl font-semibold shadow hover:bg-green-700 transition-transform transform hover:scale-105"
          >
            Регистрация
          </button>
          <button
            onClick={() => navigate("/blog")}
            className="px-6 py-3 bg-pink-600 text-white rounded-xl font-semibold shadow hover:bg-pink-700 transition-transform transform hover:scale-105"
          >
            Блог
          </button>
        </div>
      </div>
    </div>
  );
};

export default Home;
