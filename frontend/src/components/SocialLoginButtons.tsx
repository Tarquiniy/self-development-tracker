// frontend/src/components/SocialLoginButtons.tsx
"use client";

import React from "react";

/**
 * Social login buttons — Yandex popup opener
 *
 * Notes:
 *  - Do NOT use 'noopener'/'noreferrer' in window.open, otherwise popup.opener === null.
 *  - NEXT_PUBLIC_YANDEX_CLIENT_ID should be set.
 *  - NEXT_PUBLIC_BACKEND_URL should be set (backend redirect_uri).
 */

const YANDEX_CLIENT_ID = process.env.NEXT_PUBLIC_YANDEX_CLIENT_ID ?? "";
const BACKEND_ORIGIN = process.env.NEXT_PUBLIC_BACKEND_URL ?? "https://positive-theta.onrender.com";

function openPopup(url: string, name = "yandex_oauth") {
  const w = 520;
  const h = 680;
  const left = Math.round((window.screen.width - w) / 2);
  const top = Math.round((window.screen.height - h) / 2);
  const features = `width=${w},height=${h},left=${left},top=${top},resizable=yes,scrollbars=yes`;

  let popup: Window | null = null;
  try {
    popup = window.open(url, name, features);
  } catch (e) {
    popup = null;
  }

  // fallback: try to get same-named window (useful if popup already exists)
  if (!popup) {
    try {
      popup = window.open("", name);
    } catch (e) {
      popup = null;
    }
  }

  if (!popup) {
    alert("Не удалось открыть окно авторизации. Отключите блокировщик всплывающих окон и попробуйте снова.");
    return null;
  }

  try { popup.focus(); } catch (e) {}

  // store global popup reference so main window can try to close/read it
  try {
    (window as any).__ya_oauth_popup = popup;
  } catch (e) {}

  // notify main page immediately that external auth started
  try {
    const fn = (window as any).__markExternalAuthStarted;
    if (typeof fn === "function") fn();
  } catch (e) {}

  return popup;
}

export default function SocialLoginButtons(): React.ReactElement {
  function loginWithYandex() {
    if (!YANDEX_CLIENT_ID) {
      alert("NEXT_PUBLIC_YANDEX_CLIENT_ID не задан.");
      return;
    }
    const redirectUri = `${BACKEND_ORIGIN.replace(/\/$/, "")}/api/auth/yandex/callback`;
    const params = new URLSearchParams({
      response_type: "code",
      client_id: YANDEX_CLIENT_ID,
      redirect_uri: redirectUri,
      scope: "login:email",
    });
    const authUrl = `https://oauth.yandex.com/authorize?${params.toString()}`;
    openPopup(authUrl, "yandex_oauth");
  }

  return (
    <div className="socialRow">
      <button onClick={loginWithYandex} className="yandex-btn" aria-label="Войти через Яндекс">
        <span className="icon">Я</span>
        <span>Войти через Яндекс</span>
      <style jsx>{`
        .yandex-btn { display:flex; gap:10px; align-items:center; padding:10px 14px; border-radius:10px; border:none; cursor:pointer; background:#ffcc00; color:#000; font-weight:700; font-size:14px; }
        .yandex-btn:hover { background:#ffdb4d; }
        .icon { width:24px; height:24px; border-radius:50%; background:#000; color:#ffcc00; display:flex; align-items:center; justify-content:center; font-weight:900; font-size:14px; }
      `}</style>
      </button>
    </div>
  );
}
