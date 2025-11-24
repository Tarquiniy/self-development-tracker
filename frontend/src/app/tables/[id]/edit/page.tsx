// frontend/src/app/tables/[id]/edit/page.tsx
import React from "react";
import TableEditorClient from "@/components/TableEditorClient";

type Props = { params: { id: string } };

export default function TableEditPage({ params }: Props) {
  const id = params?.id ?? "";
  return (
    <main style={{ padding: 16 }}>
      {/* Если TableEditorClient — клиентский компонент (use client), импортировать
          его прямо в серверной странице нормально — Next автоматически обработает. */}
      <TableEditorClient tableId={id} />
    </main>
  );
}
