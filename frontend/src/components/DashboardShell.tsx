// frontend/src/components/DashboardShell.tsx
'use client';

import dynamic from 'next/dynamic';
import React from 'react';
import { JSX } from 'react/jsx-runtime';

// Настраиваем динамическую загрузку клиентского DashboardClient.
// DashboardClient должен быть client-компонентом (с "use client" внутри файла).
const DashboardClient = dynamic(
  () => import('@/components/DashboardClient'),
  { ssr: false, loading: () => <div>Загрузка дашборда…</div> }
);

export default function DashboardShell(): JSX.Element {
  return (
    <div>
      <DashboardClient />
    </div>
  );
}
