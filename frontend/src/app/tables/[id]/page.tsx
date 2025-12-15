// frontend/src/app/tables/[id]/page.tsx
import React from "react";
import TableEditorClient from "@/components/TableEditorClient";

type Props = { params: { id: string } };

export default function TablePage({ params }: Props) {
  // гарантируем строку (если params не передан, передаем пустую строку)
  const id = String(params?.id ?? "");

  return (
    <main style={{ padding: 20, minHeight: "100vh", boxSizing: "border-box" }}>
      <div style={{ maxWidth: 1100, margin: "0 auto" }}>
        <header style={{ marginBottom: 18 }}>
          <h1 style={{ margin: 0, fontSize: 22, fontWeight: 700 }}>Таблица</h1>
          <p style={{ margin: "6px 0 0", color: "#475569" }}>Работа с целями и категориями</p>
        </header>

        {/* 
          Всегда рендерим клиентский редактор. 
          TableEditorClient должен уметь принимать пустой id и подхватывать реальный id
          (из props или по URL / supabase) — если нет, см. опциональный патч ниже.
        */}
        <TableEditorClient tableId={id} />
      </div>
    </main>
  );
}
