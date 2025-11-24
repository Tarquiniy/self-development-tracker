// frontend/src/components/Dashboard.tsx
"use client";

import React, { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import Link from "next/link";
import { JSX } from "react/jsx-runtime";

type TableRow = {
  id: string;
  title?: string | null;
  owner?: string | null;
  created_at?: string | null;
};

export default function Dashboard(): JSX.Element {
  const [loading, setLoading] = useState<boolean>(true);
  const [tables, setTables] = useState<TableRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [sessionId, setSessionId] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;

    async function load() {
      setLoading(true);
      setError(null);

      try {
        // Получаем сессию в браузере
        const sessRes = await supabase.auth.getSession();
        const session = (sessRes as any)?.data?.session ?? (sessRes as any)?.session ?? null;

        if (!session || !session.user) {
          setError("Вы не авторизованы. Пожалуйста, войдите.");
          setTables([]);
          setLoading(false);
          return;
        }

        setSessionId(session.user.id ?? null);

        const accessToken =
          (session as any)?.access_token ??
          (session as any)?.accessToken ??
          (session as any)?.provider_token ??
          (session as any)?.refresh_token ?? null;

        // Попробуем получить токен из session.data (supabase v2)
        const token = (session as any)?.access_token ?? (session as any)?.accessToken ?? null;

        // Вызываем наш защищенный серверный роут с Bearer токеном
        const res = await fetch("/api/user/tables", {
          headers: {
            Authorization: `Bearer ${token ?? ""}`,
            "Content-Type": "application/json",
          },
        });

        if (!res.ok) {
          const body = await res.json().catch(() => null);
          const msg = body?.error ? `${body.error}${body?.detail ? `: ${body.detail}` : ""}` : `HTTP ${res.status}`;
          setError(`Не удалось загрузить таблицы: ${msg}`);
          setTables([]);
          setLoading(false);
          return;
        }

        const json = await res.json();
        setTables(json.data ?? []);
      } catch (e: any) {
        console.error("Dashboard load error:", e);
        setError(String(e?.message ?? e));
        setTables([]);
      } finally {
        if (mounted) setLoading(false);
      }
    }

    load();

    // Подписка на изменение сессии — обновляем данные при изменении авторизации
    const sub = supabase.auth.onAuthStateChange((_event, _session) => {
      console.debug("Auth change", _event);
      load();
    });

    return () => {
      mounted = false;
      try {
        // отписка: обработать разные форматы SDK
        const unsub =
          (sub as any)?.data?.subscription ?? (sub as any)?.subscription ?? sub;
        if (!unsub) return;
        if (typeof unsub === "function") unsub();
        else if (typeof unsub.unsubscribe === "function") unsub.unsubscribe();
      } catch {
        // ignore
      }
    };
  }, []);

  return (
    <section style={{ padding: 16 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 18 }}>
        <div>
          <h1 style={{ margin: 0 }}>Дашборд</h1>
          <div style={{ fontSize: 13, color: "#666", marginTop: 6 }}>{sessionId ? `ID: ${sessionId}` : "Гость"}</div>
        </div>

        <div style={{ display: "flex", gap: 8 }}>
          <Link href="/tables/new"><button style={{ padding: "8px 12px", borderRadius: 8 }}>Создать таблицу</button></Link>
          <Link href="/profile"><button style={{ padding: "8px 12px", borderRadius: 8 }}>Профиль</button></Link>
        </div>
      </div>

      {loading && <div>Загрузка...</div>}
      {error && (
        <div style={{ padding: 12, background: "#fff0f0", color: "#900", borderRadius: 8 }}>{error}</div>
      )}

      {!loading && !error && (
        <>
          {tables && tables.length > 0 ? (
            <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "grid", gap: 12 }}>
              {tables.map((t) => (
                <li key={t.id} style={{ padding: 14, border: "1px solid #eee", borderRadius: 10 }}>
                  <Link href={`/tables/${t.id}`}><a style={{ fontWeight: 700, fontSize: 16, textDecoration: "none" }}>{t.title ?? "Моя таблица"}</a></Link>
                  <div style={{ fontSize: 12, color: "#666" }}>{t.created_at ? new Date(t.created_at).toLocaleString() : ""}</div>
                </li>
              ))}
            </ul>
          ) : (
            <div style={{ padding: 12, borderRadius: 8, background: "#f6f7fb" }}>
              У вас пока нет таблиц. Нажмите «Создать таблицу», чтобы начать.
            </div>
          )}
        </>
      )}
    </section>
  );
}
