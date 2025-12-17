"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@supabase/supabase-js";
import Link from "next/link";
import SocialLoginButtons from "@/components/SocialLoginButtons";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const SUPABASE_ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON);

export default function RegisterPage(): React.ReactElement {
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [about, setAbout] = useState("");

  // Новый чекбокс вместо возраста
  const [isAdult, setIsAdult] = useState(false);

  // Чекбокс согласия — автоматически стоит
  const [consent, setConsent] = useState(true);

  // Показывать/скрывать пароли
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  useEffect(() => {
    function onMessage(e: MessageEvent) {
      try {
        const payload = e.data;
        if (!payload) return;
        if (payload?.type === "social_auth" && typeof payload?.action_link === "string") {
          if (/^https?:\/\//i.test(payload.action_link)) {
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

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setInfo(null);

    // basic validations
    if (!email) {
      setError("Введите email.");
      return;
    }
    if (!password) {
      setError("Введите пароль.");
      return;
    }
    if (password !== confirmPassword) {
      setError("Пароли не совпадают.");
      return;
    }
    if (!isAdult) {
      setError("Подтвердите, что вам 18 лет или больше.");
      return;
    }
    if (!consent) {
      setError("Необходимо согласие на обработку персональных данных.");
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

      // Server-side upsert of profile
      try {
        const payload: any = {
          email,
          full_name: fullName || null,
          about: about || null,
          birthday: null, // мы заменили возраст на чекбокс — оставляем null
          consent_given: !!consent,
          consent_at: new Date().toISOString(),
          is_adult_confirmed: !!isAdult,
        };

        // include supabase uid if present
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
        setInfo("Регистрация прошла. Попытка сохранить профиль на сервере не удалась.");
      }

      // Redirect after signUp (may be adjusted if email confirm)
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

          <form onSubmit={handleSubmit} className="form" noValidate>
            <label className="field">
              <span className="label">Полное имя</span>
              <input
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="Иван Иванов"
                aria-label="Полное имя"
              />
            </label>

            <label className="field">
              <span className="label">Email <span className="required" aria-hidden>*</span></span>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                required
                aria-required="true"
                aria-label="Email"
              />
            </label>

            <label className="field">
              <span className="label">Пароль <span className="required" aria-hidden>*</span></span>
              <div className="pw-row">
                <input
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                  aria-required="true"
                  aria-label="Пароль"
                />
                <button
                  type="button"
                  className="eye-btn"
                  aria-label={showPassword ? "Скрыть пароль" : "Показать пароль"}
                  onClick={() => setShowPassword((s) => !s)}
                >
                  {showPassword ? "🙈" : "👁️"}
                </button>
              </div>
            </label>

            <label className="field">
              <span className="label">Повторите пароль <span className="required" aria-hidden>*</span></span>
              <div className="pw-row">
                <input
                  type={showConfirm ? "text" : "password"}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Повторите пароль"
                  required
                  aria-required="true"
                  aria-label="Повторите пароль"
                />
                <button
                  type="button"
                  className="eye-btn"
                  aria-label={showConfirm ? "Скрыть пароль" : "Показать пароль"}
                  onClick={() => setShowConfirm((s) => !s)}
                >
                  {showConfirm ? "🙈" : "👁️"}
                </button>
              </div>
            </label>

            {/* Заменили birthday на подтверждение 18+ */}
            <label className="consent-row">
              <input
                type="checkbox"
                checked={isAdult}
                onChange={(e) => setIsAdult(e.target.checked)}
                aria-label="Мне 18 лет или больше"
              />
              <span>Я подтверждаю, что мне 18 лет или больше</span>
            </label>

            <label className="field">
              <span className="label">О себе</span>
              <textarea
                value={about}
                onChange={(e) => setAbout(e.target.value)}
                maxLength={500}
                placeholder="Несколько слов о себе (макс. 500 символов)"
                aria-label="О себе"
              />
              <div className="hint">{about.length}/500</div>
            </label>

            <label className="consent">
              <input
                type="checkbox"
                checked={consent}
                onChange={(e) => setConsent(e.target.checked)}
                aria-label="Согласие на обработку персональных данных"
              />
              <span>Я соглашаюсь на использование и обработку моих персональных данных</span>
            </label>

            {error && (
              <div className="error" role="alert">
                {error}
              </div>
            )}
            {info && (
              <div className="info" role="status">
                {info}
              </div>
            )}

            <div className="actions">
              <button type="submit" className="primary" disabled={loading}>
                {loading ? "Регистрация…" : "Зарегистрироваться"}
              </button>
              <Link href="/login" className="link">
                Уже есть аккаунт? Войти
              </Link>
            </div>
          </form>

          <div className="mt-6">
            <p className="text-center text-sm text-gray-600 mb-2">Или войдите через соцсеть:</p>
            <SocialLoginButtons />
          </div>
        </div>
      </main>

      <style jsx>{`
        .page {
          min-height: calc(100vh - 64px);
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 32px;
        }
        .card {
          width: 100%;
          max-width: 520px;
          background: linear-gradient(180deg, #ffffff, #f8fbff);
          border-radius: 12px;
          padding: 24px;
          box-shadow: 0 10px 30px rgba(10,20,40,0.06);
        }
        h1 {
          margin: 0 0 12px 0;
          font-size: 20px;
          color: #0f1724;
        }
        .form {
          display: flex;
          flex-direction: column;
          gap: 12px;
        }
        .field {
          display: flex;
          flex-direction: column;
        }
        .label {
          font-size: 13px;
          color: #475569;
          margin-bottom: 6px;
        }

        /* required star */
        .required {
          color: #ef4444;
          margin-left: 6px;
          font-weight: 700;
        }

        input,
        textarea {
          padding: 10px 12px;
          border-radius: 10px;
          border: 1px solid rgba(15,23,36,0.06);
          font-size: 14px;
          outline: none;
          background: #fff;
          color: #0b1720;
        }
        textarea {
          min-height: 96px;
          resize: vertical;
        }
        .hint {
          font-size: 12px;
          color: #667085;
          text-align: right;
          margin-top: 4px;
        }

        /* password row with eye button */
        .pw-row {
          display: flex;
          gap: 8px;
          align-items: center;
        }
        .eye-btn {
          background: #fff;
          border: 1px solid rgba(15,23,36,0.06);
          border-radius: 8px;
          padding: 6px 8px;
          cursor: pointer;
          font-size: 16px;
          line-height: 1;
        }

        /* checkbox rows */
        .consent,
        .consent-row {
          display: flex;
          gap: 10px;
          align-items: center;
          font-size: 13px;
          color: #0f1724;
          margin-top: 4px;
        }

        /* Ensure checkboxes are visible across environments:
           restore native appearance and set accent-color for modern browsers */
        input[type="checkbox"] {
          /* try to restore native glyph if appearance was overridden globally */
          -webkit-appearance: checkbox;
          -moz-appearance: checkbox;
          appearance: checkbox;
          width: 18px;
          height: 18px;
          margin: 0;
          padding: 0;
          accent-color: #0b66ff; /* modern browsers show colored check */
        }

        .actions {
          display: flex;
          gap: 12px;
          align-items: center;
          margin-top: 6px;
        }
        .primary {
          background: linear-gradient(90deg, #0073e6, #1fa6ff);
          color: #fff;
          padding: 10px 14px;
          border-radius: 10px;
          border: none;
          font-weight: 700;
          cursor: pointer;
        }
        .primary:disabled {
          opacity: 0.6;
          cursor: default;
        }
        .link {
          color: #0f1724;
          text-decoration: underline;
          font-size: 14px;
          margin-left: auto;
        }
        .divider {
          text-align: center;
          margin: 16px 0;
          color: #94a3b8;
        }
        .socialRow {
          display: flex;
          gap: 12px;
          justify-content: center;
        }
        .error {
          color: #b91c1c;
          background: rgba(185, 28, 28, 0.06);
          padding: 8px;
          border-radius: 8px;
        }
        .info {
          color: #064e3b;
          background: rgba(6, 78, 59, 0.06);
          padding: 8px;
          border-radius: 8px;
        }

        @media (max-width: 520px) {
          .card {
            padding: 18px;
          }
        }
      `}</style>
    </>
  );
}
