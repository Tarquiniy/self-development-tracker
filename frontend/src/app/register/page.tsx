"use client";

import React, { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@supabase/supabase-js";
import Link from "next/link";
import SocialLoginButtons from "@/components/SocialLoginButtons";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const SUPABASE_ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";
// Backend origin (may include path in env) - we normalize and also extract hostname
const BACKEND_ORIGIN_RAW = process.env.NEXT_PUBLIC_BACKEND_URL ?? "https://positive-theta.onrender.com";
// Frontend origin (used for final redirect checks)
const SITE_ORIGIN = process.env.NEXT_PUBLIC_SITE_ORIGIN ?? (typeof window !== "undefined" ? window.location.origin : "https://positive-theta.vercel.app");

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON);

function normalizeOrigin(raw: string) {
  try {
    return new URL(raw).origin;
  } catch {
    if (!/^https?:\/\//.test(raw)) return "https://" + raw;
    return raw;
  }
}
function extractHost(raw: string) {
  try {
    return new URL(raw).hostname;
  } catch {
    return raw.replace(/^https?:\/\//, "").split("/")[0] || raw;
  }
}

export default function RegisterPage(): React.ReactElement {
  const router = useRouter();
  const BACKEND_ORIGIN = normalizeOrigin(BACKEND_ORIGIN_RAW);
  const BACKEND_HOST = extractHost(BACKEND_ORIGIN_RAW);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [about, setAbout] = useState("");

  const [isAdult, setIsAdult] = useState(false);
  const [consent, setConsent] = useState(true);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  // OAuth UI state
  const [waitingForAuth, setWaitingForAuth] = useState(false);
  const [checkingSession, setCheckingSession] = useState(false);

  const sessionIntervalRef = useRef<number | null>(null);
  const sessionAttemptsRef = useRef(0);

  // Initial session check — redirect immediately to front page if session present
  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const { data } = await supabase.auth.getSession();
        if (!mounted) return;
        if ((data as any)?.session) {
          router.replace("/");
        }
      } catch (e) {
        console.debug("initial session check failed", e);
      }
    })();
    return () => {
      mounted = false;
    };
  }, [router]);

  // handle incoming postMessage from backend popup (action_link)
  useEffect(() => {
    function onMessage(e: MessageEvent) {
      try {
        if (!e || !e.origin) return;
        // robust hostname check (to tolerate env with path)
        let msgHost = "";
        try {
          msgHost = new URL(String(e.origin)).hostname;
        } catch {
          msgHost = extractHost(String(e.origin));
        }
        if (!msgHost) return;
        if (msgHost !== BACKEND_HOST && !String(e.origin).endsWith(BACKEND_HOST)) {
          console.debug("Ignored message from origin (host mismatch):", e.origin);
          return;
        }

        const payload = e.data;
        console.debug("Received postMessage payload:", payload);
        if (!payload || payload.type !== "social_auth") return;

        const actionLink = payload.action_link;
        if (!actionLink || typeof actionLink !== "string") return;
        if (!/^https?:\/\//i.test(actionLink)) {
          console.warn("Invalid action_link:", actionLink);
          return;
        }

        // best-effort close popup if we have reference
        try {
          const popup = (window as any).__ya_oauth_popup;
          if (popup && !popup.closed) {
            try { popup.close(); } catch {}
          }
        } catch {}

        // navigate main window to action_link (same tab). Supabase will set session then redirect back to your SITE_ORIGIN.
        setWaitingForAuth(false);
        stopSessionPolling();
        console.debug("Navigating to action_link (replace):", actionLink);
        window.location.replace(actionLink);
      } catch (err) {
        console.warn("Error handling postMessage:", err);
      }
    }

    window.addEventListener("message", onMessage, false);
    return () => window.removeEventListener("message", onMessage, false);
  }, [BACKEND_HOST]);

  // Listen for custom event dispatched by SocialLoginButtons when popup closes
  useEffect(() => {
    function onPopupClosed() {
      console.debug("Detected ya_oauth_popup_closed event — start session checks");
      // try immediate session check
      checkSessionNow();
    }

    window.addEventListener("ya_oauth_popup_closed", onPopupClosed);
    return () => window.removeEventListener("ya_oauth_popup_closed", onPopupClosed);
  }, []);

  // Also start session checks when window regains focus (fallback)
  useEffect(() => {
    function onFocus() {
      if (waitingForAuth) {
        console.debug("Window focused while waitingForAuth — starting session checks");
        startSessionPolling();
      }
    }
    function onVisibility() {
      if (document.visibilityState === "visible" && waitingForAuth) {
        console.debug("Visibility changed to visible while waitingForAuth — starting session checks");
        startSessionPolling();
      }
    }
    window.addEventListener("focus", onFocus);
    window.addEventListener("visibilitychange", onVisibility);
    return () => {
      window.removeEventListener("focus", onFocus);
      window.removeEventListener("visibilitychange", onVisibility);
    };
  }, [waitingForAuth]);

  function startSessionPolling() {
    stopSessionPolling();
    sessionAttemptsRef.current = 0;
    setCheckingSession(true);

    sessionIntervalRef.current = window.setInterval(async () => {
      sessionAttemptsRef.current += 1;
      console.debug("session poll attempt", sessionAttemptsRef.current);
      try {
        const { data } = await supabase.auth.getSession();
        if ((data as any)?.session) {
          stopSessionPolling();
          setWaitingForAuth(false);
          setCheckingSession(false);
          // Redirect on frontend root
          router.replace("/");
          return;
        }
      } catch (e) {
        console.debug("session polling getSession error", e);
      }
      if (sessionAttemptsRef.current >= 12) {
        // ~7 seconds give up
        stopSessionPolling();
        setCheckingSession(false);
        console.debug("session polling exhausted");
      }
    }, 600);
  }

  function stopSessionPolling() {
    if (sessionIntervalRef.current) {
      window.clearInterval(sessionIntervalRef.current);
      sessionIntervalRef.current = null;
    }
    sessionAttemptsRef.current = 0;
    setCheckingSession(false);
  }

  // manual session check (button)
  async function checkSessionNow() {
    setCheckingSession(true);
    try {
      const { data } = await supabase.auth.getSession();
      if ((data as any)?.session) {
        router.replace("/");
      } else {
        setWaitingForAuth(true);
        startSessionPolling();
      }
    } catch (e) {
      console.debug("manual session check failed", e);
      setCheckingSession(false);
    }
  }

  // expose helper so SocialLoginButtons can notify us immediately
  useEffect(() => {
    (window as any).__markExternalAuthStarted = () => {
      setWaitingForAuth(true);
      (window as any).__ya_oauth_started = true;
    };
    return () => {
      try { delete (window as any).__markExternalAuthStarted; } catch {}
    };
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
          console.warn("Could not fetch supabase user after signUp:", err);
        }
      }

      // Server-side upsert of profile
      try {
        const payload: any = {
          email,
          full_name: fullName || null,
          about: about || null,
          birthday: null,
          consent_given: !!consent,
          consent_at: new Date().toISOString(),
          is_adult_confirmed: !!isAdult,
        };

        if (supabaseUserId) payload.supabase_uid = supabaseUserId;

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
      router.replace("/");
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
              <input value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="Иван Иванов" aria-label="Полное имя" />
            </label>

            <label className="field">
              <span className="label">
                Email <span className="required" aria-hidden>*</span>
              </span>
              <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" required aria-required="true" aria-label="Email" />
            </label>

            <label className="field">
              <span className="label">
                Пароль <span className="required" aria-hidden>*</span>
              </span>
              <div className="pw-row">
                <input type={showPassword ? "text" : "password"} value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" required aria-required="true" aria-label="Пароль" />
                <button type="button" className="eye-btn" aria-label={showPassword ? "Скрыть пароль" : "Показать пароль"} onClick={() => setShowPassword((s) => !s)}>
                  {showPassword ? "🙈" : "👁️"}
                </button>
              </div>
            </label>

            <label className="field">
              <span className="label">
                Повторите пароль <span className="required" aria-hidden>*</span>
              </span>
              <div className="pw-row">
                <input type={showConfirm ? "text" : "password"} value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} placeholder="Повторите пароль" required aria-required="true" aria-label="Повторите пароль" />
                <button type="button" className="eye-btn" aria-label={showConfirm ? "Скрыть пароль" : "Показать пароль"} onClick={() => setShowConfirm((s) => !s)}>
                  {showConfirm ? "🙈" : "👁️"}
                </button>
              </div>
            </label>

            <label className="consent-row">
              <input type="checkbox" checked={isAdult} onChange={(e) => setIsAdult(e.target.checked)} aria-label="Мне 18 лет или больше" />
              <span>Я подтверждаю, что мне 18 лет или больше</span>
            </label>

            <label className="field">
              <span className="label">О себе</span>
              <textarea value={about} onChange={(e) => setAbout(e.target.value)} maxLength={500} placeholder="Несколько слов о себе (макс. 500 символов)" aria-label="О себе" />
              <div className="hint">{about.length}/500</div>
            </label>

            <label className="consent">
              <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} aria-label="Согласие на обработку персональных данных" />
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

            <div style={{ marginTop: 12, textAlign: "center" }}>
              {waitingForAuth && !checkingSession && (
                <div>
                  <div style={{ marginBottom: 8 }}>Ждём завершения авторизации в окне…</div>
                  <button className="ghost" onClick={checkSessionNow}>
                    Проверить вход
                  </button>
                </div>
              )}
              {checkingSession && <div style={{ marginTop: 8 }}>Проверяем сессию…</div>}
            </div>
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
          box-shadow: 0 10px 30px rgba(10, 20, 40, 0.06);
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
          border: 1px solid rgba(15, 23, 36, 0.06);
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
          border: 1px solid rgba(15, 23, 36, 0.06);
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

        input[type="checkbox"] {
          -webkit-appearance: checkbox;
          -moz-appearance: checkbox;
          appearance: checkbox;
          width: 18px;
          height: 18px;
          margin: 0;
          padding: 0;
          accent-color: #0b66ff;
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
        .ghost {
          background: #fff;
          border: 1px solid rgba(15, 23, 36, 0.06);
          padding: 8px 12px;
          border-radius: 8px;
          cursor: pointer;
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
