// frontend/src/components/ClientBoundary.tsx
"use client";

import React from "react";
import ClientErrorBoundary from "@/components/ClientErrorBoundary";

type Props = { children: React.ReactNode };

/**
 * Клиентский обёрточный компонент.
 * Причина существования: layout.tsx — Server Component и не может использовать next/dynamic({ ssr: false }).
 * Серверный layout может импортировать этот клиентский компонент напрямую.
 */
export default function ClientBoundary({ children }: Props) {
  return <ClientErrorBoundary>{children}</ClientErrorBoundary>;
}
