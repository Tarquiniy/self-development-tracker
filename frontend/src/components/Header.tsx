"use client";
import Link from "next/link";
import { useState } from "react";

export default function Header() {
  const [open, setOpen] = useState(false);
  return (
    <header className="relative w-full">
      <div className="container-max flex items-center justify-between py-6">
        <Link href="/" className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-full bg-surface flex items-center justify-center shadow-card">
            PT
          </div>
          <div>
            <div className="text-2xl font-heading">Положительная тета</div>
            <div className="text-muted text-sm">Блог</div>
          </div>
        </Link>
        <nav className="hidden md:flex gap-8 items-center">
          <Link href="/blog" className="text-md text-text-primary hover:text-accent">Блог</Link>
          <Link href="/about" className="text-md text-muted hover:text-text-primary">О нас</Link>
          <Link href="/login" className="btn btn-ghost">Войти</Link>
          <Link href="/signup" className="btn btn-primary">Регистрация</Link>
        </nav>
        <div className="md:hidden">
          <button onClick={() => setOpen(v => !v)} className="p-2 rounded-md bg-surface shadow-card">
            <svg width="24" height="24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>
        </div>
      </div>
      {open && (
        <div className="absolute top-full inset-x-0 bg-surface shadow-card py-4 md:hidden">
          <div className="container-max flex flex-col gap-4">
            <Link href="/blog" className="text-text-primary">Блог</Link>
            <Link href="/about" className="text-muted">О нас</Link>
            <Link href="/login" className="btn btn-ghost">Войти</Link>
            <Link href="/signup" className="btn btn-primary">Регистрация</Link>
          </div>
        </div>
      )}
    </header>
  );
}
