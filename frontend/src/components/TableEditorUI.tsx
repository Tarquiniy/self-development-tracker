// frontend/src/components/TableEditorUI.tsx
"use client";

import React, { useMemo, useState } from "react";
import { JSX } from "react/jsx-runtime";

type Column = { id: string; title: string; type: string };
type Entry = { id: string; created_at?: string; entry_values?: Array<{ column_id: string; value_number?: number | null; value_text?: string | null }> };

export default function TableEditorUI({
  columns,
  onSubmit,
  entries,
}: {
  columns: Column[];
  onSubmit: (values: any[]) => Promise<void>;
  entries: Entry[];
}): JSX.Element {
  const initial = useMemo(
    () =>
      columns.reduce((acc: any, c) => {
        acc[c.id] = c.type === "number" || c.type === "rating" ? 0 : "";
        return acc;
      }, {}),
    [columns]
  );

  const [values, setValues] = useState<Record<string, any>>(initial);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  function onChange(id: string, v: any) {
    setValues((s) => ({ ...s, [id]: v }));
  }

  async function submit(e?: React.FormEvent) {
    if (e) e.preventDefault();
    setSaving(true);
    setErr(null);
    try {
      const payload = Object.entries(values).map(([column_id, val]) => {
        if (typeof val === "number") return { column_id, value_number: val };
        return { column_id, value_text: String(val ?? "") };
      });
      await onSubmit(payload);
      // reset
      setValues(initial);
    } catch (e: any) {
      setErr(String(e.message ?? e));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div>
      <form onSubmit={submit} style={{ display: "grid", gap: 8 }}>
        {columns.length === 0 && <div style={{ color: "#6b7280" }}>Добавьте столбцы на сервере (пока нет столбцов)</div>}
        {columns.map((c) => (
          <div key={c.id} style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <label style={{ minWidth: 140 }}>{c.title}</label>
            {c.type === "number" || c.type === "rating" ? (
              <input
                type="number"
                value={values[c.id] ?? 0}
                onChange={(e) => onChange(c.id, Number(e.target.value))}
                style={{ padding: 8, borderRadius: 8, border: "1px solid rgba(0,0,0,0.06)", width: 160 }}
              />
            ) : (
              <input
                type="text"
                value={values[c.id] ?? ""}
                onChange={(e) => onChange(c.id, e.target.value)}
                style={{ padding: 8, borderRadius: 8, border: "1px solid rgba(0,0,0,0.06)", flex: 1 }}
              />
            )}
          </div>
        ))}

        <div style={{ display: "flex", gap: 8, marginTop: 6 }}>
          <button
            type="submit"
            disabled={saving}
            style={{
              padding: "8px 12px",
              borderRadius: 8,
              background: "linear-gradient(90deg,#0073e6,#1fa6ff)",
              color: "#fff",
              border: "none",
              fontWeight: 700,
            }}
          >
            Сохранить запись
          </button>
          <button
            type="button"
            onClick={() => setValues(initial)}
            style={{ padding: "8px 12px", borderRadius: 8, background: "#fff", border: "1px solid rgba(0,0,0,0.06)" }}
          >
            Сброс
          </button>
        </div>
        {err && <div style={{ color: "crimson", marginTop: 8 }}>{err}</div>}
      </form>

      <section style={{ marginTop: 18 }}>
        <h4 style={{ margin: "8px 0" }}>Последние записи</h4>
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {entries.length === 0 && <div style={{ color: "#6b7280" }}>Нет записей</div>}
          {entries.map((en) => (
            <div
              key={en.id}
              style={{
                padding: 10,
                borderRadius: 10,
                background: "#fff",
                boxShadow: "0 6px 18px rgba(20,40,60,0.04)",
              }}
            >
              <div style={{ fontSize: 13, color: "#6b7280" }}>{en.created_at ? new Date(en.created_at).toLocaleString() : ""}</div>
              <div style={{ marginTop: 6 }}>
                {(en.entry_values ?? []).map((v) => (
                  <div key={v.column_id} style={{ display: "flex", gap: 8 }}>
                    <strong style={{ width: 160 }}>{v.column_id}</strong>
                    <span>{v.value_number ?? v.value_text}</span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
