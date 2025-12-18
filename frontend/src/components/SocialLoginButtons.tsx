"use client";

import React from "react";

/**
 * Social login buttons — Yandex popup opener
 *
 * Важно:
 *  - НЕ использовать 'noopener' или 'noreferrer' в window.open, иначе popup.opener === null.
 *  - Передать корректный client_id в NEXT_PUBLIC_YANDEX_CLIENT_ID.
 *
 * ENV:
 *  NEXT_PUBLIC_YANDEX_CLIENT_ID
 *  NEXT_PUBLIC_BACKEND_URL (not required here but used in other places)
 */

const YANDEX_CLIENT_ID = process.env.NEXT_PUBLIC_YANDEX_CLIENT_ID ?? "";
const REDIRECT_URI = "https://positive-theta.onrender.com/api/auth/yandex/callback"; // backend callback

export default function SocialLoginButtons(): React.ReactElement {
  function openPopup(url: string, name = "yandex_oauth") {
    const w = 520;
    const h = 640;
    const left = Math.round((window.screen.width - w) / 2);
    const top = Math.round((window.screen.height - h) / 2);

    // *** ВАЖНО: не включаем 'noopener'/'noreferrer' ***
    // иначе у popup будет window.opener === null и postMessage не дойдёт.
    const features = `width=${w},height=${h},left=${left},top=${top},resizable=yes,scrollbars=yes`;
    const popup = window.open(url, name, features);

    if (!popup) {
      alert("Не удалось открыть окно авторизации. Отключите блокировщик всплывающих окон.");
      return null;
    }

    // focus popup if possible
    try {
      popup.focus();
    } catch (_) {}

    // --- NEW: expose popup reference and started flag to the main window ---
    try {
      (window as any).__ya_oauth_popup = popup;
      (window as any).__ya_oauth_started = true;
      // Optional hook: call page-provided callback to show waiting UI
      try {
        if (typeof (window as any).__markExternalAuthStarted === "function") {
          (window as any).__markExternalAuthStarted();
        }
      } catch (_) {}

      // Start monitoring popup closed state (main window context)
      const watchInterval = window.setInterval(() => {
        try {
          const p = (window as any).__ya_oauth_popup;
          if (!p) {
            // nothing to watch
            window.clearInterval(watchInterval);
            return;
          }
          if (p.closed) {
            // popup closed -> cleanup and notify
            try {
              delete (window as any).__ya_oauth_popup;
            } catch (_) {}
            try {
              (window as any).__ya_oauth_closed = true;
            } catch (_) {}
            try {
              (window as any).__ya_oauth_started = false;
            } catch (_) {}
            // Dispatch a custom event so pages can listen to it
            try {
              window.dispatchEvent(new CustomEvent("ya_oauth_popup_closed"));
            } catch (_) {}
            window.clearInterval(watchInterval);
          }
        } catch (err) {
          // ignore transient errors
          try {
            window.clearInterval(watchInterval);
          } catch (_) {}
        }
      }, 500);
    } catch (err) {
      // ignore if globals can't be set
      console.debug("Could not set oauth globals for popup:", err);
    }

    return popup;
  }

  function loginWithYandex() {
    if (!YANDEX_CLIENT_ID) {
      alert("YANDEX_CLIENT_ID не задан (NEXT_PUBLIC_YANDEX_CLIENT_ID).");
      return;
    }

    const params = new URLSearchParams({
      response_type: "code",
      client_id: YANDEX_CLIENT_ID,
      redirect_uri: REDIRECT_URI,
      scope: "login:email", // обязателен для получения email
      // state можно добавить по желанию
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
        .yandex-btn {
          display:flex; gap:10px; align-items:center;
          padding:10px 14px; border-radius:10px; border:none; cursor:pointer;
          background:#ffcc00; color:#000; font-weight:700; font-size:14px;
        }
        .yandex-btn:hover { background:#ffdb4d; }
        .icon { width:24px; height:24px; border-radius:50%; background:#000; color:#ffcc00; display:flex; align-items:center; justify-content:center; font-weight:900; font-size:14px; }
      `}</style>
      </button>
    </div>
  );
}
