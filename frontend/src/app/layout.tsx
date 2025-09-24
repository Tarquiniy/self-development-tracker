// frontend/src/app/layout.tsx
"use client";

import "./globals.css";
import { Inter, Playfair_Display } from "next/font/google";
import Link from "next/link";
import { useState, useEffect } from "react";
import { ThemeProvider, useTheme } from "next-themes";
import { Sun, Moon } from "lucide-react";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });
const playfair = Playfair_Display({ subsets: ["latin"], variable: "--font-playfair" });

// ================== Header ==================
function Header() {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  return (
    <header className="sticky top-0 z-50 bg-white/70 dark:bg-neutral-950/70 backdrop-blur-md border-b border-gray-200 dark:border-neutral-800">
      <div className="max-w-7xl mx-auto px-6 py-4 flex justify-between items-center">
        {/* Logo */}
        <Link
          href="/"
          className="text-2xl font-bold text-pink-600 font-playfair"
        >
          Positive Theta
        </Link>

        {/* Navigation */}
        <nav className="hidden md:flex gap-6 text-gray-700 dark:text-gray-200 font-medium">
          <Link href="/" className="hover:text-pink-600 transition">Главная</Link>
          <Link href="/blog" className="hover:text-pink-600 transition">Блог</Link>
          <Link href="/about" className="hover:text-pink-600 transition">О нас</Link>
          <Link href="/contacts" className="hover:text-pink-600 transition">Контакты</Link>
        </nav>

        {/* Actions */}
        <div className="flex items-center gap-4">
          {/* Theme Toggle */}
          {mounted && (
            <button
              onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
              className="p-2 rounded-full bg-gray-100 dark:bg-neutral-800 text-gray-700 dark:text-gray-200 hover:bg-gray-200 dark:hover:bg-neutral-700 transition"
            >
              {theme === "dark" ? <Sun size={18} /> : <Moon size={18} />}
            </button>
          )}
        </div>
      </div>
    </header>
  );
}

// ================== Footer ==================
function Footer() {
  return (
    <footer className="bg-gray-100 dark:bg-neutral-900 border-t border-gray-200 dark:border-neutral-800 mt-20">
      <div className="max-w-7xl mx-auto px-6 py-10 text-center">
        <p className="text-gray-600 dark:text-gray-400 text-sm">
          © {new Date().getFullYear()} Positive Theta. Все права защищены.
        </p>
        <div className="mt-4 flex justify-center gap-6 text-gray-500 dark:text-gray-400">
          <Link href="/privacy" className="hover:text-pink-600 transition">Политика конфиденциальности</Link>
          <Link href="/terms" className="hover:text-pink-600 transition">Условия использования</Link>
        </div>
      </div>
    </footer>
  );
}

// ================== RootLayout ==================
export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ru" suppressHydrationWarning>
      <body className={`${inter.variable} ${playfair.variable} font-sans bg-white dark:bg-neutral-950 text-gray-900 dark:text-gray-100 transition-colors duration-300`}>
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
          <Header />
          {children}
          <Footer />
        </ThemeProvider>
      </body>
    </html>
  );
}
