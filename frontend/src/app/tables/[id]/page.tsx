// frontend/src/app/tables/[id]/page.tsx
import React from "react";
import TableEditorClient from "@/components/TableEditorClient";

type Props = { params: { id: string } };

export default function TablePage({ params }: Props) {
  const id = String(params?.id ?? "");

  return (
    <main style={{ padding: 20, minHeight: "100vh", boxSizing: "border-box" }}>
      <div style={{ maxWidth: 1100, margin: "0 auto" }}>
        {id ? (
          <>
            <header style={{ marginBottom: 18 }}>
              <h1 style={{ margin: 0, fontSize: 22, fontWeight: 700 }}>Таблица</h1>
              <p style={{ margin: "6px 0 0", color: "#475569" }}>Работа с целями и категориями</p>
            </header>

            {/* TableEditorClient — client component. It expects a tableId string prop. */}
            <TableEditorClient tableId={id} />
          </>
        ) : (
          <div
            style={{
              padding: 24,
              borderRadius: 12,
              background: "#fff",
              boxShadow: "0 8px 24px rgba(15,23,42,0.04)",
            }}
          >
            <h2 style={{ marginTop: 0 }}>Таблица не найдена</h2>
            <p style={{ margin: 0, color: "#64748b" }}>
              Не передан идентификатор таблицы в URL. Проверьте ссылку или вернитесь на страницу «Мои таблицы».
            </p>
          </div>
        )}
      </div>
    </main>
  );
}
