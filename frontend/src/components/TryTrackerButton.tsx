// frontend/src/components/TryTrackerButton.tsx
"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";

/**
 * TryTrackerButton
 * - если есть сессия Supabase -> /tables
 * - иначе -> /register
 */
export default function TryTrackerButton(): React.ReactElement {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function onClick(e?: React.MouseEvent) {
    if (busy) return;
    setBusy(true);

    try {
      // Supabase v2: getSession()
      const sess = await supabase.auth.getSession();
      const session = (sess as any)?.data?.session ?? null;

      if (session) {
        // пользователь авторизован — перейти к списку таблиц
        // используем replace чтобы не захламлять историю
        router.replace("/tables");
      } else {
        // не авторизован — на страницу регистрации
        router.replace("/register");
      }
    } catch (err) {
      // на случай ошибки — перенаправляем на страницу регистрации
      console.warn("TryTrackerButton: ошибка проверки сессии", err);
      try {
        router.replace("/register");
      } catch {}
    } finally {
      setBusy(false);
    }
  }

  return (
    <button
      onClick={onClick}
      disabled={busy}
      aria-label="Попробовать трекер"
      style={{
        padding: "10px 14px",
        borderRadius: 10,
        border: "none",
        background: "#0b1720",
        color: "#fff",
        fontWeight: 800,
        cursor: busy ? "default" : "pointer",
        display: "inline-flex",
        gap: 8,
        alignItems: "center",
      }}
    >
      {busy ? (
        <>
          <span style={{ display: "inline-block", width: 14, height: 14 }}>
            {/* tiny spinner (CSS) */}
            <svg viewBox="0 0 50 50" style={{ width: 14, height: 14 }}>
              <circle cx="25" cy="25" r="20" fill="none" stroke="white" strokeWidth="5" strokeOpacity="0.2" />
              <path d="M45 25a20 20 0 0 1-20 20" stroke="white" strokeWidth="5" strokeLinecap="round" fill="none" />
            </svg>
          </span>
          <span>Переход…</span>
        </>
      ) : (
        <>Попробовать трекер</>
      )}
    </button>
  );
}
