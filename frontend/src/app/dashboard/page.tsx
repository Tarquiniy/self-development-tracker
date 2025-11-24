// frontend/src/app/dashboard/page.tsx
import React from 'react';
import Dashboard from '@/components/Dashboard'; // переименовано: Dashboard (client) — см. следующий файл

export default function DashboardPage() {
  return (
    <main style={{ padding: 24 }}>
      {/* Dashboard — client component. Выполняет авторизованный fetch из браузера */}
      <Dashboard />
    </main>
  );
}
