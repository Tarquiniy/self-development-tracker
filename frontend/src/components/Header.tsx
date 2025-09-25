// frontend/src/components/Header.tsx
"use client";

import Link from "next/link";
import { useState, useEffect } from "react";

export default function Header() {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isScrolled, setIsScrolled] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 50);
    };

    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  return (
    <header className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
      isScrolled ? 'bg-white/95 backdrop-blur-md shadow-lg py-3' : 'bg-transparent py-6'
    }`}>
      <div className="container-max">
        <div className="flex items-center justify-between">
          {/* Логотип */}
          <Link href="/" className="flex items-center space-x-3 group">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-blue-500 to-purple-500 flex items-center justify-center shadow-lg">
              <span className="text-white font-heading font-bold text-xl">Θ</span>
            </div>
            <div className="flex flex-col">
              <span className="text-2xl font-heading font-bold bg-gradient-to-r from-neutral-900 to-neutral-700 bg-clip-text text-transparent">
                Positive Theta
              </span>
            </div>
          </Link>

          {/* Десктопная навигация */}
          <nav className="hidden lg:flex items-center space-x-8">
            <Link 
              href="/" 
              className="text-neutral-700 hover:text-blue-500 font-medium transition-colors duration-200 relative group"
            >
              Главная
              <span className="absolute bottom-0 left-0 w-0 h-0.5 bg-blue-500 group-hover:w-full transition-all duration-300"></span>
            </Link>
            <Link 
              href="/blog" 
              className="text-neutral-700 hover:text-blue-500 font-medium transition-colors duration-200 relative group"
            >
              Блог
              <span className="absolute bottom-0 left-0 w-0 h-0.5 bg-blue-500 group-hover:w-full transition-all duration-300"></span>
            </Link>
            <Link 
              href="/about" 
              className="text-neutral-700 hover:text-blue-500 font-medium transition-colors duration-200 relative group"
            >
              О проекте
              <span className="absolute bottom-0 left-0 w-0 h-0.5 bg-blue-500 group-hover:w-full transition-all duration-300"></span>
            </Link>
          </nav>

          {/* Кнопки авторизации */}
          <div className="hidden lg:flex items-center space-x-4">
            <Link 
              href="/login" 
              className="btn btn-ghost font-medium"
            >
              Войти
            </Link>
            <Link 
              href="/signup" 
              className="btn btn-primary font-medium"
            >
              Начать сейчас
            </Link>
          </div>

          {/* Мобильное меню */}
          <button 
            onClick={() => setIsMenuOpen(!isMenuOpen)}
            className="lg:hidden flex flex-col space-y-1.5 p-2 rounded-lg bg-white/80 backdrop-blur-sm border border-neutral-200"
          >
            <span className={`w-6 h-0.5 bg-neutral-700 transition-transform duration-300 ${isMenuOpen ? 'rotate-45 translate-y-2' : ''}`}></span>
            <span className={`w-6 h-0.5 bg-neutral-700 transition-opacity duration-300 ${isMenuOpen ? 'opacity-0' : 'opacity-100'}`}></span>
            <span className={`w-6 h-0.5 bg-neutral-700 transition-transform duration-300 ${isMenuOpen ? '-rotate-45 -translate-y-2' : ''}`}></span>
          </button>
        </div>

        {/* Мобильное меню выпадающее */}
        {isMenuOpen && (
          <div className="lg:hidden mt-6 bg-white/95 backdrop-blur-md rounded-2xl shadow-xl border border-neutral-200 p-6">
            <nav className="flex flex-col space-y-4">
              <Link 
                href="/" 
                className="text-neutral-700 hover:text-blue-500 font-medium py-2 transition-colors duration-200"
                onClick={() => setIsMenuOpen(false)}
              >
                Главная
              </Link>
              <Link 
                href="/blog" 
                className="text-neutral-700 hover:text-blue-500 font-medium py-2 transition-colors duration-200"
                onClick={() => setIsMenuOpen(false)}
              >
                Блог
              </Link>
              <Link 
                href="/about" 
                className="text-neutral-700 hover:text-blue-500 font-medium py-2 transition-colors duration-200"
                onClick={() => setIsMenuOpen(false)}
              >
                О проекте
              </Link>
            </nav>
            <div className="flex flex-col space-y-3 mt-6 pt-6 border-t border-neutral-200">
              <Link 
                href="/login" 
                className="btn btn-ghost w-full justify-center"
                onClick={() => setIsMenuOpen(false)}
              >
                Войти
              </Link>
              <Link 
                href="/signup" 
                className="btn btn-primary w-full justify-center"
                onClick={() => setIsMenuOpen(false)}
              >
                Начать сейчас
              </Link>
            </div>
          </div>
        )}
      </div>
    </header>
  );
}