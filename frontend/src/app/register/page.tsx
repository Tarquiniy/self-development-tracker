"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";

export default function RegisterPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleRegister(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/api/auth/register/`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ email, username, password }),
        }
      );

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.detail || "Ошибка регистрации");
      }

      // после успешной регистрации сразу редирект на главную
      router.push("/");
      router.refresh(); // ⚡ обновляем состояние (подтянет профиль)
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="container py-16">
      <div className="max-w-md mx-auto bg-card shadow-lg rounded-xl p-8">
        <h1 className="text-3xl font-bold mb-6 text-center">Регистрация</h1>
        <form onSubmit={handleRegister} className="flex flex-col gap-4">
          <input
            type="email"
            placeholder="Email"
            className="border rounded-lg px-4 py-2"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
          <input
            type="text"
            placeholder="Имя пользователя"
            className="border rounded-lg px-4 py-2"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            required
          />
          <input
            type="password"
            placeholder="Пароль"
            className="border rounded-lg px-4 py-2"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
          {error && <p className="text-red-500 text-sm">{error}</p>}
          <Button type="submit" className="btn-primary w-full" disabled={loading}>
            {loading ? "Создание..." : "Зарегистрироваться"}
          </Button>
        </form>
      </div>
    </main>
  );
}
