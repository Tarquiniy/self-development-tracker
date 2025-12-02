// frontend/src/app/tables/page.tsx
"use client";

import React from "react";
import TablesDashboardClient from "@/components/TablesDashboardClient";

export default function TablesPage() {
  return (
    <main style={{ padding: 20 }}>
      <TablesDashboardClient />
    </main>
  );
}
