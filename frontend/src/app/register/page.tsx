// frontend/src/app/register/page.tsx
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
// Frontend origin (used for final redirect checks). If not provided, use current origin.
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

const BACKEND_ORIGIN = normalizeOrigin(BACKEND_ORIGIN_RAW);
const BACKEND_HOST = extractHost(BACKEND_ORIGIN_RAW);
const LOCAL_KEY = "social_auth_success_tokens"; // backup storage key

export default function RegisterPage(): React.ReactElement {
  const router = useRouter();

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

  // Prevent double-handling
  const handledRef = useRef(false);

  // --- Core: apply tokens reliably ---
  async function applySocialTokens(access_token: string, refresh_token: string) {
    if (handledRef.current) return;
    handledRef.current = true;
    console.debug("applySocialTokens start");

    try {
      const setRes = await supabase.auth.setSession({ access_token, refresh_token });
      console.debug("supabase.setSession result:", setRes);
      if ((setRes as any)?.error) {
        console.warn("setSession returned error, falling back to localStorage+reload", (setRes as any).error);
        try {
          localStorage.setItem(LOCAL_KEY, JSON.stringify({ type: "social_auth_session", access_token, refresh_token }));
        } catch (e) {
          console.warn("Could not write tokens to localStorage", e);
        }
        try {
          const bc = new BroadcastChannel("auth_channel");
          bc.postMessage({ type: "social_auth_session", access_token, refresh_token });
          bc.close();
        } catch (e) {}
        // Hard reload so other Supabase client instances pick up the stored token
        window.location.replace("/");
        return;
      }

      // verify session
      try {
        const { data } = await supabase.auth.getSession();
        if ((data as any)?.session) {
          try { localStorage.removeItem(LOCAL_KEY); } catch {}
          router.replace("/");
          return;
        } else {
          // fallback
          console.warn("setSession did not produce session object - reload fallback");
          try { localStorage.setItem(LOCAL_KEY, JSON.stringify({ type: "social_auth_session", access_token, refresh_token })); } catch {}
          window.location.replace("/");
          return;
        }
      } catch (e) {
        console.warn("getSession failed after setSession - reload fallback", e);
        try { localStorage.setItem(LOCAL_KEY, JSON.stringify({ type: "social_auth_session", access_token, refresh_token })); } catch {}
        window.location.replace("/");
      }
    } catch (err) {
      console.error("applySocialTokens unexpected error", err);
      try { localStorage.setItem(LOCAL_KEY, JSON.stringify({ type: "social_auth_session", access_token, refresh_token })); } catch {}
      window.location.replace("/");
    }
  }

  // --- Try to apply backup tokens or check session. Retries limited to 2 attempts (300ms, 1000ms) ---
  async function attemptApplyBackupAndSession(attempt = 0) {
    if (handledRef.current) return;
    console.debug("attemptApplyBackupAndSession attempt", attempt);
    // 1) try backup tokens from localStorage
    try {
      const raw = localStorage.getItem(LOCAL_KEY);
      if (raw) {
        try {
          const parsed = JSON.parse(raw);
          if (parsed?.type === "social_auth_session" && parsed.access_token && parsed.refresh_token) {
            console.debug("Found backup tokens, applying");
            await applySocialTokens(String(parsed.access_token), String(parsed.refresh_token));
            return;
          }
        } catch (e) {
          console.debug("failed parsing backup tokens", e);
        }
      }
    } catch (e) {
      console.debug("error reading localStorage", e);
    }

    // 2) try getSession directly
    try {
      const { data } = await supabase.auth.getSession();
      if ((data as any)?.session) {
        handledRef.current = true;
        router.replace("/");
        return;
      }
    } catch (e) {
      console.debug("getSession attempt failed", e);
    }

    // 3) limited retries (not continuous polling)
    if (attempt < 2 && !handledRef.current) {
      const delay = attempt === 0 ? 300 : 1000;
      setTimeout(() => attemptApplyBackupAndSession(attempt + 1), delay);
    }
  }

  // --- On mount: attempt to apply backup tokens immediately (in case popup wrote them) ---
  useEffect(() => {
    attemptApplyBackupAndSession(0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // --- Message listener: primary channel from popup callback ---
  useEffect(() => {
    function onMessage(e: MessageEvent) {
      try {
        if (!e || !e.origin) return;

        // Accept messages from site or backend origin
        const allowedOrigins = [SITE_ORIGIN, window.location.origin, BACKEND_ORIGIN];
        let originAllowed = allowedOrigins.includes(e.origin);
        if (!originAllowed) {
          // tolerate host suffix match to support envs with path differences
          try {
            const msgHost = new URL(String(e.origin)).hostname;
            if (msgHost && msgHost.endsWith(BACKEND_HOST)) originAllowed = true;
          } catch {}
        }
        if (!originAllowed) {
          console.debug("Ignored message from origin:", e.origin);
          return;
        }

        const payload = e.data;
        if (!payload || typeof payload !== "object") return;

        if (payload.type === "social_auth_session" && payload.access_token && payload.refresh_token) {
          console.debug("Received social_auth_session via postMessage -> applying tokens");
          setWaitingForAuth(false);
          applySocialTokens(String(payload.access_token), String(payload.refresh_token));
          return;
        }

        if (payload.type === "social_auth_done") {
          console.debug("Received social_auth_done -> trying backup/session automatically");
          setWaitingForAuth(false);
          attemptApplyBackupAndSession(0);
          return;
        }

        if (payload.type === "social_auth_action" && payload.action_link) {
          // old-style action_link flow: navigate same-tab
          setWaitingForAuth(false);
          try { window.location.replace(String(payload.action_link)); } catch {}
          return;
        }
      } catch (err) {
        console.warn("Error handling postMessage", err);
      }
    }
    window.addEventListener("message", onMessage, false);
    return () => window.removeEventListener("message", onMessage, false);
  }, [router]);

  // BroadcastChannel - redundant robust channel
  useEffect(() => {
    let bc: BroadcastChannel | null = null;
    try {
      bc = new BroadcastChannel("auth_channel");
      bc.onmessage = (ev) => {
        try {
          const payload = ev.data;
          if (payload?.type === "social_auth_session" && payload.access_token && payload.refresh_token) {
            console.debug("BroadcastChannel received tokens -> applying");
            applySocialTokens(String(payload.access_token), String(payload.refresh_token));
          }
        } catch (e) { console.debug(e); }
      };
    } catch (e) { bc = null; }
    return () => { try { if (bc) bc.close(); } catch {} };
  }, []);

  // storage event fallback
  useEffect(() => {
    function onStorage(e: StorageEvent) {
      try {
        if (!e) return;
        if (e.key !== LOCAL_KEY) return;
        if (!e.newValue) return;
        const payload = JSON.parse(e.newValue);
        if (payload?.type === "social_auth_session" && payload.access_token && payload.refresh_token) {
          console.debug("storage event: got social tokens -> applying");
          applySocialTokens(String(payload.access_token), String(payload.refresh_token));
        }
      } catch (err) { console.debug("storage handler error", err); }
    }
    window.addEventListener("storage", onStorage, false);
    return () => window.removeEventListener("storage", onStorage, false);
  }, []);

  // When window regains focus or becomes visible -> attempt automatic apply (this makes the flow automatic)
  useEffect(() => {
    function onFocus() {
      if (handledRef.current) return;
      console.debug("window focus -> attemptApplyBackupAndSession");
      attemptApplyBackupAndSession(0);
    }
    function onVisibility() {
      if (document.visibilityState === "visible" && !handledRef.current) {
        console.debug("visibility visible -> attemptApplyBackupAndSession");
        attemptApplyBackupAndSession(0);
      }
    }
    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, []);

  // helper: expose marker called by SocialLoginButtons when popup opened
  useEffect(() => {
    (window as any).__markExternalAuthStarted = () => {
      console.debug("__markExternalAuthStarted called");
      setWaitingForAuth(true);
    };
    return () => {
      try { delete (window as any).__markExternalAuthStarted; } catch {}
    };
  }, []);

  // --- Registration submit (unchanged business logic) ---
  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setInfo(null);

    if (!email) { setError("Введите email."); return; }
    if (!password) { setError("Введите пароль."); return; }
    if (password !== confirmPassword) { setError("Пароли не совпадают."); return; }
    if (!isAdult) { setError("Подтвердите, что вам 18 лет или больше."); return; }
    if (!consent) { setError("Необходимо согласие на обработку персональных данных."); return; }

    setLoading(true);
    try {
      const { data: signData, error: signErr } = await supabase.auth.signUp({ email, password } as any);
      if (signErr) { setError(signErr.message || "Ошибка регистрации"); setLoading(false); return; }

      let supabaseUserId: string | null = (signData as any)?.user?.id ?? null;
      if (!supabaseUserId) {
        try {
          const { data: getUserData } = await supabase.auth.getUser();
          if ((getUserData as any)?.user?.id) supabaseUserId = (getUserData as any).user.id;
        } catch {}
      }

      try {
        const payload: any = {
          email, full_name: fullName || null, about: about || null, birthday: null,
          consent_given: !!consent, consent_at: new Date().toISOString(), is_adult_confirmed: !!isAdult
        };
        if (supabaseUserId) payload.supabase_uid = supabaseUserId;
        const res = await fetch("/api/profiles", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
        const j = await res.json().catch(() => null);
        if (!res.ok) {
          const needsConfirm = !!((signData as any)?.user?.confirmation_sent_at || (signData as any)?.user?.email_confirmed_at === null);
          setInfo(needsConfirm ? "Регистрация завершена. На e-mail отправлено письмо подтверждения." : "Регистрация прошла. Профиль не создан автоматически (сервер вернул ошибку).");
        } else {
          setInfo("Регистрация успешно завершена. Профиль создан.");
        }
      } catch (upsertErr) {
        console.warn("Profile upsert request error", upsertErr);
        setInfo("Регистрация прошла. Попытка сохранить профиль на сервере не удалась.");
      }

      router.replace("/");
    } catch (err: any) {
      console.error("register error", err);
      setError(String(err?.message ?? err));
    } finally {
      setLoading(false);
    }
  }

  // Manual "Проверить вход" handler (kept as fallback)
  async function handleManualCheck() {
    setCheckingSession(true);
    try {
      const { data } = await supabase.auth.getSession();
      if ((data as any)?.session) {
        router.replace("/");
        return;
      }
      // try backup tokens
      try {
        const raw = localStorage.getItem(LOCAL_KEY);
        if (raw) {
          const parsed = JSON.parse(raw);
          if (parsed?.type === "social_auth_session" && parsed.access_token && parsed.refresh_token) {
            await applySocialTokens(String(parsed.access_token), String(parsed.refresh_token));
            return;
          }
        }
      } catch (err) {
        console.debug("manual read backup tokens failed", err);
      }
      setInfo("Сессия не найдена — попробуйте открыть окно входа ещё раз.");
    } catch (err) {
      console.debug("manual session check error", err);
      setInfo("Ошибка при проверке сессии.");
    } finally {
      setCheckingSession(false);
    }
  }

  // --- UI ---
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
              <span className="label">Email <span className="required" aria-hidden>*</span></span>
              <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" required aria-required="true" aria-label="Email" />
            </label>

            <label className="field">
              <span className="label">Пароль <span className="required" aria-hidden>*</span></span>
              <div className="pw-row">
                <input type={showPassword ? "text" : "password"} value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" required aria-required="true" aria-label="Пароль" />
                <button type="button" className="eye-btn" aria-label={showPassword ? "Скрыть пароль" : "Показать пароль"} onClick={() => setShowPassword((s) => !s)}>
                  {showPassword ? "🙈" : "👁️"}
                </button>
              </div>
            </label>

            <label className="field">
              <span className="label">Повторите пароль <span className="required" aria-hidden>*</span></span>
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
                  <button className="ghost" onClick={handleManualCheck}>
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
