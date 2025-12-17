// frontend/src/components/SocialLoginButtons.tsx
"use client";

import React from "react";

/**
 * SocialLoginButtons
 * - Открывает popup для OAuth авторизации Yandex (Authorization Code Flow).
 * - Redirect URI должен быть настроен на вашем бэкенде:
 *     https://positive-theta.onrender.com/api/auth/yandex/callback
 *
 * Требует в .env:
 * NEXT_PUBLIC_SITE_ORIGIN           - https://positive-theta.vercel.app
 * NEXT_PUBLIC_YANDEX_CLIENT_ID      - клиент id Яндекса (видимый)
 *
 * ВАЖНО: client_secret и обмен code->token происходит на сервере.
 */

function randomState(length = 24) {
  const chars = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  let s = "";
  const arr = crypto.getRandomValues(new Uint32Array(length));
  for (let i = 0; i < length; i++) s += chars[arr[i] % chars.length];
  return s;
}

export default function SocialLoginButtons(): React.ReactElement {
  const SITE_ORIGIN = process.env.NEXT_PUBLIC_SITE_ORIGIN || (typeof window !== "undefined" ? window.location.origin : "");
  const YANDEX_CLIENT_ID = process.env.NEXT_PUBLIC_YANDEX_CLIENT_ID || "";

  function openPopup(url: string, name: string) {
    const w = 600;
    const h = 700;
    const left = Math.round((window.screen.width - w) / 2);
    const top = Math.round((window.screen.height - h) / 2);
    window.open(url, name, `width=${w},height=${h},left=${left},top=${top},resizable=yes,scrollbars=yes`);
  }

  function startYandex() {
    if (!YANDEX_CLIENT_ID) {
      console.error("Yandex client id missing: set NEXT_PUBLIC_YANDEX_CLIENT_ID");
      alert("Yandex login не настроен (отсутствует client id)");
      return;
    }
    const state = randomState();
    // redirect_uri -> backend endpoint which will exchange code for token and then generate action/magic link
    const redirect_uri = encodeURIComponent(`https://positive-theta.onrender.com/api/auth/yandex/callback`);
    const scope = encodeURIComponent("openid login:email");
    const url = `https://oauth.yandex.com/authorize?response_type=code&client_id=${encodeURIComponent(YANDEX_CLIENT_ID)}&redirect_uri=${redirect_uri}&scope=${scope}&state=${state}`;
    openPopup(url, "yandex_auth");
  }

  return (
    <div style={{ display: "flex", gap: 12, justifyContent: "center", marginTop: 12 }}>
      <button
        onClick={startYandex}
        aria-label="Войти через Яндекс"
        style={{
          background: "#fff",
          color: "#000",
          borderRadius: 10,
          padding: "10px 14px",
          fontWeight: 700,
          border: "1px solid #e6e6e6",
          cursor: "pointer",
          display: "flex",
          gap: 8,
          alignItems: "center",
        }}
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
          <path d="M2 2h20v20H2z" fill="none" />
        </svg>
        Войти через Яндекс
      </button>
    </div>
  );
}
