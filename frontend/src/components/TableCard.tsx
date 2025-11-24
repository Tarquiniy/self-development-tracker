// frontend/src/components/TableCard.tsx
"use client";

import React from "react";
import { JSX } from "react/jsx-runtime";

type Props = {
  table: { id: string; title: string; description?: string | null; created_at?: string | null };
  onOpen?: () => void;
};

export default function TableCard({ table, onOpen }: Props): JSX.Element {
  return (
    <article    
      onClick={onOpen}
      style={{
        background: "#fff",
        padding: 12,
        borderRadius: 12,
        boxShadow: "0 6px 18px rgba(20,40,60,0.04)",
        cursor: "pointer",
      }}
      role="button"
      tabIndex={0}
    >
      <h4 style={{ margin: "6px 0", fontSize: 16 }}>{table.title}</h4>
      {table.description && <div style={{ color: "#6b7280", fontSize: 13 }}>{table.description}</div>}
      <div style={{ marginTop: 10, fontSize: 12, color: "#94a3b8" }}>{table.created_at ? new Date(table.created_at).toLocaleString() : ""}</div>
    </article>
  );
}
