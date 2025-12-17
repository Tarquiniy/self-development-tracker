"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { createClient } from "@supabase/supabase-js";
import { useRouter } from "next/navigation";
import SocialLoginButtons from "@/components/SocialLoginButtons";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const SUPABASE_ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON);

export default function LoginPage(): React.ReactElement {
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    function onMessage(e: MessageEvent) {
      try {
        const payload = e.data;
        if (!payload) return;

        // ожидаем объект { type: 'social_auth', provider: 'yandex', action_link: '...' }
        if (payload?.type === "social_auth" && typeof payload?.action_link === "string") {
          // Дополнительная минимальная проверка безопасности:
          // убедимся, что action_link выглядит как URL (начинается с http)
          if (/^https?:\/\//i.test(payload.action_link)) {
            // перенаправляем пользователя на magic-link / action_link
            window.location.href = payload.action_link;
          } else {
            console.warn("social_auth action_link не похож на URL:", payload.action_link);
          }
        }
      } catch (err) {
        console.warn("Ошибка обработки postMessage:", err);
      }
    }

    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, []);

  async function handleSignIn(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const { data, error: signErr } = await supabase.auth.signInWithPassword({
        email,
        password,
      } as any);

      if (signErr) {
        setError(signErr.message || "Ошибка входа");
        setLoading(false);
        return;
      }

      // successful sign in - redirect to homepage
      router.push("/");
    } catch (err: any) {
      console.error("signin error", err);
      setError(String(err?.message ?? err));
    } finally {
      setLoading(false);
    }
  }

  async function handleMagicLink(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const { data, error: err } = await supabase.auth.signInWithOtp({ email } as any);
      if (err) {
        setError(err.message || "Не удалось отправить magic-link");
      } else {
        setError(null);
        alert("Magic-link отправлен на почту. Проверьте вашу почту.");
      }
    } catch (e) {
      setError("Ошибка запроса");
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <main className="page">
        <div className="card">
          <h1>Войти</h1>

          <form onSubmit={handleSignIn} className="form">
            <label className="field">
              <span className="label">Email</span>
              <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" required />
            </label>

            <label className="field">
              <span className="label">Пароль</span>
              <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" required />
            </label>

            {error && <div className="error">{error}</div>}

            <div className="actions">
              <button type="submit" className="primary" disabled={loading}>
                {loading ? "Вход…" : "Войти"}
              </button>

              <button type="button" className="ghost" onClick={handleMagicLink} disabled={loading || !email}>
                Отправить magic-link
              </button>
            </div>

            <div className="foot">
              <Link href="/register">Нет аккаунта? Зарегистрироваться</Link>
            </div>
          </form>

          <div className="mt-6">
            <p className="text-center text-sm text-gray-600 mb-2">Или войдите через соцсеть:</p>
            <SocialLoginButtons />
          </div>
        </div>
      </main>

      <style jsx>{`
        .page { min-height: calc(100vh - 64px); display:flex; align-items:center; justify-content:center; padding:32px; }
        .card { width:100%; max-width:520px; background: linear-gradient(180deg,#ffffff,#f8fbff); border-radius:12px; padding:24px; box-shadow: 0 10px 30px rgba(10,20,40,0.06); }
        h1 { margin:0 0 12px 0; font-size:20px; color:#0f1724; }
        .form { display:flex; flex-direction:column; gap:12px; }
        .field { display:flex; flex-direction:column; }
        .label { font-size:13px; color:#475569; margin-bottom:6px; }
        input { padding:10px 12px; border-radius:10px; border:1px solid rgba(15,23,36,0.06); font-size:14px; outline:none; background:#fff; }
        .actions { display:flex; gap:12px; align-items:center; margin-top:6px; }
        .primary { background:linear-gradient(90deg,#0073e6,#1fa6ff); color:#fff; padding:10px 14px; border-radius:10px; border:none; font-weight:700; cursor:pointer; }
        .primary:disabled { opacity:0.6; cursor:default; }
        .ghost { background:#fff; border:1px solid rgba(15,23,36,0.06); padding:10px 12px; border-radius:10px; cursor:pointer; }
        .foot { margin-top:8px; }
        .divider { text-align:center; margin:16px 0; color:#94a3b8; }
        .socialRow { display:flex; gap:12px; justify-content:center; }
        .error { color:#b91c1c; background: rgba(185,28,28,0.06); padding:8px; border-radius:8px; }
        @media (max-width:520px) { .card { padding:18px; } }
      `}</style>
    </>
  );
}
