// frontend/src/components/CreateTableForm.tsx
"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { JSX } from "react/jsx-runtime";

export default function CreateTableForm(): JSX.Element {
  const [title, setTitle] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const name = title.trim();
    if (!name) {
      setError("Введите название таблицы.");
      return;
    }

    setLoading(true);

    try {
      // получаем текущего пользователя (если авторизован)
      const userRes = await supabase.auth.getUser();
      const userId = userRes?.data?.user?.id ?? null;

      const res = await fetch("/api/tables", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: name, owner: userId }),
      });

      const j = await res.json();
      if (!res.ok) {
        setError(j?.detail ?? j?.error ?? "Ошибка создания таблицы");
        setLoading(false);
        return;
      }

      const created = j?.data;
      if (created?.id) {
        router.push(`/tables/${created.id}`);
      } else {
        router.push("/tables");
      }
    } catch (e: any) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={onSubmit} style={{ maxWidth: 720 }}>
      <label style={{ display: "block", marginBottom: 10 }}>
        <div style={{ fontWeight: 700, marginBottom: 6 }}>Название таблицы</div>
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Например: Водный баланс"
          style={{
            width: "100%",
            padding: "10px 12px",
            borderRadius: 10,
            border: "1px solid #e5e7eb",
            boxSizing: "border-box",
          }}
          required
        />
      </label>

      <div style={{ display: "flex", gap: 10 }}>
        <button
          type="submit"
          disabled={loading}
          style={{
            padding: "10px 14px",
            borderRadius: 10,
            border: "none",
            background: "#0f1724",
            color: "#fff",
            fontWeight: 700,
            cursor: "pointer",
          }}
        >
          {loading ? "Создаём..." : "Создать таблицу"}
        </button>

        <button
          type="button"
          onClick={() => (window.location.href = "/")}
          style={{
            padding: "10px 14px",
            borderRadius: 10,
            border: "1px solid #e5e7eb",
            background: "#fff",
            color: "#0f1724",
            cursor: "pointer",
          }}
        >
          Отмена
        </button>
      </div>

      {error && <div style={{ color: "crimson", marginTop: 12 }}>{error}</div>}
    </form>
  );
}
