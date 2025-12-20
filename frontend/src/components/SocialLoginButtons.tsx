// frontend/src/components/SocialLoginButtons.tsx
"use client";

import React from "react";

/**
 * Robust SocialLoginButtons for Yandex OAuth.
 * - Tries window.open(url, name, features) and if that returns null uses window.open('', name)
 *   to obtain reference to an already-open window with the same name.
 * - Immediately stores reference to window.__ya_oauth_popup and starts the popup monitor.
 * - Does NOT use 'noopener'/'noreferrer' so popup.opener stays available.
 *
 * ENV required:
 * NEXT_PUBLIC_YANDEX_CLIENT_ID
 * NEXT_PUBLIC_BACKEND_URL
 * (optional) NEXT_PUBLIC_SITE_ORIGIN
 */

const YANDEX_CLIENT_ID = process.env.NEXT_PUBLIC_YANDEX_CLIENT_ID ?? "";
const BACKEND_ORIGIN = process.env.NEXT_PUBLIC_BACKEND_URL ?? "https://positive-theta.onrender.com";
const SITE_ORIGIN =
  (typeof window !== "undefined" && (process.env.NEXT_PUBLIC_SITE_ORIGIN ?? window.location.origin)) ||
  (process.env.NEXT_PUBLIC_SITE_ORIGIN ?? "https://positive-theta.vercel.app");

function startPopupMonitor(popup: Window | null, pollMs = 300) {
  try {
    // stop previous monitor if any
    const prev = (window as any).__ya_oauth_popup_monitor_id;
    if (prev) {
      try { window.clearInterval(prev); } catch {}
      (window as any).__ya_oauth_popup_monitor_id = null;
    }
  } catch {}

  if (!popup) return;

  try {
    (window as any).__ya_oauth_popup = popup;
  } catch {}

  const monitorId = window.setInterval(() => {
    try {
      const p = (window as any).__ya_oauth_popup || popup;
      if (!p) {
        try { window.clearInterval(monitorId); } catch {}
        return;
      }

      // if popup closed by user
      try {
        if (p.closed) {
          try { window.clearInterval(monitorId); } catch {}
          try { delete (window as any).__ya_oauth_popup; } catch {}
          try { window.dispatchEvent(new Event("ya_oauth_popup_closed")); } catch {}
          return;
        }
      } catch (e) {
        // reading .closed can throw cross-origin until same-origin
      }

      // try reading href — works only when popup becomes same-origin
      try {
        const href = p.location && p.location.href;
        if (typeof href === "string" && href.length > 0) {
          try {
            const parsed = new URL(href);
            const hrefOrigin = parsed.origin;
            const frontendOrigin = SITE_ORIGIN;
            const hostMatches = hrefOrigin === frontendOrigin || hrefOrigin === window.location.origin;
            const hasHash = !!parsed.hash;
            if (hostMatches || hasHash) {
              try { if (!p.closed) p.close(); } catch {}
              try { window.clearInterval(monitorId); } catch {}
              try { delete (window as any).__ya_oauth_popup; } catch {}
              try { window.dispatchEvent(new Event("ya_oauth_popup_closed")); } catch {}
              return;
            }
          } catch (parseErr) {
            // ignore parse errors
          }
        }
      } catch (crossErr) {
        // still cross-origin — wait
      }
    } catch (outer) {
      console.debug("popup monitor error", outer);
    }
  }, pollMs);

  try {
    (window as any).__ya_oauth_popup_monitor_id = monitorId;
  } catch {}
}

function openPopup(url: string, name = "yandex_oauth") {
  const w = 520;
  const h = 680;
  const left = Math.round((window.screen.width - w) / 2);
  const top = Math.round((window.screen.height - h) / 2);
  const features = `width=${w},height=${h},left=${left},top=${top},resizable=yes,scrollbars=yes`;

  // Try to open popup normally
  let popup: Window | null = null;
  try {
    popup = window.open(url, name, features);
  } catch (e) {
    popup = null;
  }

  // If popup was blocked or returned null, try to obtain by name (maybe opened earlier)
  if (!popup) {
    try {
      // This returns a reference to existing window with same name, or opens a blank one (which may be blocked)
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

  // Persist global reference and start monitor
  try {
    (window as any).__ya_oauth_popup = popup;
  } catch (e) {}

  try {
    startPopupMonitor(popup, 300);
  } catch (e) {
    console.debug("Failed to start popup monitor:", e);
  }

  // Notify any UI that auth started
  try {
    if (typeof (window as any).__markExternalAuthStarted === "function") {
      (window as any).__markExternalAuthStarted();
    }
  } catch {}

  return popup;
}

export default function SocialLoginButtons(): React.ReactElement {
  function loginWithYandex() {
    if (!YANDEX_CLIENT_ID) {
      alert("YANDEX_CLIENT_ID не задан (NEXT_PUBLIC_YANDEX_CLIENT_ID).");
      return;
    }

    const redirectUri = `${BACKEND_ORIGIN}/api/auth/yandex/callback`;
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
