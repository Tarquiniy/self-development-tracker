// frontend/src/app/auth/success/page.tsx
"use client";

import React, { useEffect } from "react";

export default function AuthSuccessPage(): React.ReactElement {
  useEffect(() => {
    const payload = { type: "social_auth_done", ts: Date.now() };

    // 1) try postMessage to opener (best-effort)
    try {
      if (window.opener && !window.opener.closed) {
        try {
          // prefer same-origin target
          window.opener.postMessage(payload, window.location.origin);
        } catch (e) {
          try {
            window.opener.postMessage(payload, "*");
          } catch (e2) {
            // ignore
          }
        }
      }
    } catch (e) {
      // ignore
    }

    // 2) BroadcastChannel (modern, same-origin)
    try {
      // @ts-ignore
      const bc = new BroadcastChannel("auth_channel");
      try {
        bc.postMessage(payload);
      } catch (e) {
        // ignore
      }
      // close channel after short delay
      setTimeout(() => {
        try { bc.close(); } catch {}
      }, 500);
    } catch (e) {
      // BroadcastChannel not available -> ignore
    }

    // 3) localStorage fallback (same-origin)
    try {
      // set a unique value so storage event fires in other windows
      localStorage.setItem("social_auth_success", String(Date.now()));
      // remove after a short while to avoid leaving data
      setTimeout(() => {
        try { localStorage.removeItem("social_auth_success"); } catch {}
      }, 2000);
    } catch (e) {
      // ignore
    }

    // Attempt to close the popup after a short delay (best-effort)
    setTimeout(() => {
      try { window.close(); } catch (e) { /* some browsers block this */ }
    }, 700);
  }, []);

  return (
    <>
      <main style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 24,
        background: "#f8fafc"
      }}>
        <div style={{
          background: "#fff",
          padding: "28px 32px",
          borderRadius: 12,
          boxShadow: "0 8px 24px rgba(2,6,23,0.08)",
          maxWidth: 640,
          textAlign: "center"
        }}>
          <h1 style={{ margin: 0, fontSize: 20, color: "#0f1724" }}>Вход выполнен успешно ✅</h1>
          <p style={{ marginTop: 12, color: "#334155", fontSize: 15 }}>
            Вход успешно выполнен. Основное окно должно обновиться и показать ваш аккаунт.
          </p>
          <p style={{ marginTop: 8, color: "#475569", fontSize: 13 }}>
            Если основное окно не обновилось автоматически — закройте это окно и обновите основную страницу.
          </p>
          <div style={{ marginTop: 16 }}>
            <button
              onClick={() => { try { window.close(); } catch {} }}
              style={{
                padding: "10px 14px",
                borderRadius: 10,
                border: "none",
                cursor: "pointer",
                background: "#0b66ff",
                color: "#fff",
                fontWeight: 700
              }}
            >
              Закрыть окно
            </button>
          </div>
        </div>
      </main>
    </>
  );
}
