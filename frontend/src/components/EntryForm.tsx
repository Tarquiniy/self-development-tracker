// frontend/src/components/EntryForm.tsx
"use client";

import React, { useState } from "react";
import supabase from "@/lib/supabaseClient";

type ValueRow = { column_id: string; value_number?: number | null; value_text?: string | null };

export default function EntryForm({ tableId, onDone }: { tableId: string; onDone?: (r: any) => void }) {
  const [text, setText] = useState("");
  const [num, setNum] = useState<number | "">("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      // resolve user id from supabase client
      const userRes = await supabase.auth.getUser();
      const user = (userRes as any)?.data?.user ?? null;
      const userId = user?.id ?? null;

      const values: ValueRow[] = [
        { column_id: "text", value_text: text || null },
        { column_id: "num", value_number: num === "" ? null : Number(num) },
      ];

      const resp = await fetch(`/api/tables/${encodeURIComponent(tableId)}/entries`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          user_id: userId, // UUID or null
          values,
        }),
      });

      const body = await resp.json();
      if (!resp.ok) {
        setError(body?.error ?? "Server error");
      } else {
        setText("");
        setNum("");
        onDone?.(body);
      }
    } catch (err: any) {
      setError(String(err?.message ?? err));
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} style={{ maxWidth: 640 }}>
      <div style={{ marginBottom: 8 }}>
        <label>Текст</label>
        <input value={text} onChange={(e) => setText(e.target.value)} style={{ width: "100%", padding: 8 }} />
      </div>

      <div style={{ marginBottom: 8 }}>
        <label>Число</label>
        <input
          value={num}
          onChange={(e) => setNum(e.target.value === "" ? "" : Number(e.target.value))}
          type="number"
          style={{ width: 200, padding: 8 }}
        />
      </div>

      {error && <div style={{ color: "crimson", marginBottom: 8 }}>{error}</div>}

      <button type="submit" disabled={loading} style={{ padding: "10px 14px" }}>
        {loading ? "Сохраняю..." : "Добавить запись"}
      </button>
    </form>
  );
}
