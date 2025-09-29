"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";

export default function Navbar() {
  const { user, loading, logout } = useAuth();

  return (
    <header className="w-full border-b border-border bg-background/70 backdrop-blur">
      <div className="container flex items-center justify-between py-4">
        {/* Лого */}
        <Link href="/" className="text-xl font-extrabold tracking-tight text-primary">
          Positive Theta
        </Link>

        {/* Навигация */}
        <nav className="flex items-center gap-4">
          {!loading && user ? (
            <>
              <span className="text-muted-foreground hidden sm:inline">
                Привет, {user.username}
              </span>
              <Button variant="secondary" onClick={logout}>
                Выйти
              </Button>
            </>
          ) : (
            <>
              <Link href="/login">
                <Button variant="secondary">Войти</Button>
              </Link>
              <Link href="/register">
                <Button className="btn-primary">Регистрация</Button>
              </Link>
            </>
          )}
        </nav>
      </div>
    </header>
  );
}
