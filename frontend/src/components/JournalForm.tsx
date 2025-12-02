// frontend/src/components/JournalForm.tsx
"use client";

import React from "react";
import Link from "next/link";

export default function JournalForm({ tableId, selectedDate }: { tableId: string; selectedDate: Date }) {
  return (
    <div style={{ border: "1px solid #eee", padding: 12, borderRadius: 8 }}>
      <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 8 }}>Просмотр состояния категорий</div>
      <div style={{ color: "#666", marginBottom: 8 }}>
        Здесь отображается состояние категорий (сколько баллов было в каждой категории) за выбранную дату.
      </div>
      <div style={{ color: "#666", fontSize: 13 }}>
        Чтобы изменить значения, перейдите на страницу таблицы (где доступны + / - для категорий).
      </div>

      <div style={{ marginTop: 8 }}>
        <Link href={`/tables/${encodeURIComponent(tableId)}`}>
          <a style={{ padding: "8px 12px", borderRadius: 8, background: "#eef6ff", border: "1px solid #d0e6ff", color: "#0b66ff", fontWeight: 600 }}>
            Открыть таблицу
          </a>
        </Link>
      </div>
    </div>
  );
}
