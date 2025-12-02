// frontend/src/components/JournalList.tsx
"use client";

import React from "react";

type Summary = {
  category_id: string | null;
  title: string;
  color?: string;
  points: number;
  max?: number | null;
};

export default function JournalList({
  groupedSummaries,
  loading,
  error,
  totalCount,
}: {
  groupedSummaries: { date: string; summaries: Summary[] }[];
  loading?: boolean;
  error?: string | null;
  totalCount?: number;
}) {
  function labelForDateIso(iso: string) {
    try {
      const d = new Date(iso + "T00:00:00");
      const today = new Date();
      const todIso = today.toISOString().slice(0, 10);
      const yesterday = new Date(today);
      yesterday.setDate(today.getDate() - 1);
      const yestIso = yesterday.toISOString().slice(0, 10);
      if (iso === todIso) return "Сегодня";
      if (iso === yestIso) return "Вчера";
      return d.toLocaleDateString(undefined, { day: "numeric", month: "short", weekday: "short" });
    } catch {
      return iso;
    }
  }

  if (loading) return <div style={{ padding: 12 }}>Загрузка...</div>;
  if (error) return <div style={{ padding: 12, color: "crimson" }}>Ошибка: {error}</div>;
  if (!groupedSummaries || groupedSummaries.length === 0) return <div style={{ padding: 12, color: "#666" }}>Нет данных за выбранную дату.</div>;

  return (
    <div style={{ display: "grid", gap: 14 }}>
      {groupedSummaries.map((group) => (
        <div key={group.date}>
          <div style={{ fontSize: 13, color: "#333", marginBottom: 8, fontWeight: 700 }}>{labelForDateIso(group.date)}</div>

          <div style={{ display: "grid", gap: 10 }}>
            {group.summaries.map((s) => {
              const pct = s.max ? Math.min(100, Math.round((s.points / s.max) * 100)) : null;
              const isZero = !s.points;
              return (
                <div
                  key={`${group.date}:${s.category_id ?? "nocat"}`}
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    padding: 12,
                    borderRadius: 12,
                    background: isZero ? "#fafafa" : "#fff",
                    border: "1px solid #eee",
                    boxShadow: isZero ? "none" : "0 2px 6px rgba(10,20,30,0.02)"
                  }}
                >
                  <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
                    <div style={{
                      width: 44,
                      height: 44,
                      borderRadius: 10,
                      background: s.color ?? "#e6eef9",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      color: "#fff",
                      fontWeight: 700,
                      flexShrink: 0
                    }}>
                      {String((s.title || "").slice(0, 2)).toUpperCase()}
                    </div>

                    <div style={{ display: "flex", flexDirection: "column" }}>
                      <div style={{ fontSize: 14, fontWeight: 700, color: "#0b1720" }}>{s.title || "Без названия"}</div>
                      <div style={{ fontSize: 13, color: "#666" }}>
                        {s.max ? `Цель: ${s.max} • набрано: ${s.points}` : `Набрано: ${s.points}`}
                      </div>
                    </div>
                  </div>

                  <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 6 }}>
                    <div style={{
                      fontSize: 18,
                      fontWeight: 800,
                      color: "#0b66ff",
                      minWidth: 64,
                      textAlign: "right"
                    }}>
                      {s.points}{s.max ? `/${s.max}` : ""}
                    </div>

                    {s.max ? (
                      <div style={{ fontSize: 12, color: "#666" }}>{pct}%</div>
                    ) : (
                      <div style={{ fontSize: 12, color: "#666" }}>—</div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ))}

      <div style={{ color: "#666", fontSize: 13 }}>{totalCount ?? 0} категорий</div>
    </div>
  );
}
