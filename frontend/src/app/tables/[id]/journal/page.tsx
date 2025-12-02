// frontend/src/app/tables/[id]/journal/page.tsx
import React from "react";
import JournalClient from "@/components/JournalClient";

type Props = { params: { id: string } };

export default function Page({ params }: Props) {
  const tableId = params.id;
  return (
    <div style={{ padding: 16 }}>
      <JournalClient tableId={tableId} />
    </div>
  );
}
