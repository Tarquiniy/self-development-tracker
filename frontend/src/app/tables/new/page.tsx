// frontend/src/app/tables/new/page.tsx
import React from "react";
import CreateTableForm from "@/components/CreateTableForm";

export default function NewTablePage() {
  return (
    <main style={{ padding: 24 }}>
      <header style={{ marginBottom: 18 }}>
        <h1 style={{ margin: 0 }}>Создать новую таблицу</h1>
        <p style={{ marginTop: 6, color: "#6b7280" }}>Введите название таблицы</p>
      </header>

      <CreateTableForm />
    </main>
  );
}
