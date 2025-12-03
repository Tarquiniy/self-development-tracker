// frontend/src/app/register/page.tsx
"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@supabase/supabase-js";
import Link from "next/link";
import TelegramLoginButton from "@/components/TelegramLoginButton";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const SUPABASE_ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON);

export default function RegisterPage(): React.ReactElement {
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [birthday, setBirthday] = useState("");
  const [about, setAbout] = useState("");
  const [consent, setConsent] = useState(true); // auto-checked as requested
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setInfo(null);

    if (!consent) {
      setError("Необходимо согласие на обработку персональных данных.");
      return;
    }
    if (!email || !password) {
      setError("Введите email и пароль.");
      return;
    }
    setLoading(true);

    try {
      // Create user using Supabase client (anon key)
      const { data: signData, error: signErr } = await supabase.auth.signUp({
        email,
        password,
      } as any);

      if (signErr) {
        setError(signErr.message || "Ошибка регистрации");
        setLoading(false);
        return;
      }

      // Try to obtain the Supabase user id.
      // signData.user.id is the usual place. If it's not present (e.g. email confirm flow),
      // try to get currently signed-in user as fallback.
      let supabaseUserId: string | null = (signData as any)?.user?.id ?? null;

      if (!supabaseUserId) {
        try {
          const { data: getUserData, error: getUserErr } = await supabase.auth.getUser();
          if (!getUserErr && (getUserData as any)?.user?.id) {
            supabaseUserId = (getUserData as any).user.id;
          }
        } catch (err) {
          // ignore — we'll still attempt server upsert without uid
          console.warn("Could not fetch supabase user after signUp:", err);
        }
      }

      // Try to upsert profile via server-side endpoint.
      // Server endpoint must use service_role key to write into protected tables.
      try {
        const payload: any = {
          email,
          full_name: fullName || null,
          about: about || null,
          birthday: birthday || null,
          consent_given: !!consent,
          consent_at: new Date().toISOString(),
        };

        // include supabase uid if we have it — this allows profiles.id = auth.users.id
        if (supabaseUserId) {
          payload.supabase_uid = supabaseUserId;
        }

        const res = await fetch("/api/profiles", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });

        const j = await res.json().catch(() => null);
        if (!res.ok) {
          console.warn("Server profile upsert failed", j);
          // Not fatal for auth flow. Provide informative message to user.
          // If signUp requires email confirmation, let the user know as well.
          const needsConfirm = !!((signData as any)?.user?.confirmation_sent_at || (signData as any)?.user?.email_confirmed_at === null);
          setInfo(
            needsConfirm
              ? "Регистрация завершена. На e-mail отправлено письмо подтверждения. Профиль не был создан автоматически (сервер вернул ошибку)."
              : "Регистрация прошла. Профиль не создан автоматически (сервер вернул ошибку)."
          );
        } else {
          setInfo("Регистрация успешно завершена. Профиль создан.");
        }
      } catch (upsertErr) {
        console.warn("Profile upsert request error", upsertErr);
        // Non-blocking: user was created in Supabase; profile save failed.
        setInfo("Регистрация прошла. Попытка сохранить профиль на сервере не удалась.");
      }

      // Redirect after signUp. If email confirmation required, you may prefer a page that explains next steps.
      router.push("/");
    } catch (err: any) {
      console.error("register error", err);
      setError(String(err?.message ?? err));
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <main className="page">
        <div className="card">
          <h1>Создать аккаунт</h1>

          <form onSubmit={handleSubmit} className="form">
            <label className="field">
              <span className="label">Полное имя</span>
              <input value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="Иван Иванов" />
            </label>

            <label className="field">
              <span className="label">Email</span>
              <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" required />
            </label>

            <label className="field">
              <span className="label">Пароль</span>
              <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" required />
            </label>

            <label className="field">
              <span className="label">Дата рождения</span>
              <input type="date" value={birthday} onChange={(e) => setBirthday(e.target.value)} />
            </label>

            <label className="field">
              <span className="label">О себе</span>
              <textarea value={about} onChange={(e) => setAbout(e.target.value)} maxLength={500} placeholder="Несколько слов о себе (макс. 500 символов)" />
              <div className="hint">{about.length}/500</div>
            </label>

            <label className="consent">
              <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} />
              <span>Я соглашаюсь на использование и обработку моих персональных данных</span>
            </label>

            {error && <div className="error" role="alert">{error}</div>}
            {info && <div className="info" role="status">{info}</div>}

            <div className="actions">
              <button type="submit" className="primary" disabled={loading}>
                {loading ? "Регистрация…" : "Зарегистрироваться"}
              </button>
              <Link href="/login" className="link">Уже есть аккаунт? Войти</Link>
            </div>
          </form>

          <div className="mt-6">
            <p className="text-center text-sm text-gray-600 mb-2">Или войдите через Telegram:</p>
            <TelegramLoginButton />
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
        input, textarea { padding:10px 12px; border-radius:10px; border:1px solid rgba(15,23,36,0.06); font-size:14px; outline:none; background:#fff; }
        textarea { min-height:96px; resize:vertical; }
        .hint { font-size:12px; color:#667085; text-align:right; margin-top:4px; }
        .consent { display:flex; gap:10px; align-items:center; font-size:13px; color:#0f1724; margin-top:4px; }
        .actions { display:flex; gap:12px; align-items:center; margin-top:6px; }
        .primary { background:linear-gradient(90deg,#0073e6,#1fa6ff); color:#fff; padding:10px 14px; border-radius:10px; border:none; font-weight:700; cursor:pointer; }
        .primary:disabled { opacity:0.6; cursor:default; }
        .link { color:#0f1724; text-decoration:underline; font-size:14px; margin-left:auto; }
        .divider { text-align:center; margin:16px 0; color:#94a3b8; }
        .socialRow { display:flex; gap:12px; justify-content:center; }
        .error { color:#b91c1c; background: rgba(185,28,28,0.06); padding:8px; border-radius:8px; }
        .info { color:#064e3b; background: rgba(6,78,59,0.06); padding:8px; border-radius:8px; }
        @media (max-width:520px) { .card { padding:18px; } }
      `}</style>
    </>
  );
}
