// frontend/src/components/TableEditorLoader.tsx
"use client";

import React from "react";
import TableEditorClient from "./TableEditorClient";

type Props = {
  tableId: string;
  serverData?: any;
};

/**
 * Простой клиент-лоадер — проксирует serverData в клиентский компонент.
 * (Ранее здесь часто передавали serverData не в том формате и это ломало клиент.)
 */
export default function TableEditorLoader({ tableId, serverData }: Props) {
  return <TableEditorClient tableId={tableId} serverData={serverData} />;
}
