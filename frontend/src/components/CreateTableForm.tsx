// frontend/src/components/CreateTableForm.tsx
"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient"; // только для получения текущего пользователя
import DuplicateTableModal from "@/components/DuplicateTableModal";
import { JSX } from "react/jsx-runtime";

export default function CreateTableForm(): JSX.Element {
  const [title, setTitle] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [modalVisible, setModalVisible] = useState(false);
  const [existingTable, setExistingTable] = useState<any | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const router = useRouter();

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const name = title.trim();
    if (!name) {
      setError("Введите название таблицы.");
      return;
    }

    setLoading(true);

    try {
      // Получаем текущего пользователя (клиентский supabase)
      const { data: userData } = await supabase.auth.getUser();
      const currentUserId = userData?.user?.id ?? null;
      setUserId(currentUserId);

      // ВАЖНО: НИ В КОЕМ СЛУЧАЕ НЕ ВСТАВЛЯЕМ ЗДЕСЬ В БД ЧЕРЕЗ supabase.from(...)
      // ВЫЗЫВАЕМ СЕРВЕРНЫЙ ENDPOINT /api/tables
      const res = await fetch("/api/tables", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: name, owner: currentUserId }),
      });

      const j = await res.json().catch(() => null);

      if (res.status === 409 && j?.error === "user_has_table") {
        // Открываем модалку и передаём существующую таблицу
        setExistingTable(j?.existing ?? null);
        setModalVisible(true);
        setLoading(false);
        return;
      }

      if (!res.ok) {
        setError(j?.detail ?? j?.error ?? `Ошибка создания (status ${res.status})`);
        setLoading(false);
        return;
      }

      const created = j?.data?.table ?? j?.data;
      if (created?.id) {
        // Перейдём на созданную таблицу
        router.push(`/tables/${created.id}`);
      } else {
        router.push("/tables");
      }
    } catch (e: any) {
      setError(String(e?.message ?? e));
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <form onSubmit={onSubmit} style={{ maxWidth: 720 }}>
        <label style={{ display: "block", marginBottom: 10 }}>
          <div style={{ fontWeight: 700, marginBottom: 6 }}>Название таблицы</div>
          <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Например: Водный баланс" style={{ width: "100%", padding: "10px 12px", borderRadius: 10, border: "1px solid #e5e7eb" }} required />
        </label>

        <div style={{ display: "flex", gap: 10 }}>
          <button type="submit" disabled={loading} style={{ padding: "10px 14px", borderRadius: 10, border: "none", background: "#0f1724", color: "#fff" }}>
            {loading ? "Создаём..." : "Создать таблицу"}
          </button>

          <button type="button" onClick={() => (window.location.href = "/")} style={{ padding: "10px 14px", borderRadius: 10, border: "1px solid #e5e7eb", background: "#fff" }}>
            Отмена
          </button>
        </div>

        {error && <div style={{ color: "crimson", marginTop: 12 }}>{error}</div>}
      </form>

      <DuplicateTableModal visible={modalVisible} onClose={() => setModalVisible(false)} existingTable={existingTable} userId={userId} />
    </>
  );
}
