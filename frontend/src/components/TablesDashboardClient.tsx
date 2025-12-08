// frontend/src/components/TablesDashboardClient.tsx
"use client";

import React, { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import DuplicateTableModal from "@/components/DuplicateTableModal";

type TableItem = {
  id: string;
  title?: string;
  description?: string | null;
  categories?: any[];
  updated_at?: string | null | undefined;
  owner?: string | null;
  created_at?: string | null | undefined;
};

function friendlyDate(d?: string | null): string {
  if (!d) return "";
  try {
    return new Date(d).toLocaleString();
  } catch {
    return d ?? "";
  }
}

export default function TablesDashboardClient(): React.ReactElement {
  const router = useRouter();

  const [tables, setTables] = useState<TableItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [view, setView] = useState<"grid" | "list">("grid");
  const [sortBy, setSortBy] = useState<"recent" | "alpha">("recent");

  const [creating, setCreating] = useState(false);
  const [newTitle, setNewTitle] = useState("");

  const [modalVisible, setModalVisible] = useState(false);
  const [existingTable, setExistingTable] = useState<any | null>(null);

  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [accessToken, setAccessToken] = useState<string | null>(null);

  // -------------------------------
  // Load user + fetch tables
  // -------------------------------
  useEffect(() => {
    (async () => {
      const { userId, token } = await getOwnerAndToken();

      if (!userId) {
        setError("Пользователь не авторизован");
        return;
      }

      await fetchTables(userId, token);
    })();
  }, []);

  async function getOwnerAndToken(): Promise<{
    userId: string | null;
    token: string | null;
  }> {
    try {
      const sess = await supabase.auth.getSession();
      const session = sess?.data?.session ?? null;

      if (session?.user) {
        const id = session.user.id ?? null;
        const token = (session as any)?.access_token ?? null;
        setCurrentUserId(id);
        setAccessToken(token);
        return { userId: id, token };
      }

      return { userId: null, token: null };
    } catch {
      return { userId: null, token: null };
    }
  }

  // -------------------------------
  // Fetch only user tables
  // -------------------------------
  async function fetchTables(userId: string, token: string | null) {
    setLoading(true);
    setError(null);

    try {
      const headers: Record<string, string> = {
        "Content-Type": "application/json",
      };

      if (token) headers["Authorization"] = `Bearer ${token}`;

      const url = `/api/tables?owner=${encodeURIComponent(userId)}`;

      const res = await fetch(url, { headers });

      if (!res.ok) {
        const txt = await res.text();
        throw new Error(`Ошибка загрузки таблиц: ${txt}`);
      }

      const j = await res.json();
      const arr: any[] = Array.isArray(j?.data) ? j.data : [];

      const normalized: TableItem[] = arr.map((t) => ({
        id: String(t.id),
        title: t.title ?? "Без названия",
        description: t.description ?? null,
        categories: t.categories ?? [],
        updated_at: t.updated_at ?? t.created_at,
        owner: t.owner,
        created_at: t.created_at,
      }));

      // Больше не фильтруем на фронте — backend уже гарантирует только текущего пользователя
      setTables(normalized);
    } catch (e: any) {
      setError(e?.message ?? "Ошибка загрузки таблиц");
      setTables([]);
    } finally {
      setLoading(false);
    }
  }

  // -------------------------------
  // Create table
  // -------------------------------
  async function handleCreate() {
    if (!newTitle.trim()) return;

    setCreating(true);
    setError(null);

    try {
      if (!currentUserId) throw new Error("missing_user");

      const token = accessToken;
      if (!token) throw new Error("missing_token");

      const payload = { title: newTitle.trim(), owner: currentUserId };

      const res = await fetch("/api/tables", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
      });

      const j = await res.json();

      if (res.status === 409 && j?.error === "user_has_table") {
        setExistingTable(j.existing ?? null);
        setModalVisible(true);
        setCreating(false);
        return;
      }

      if (!res.ok) {
        throw new Error(j?.detail ?? j?.error ?? "Ошибка создания таблицы");
      }

      const created = j?.data;

      await fetchTables(currentUserId, token);
      setNewTitle("");
      setCreating(false);

      if (created?.id) {
        router.push(`/tables/${encodeURIComponent(created.id)}`);
      }
    } catch (e: any) {
      setError(String(e?.message ?? e));
      setCreating(false);
    }
  }

  async function handleQuickEdit(id: string) {
    router.push(`/tables/${encodeURIComponent(id)}`);
  }

  async function handleDelete(id: string) {
    if (!confirm("Удалить таблицу?")) return;

    try {
      const token = accessToken;
      if (!token) throw new Error("missing_token");

      const res = await fetch(`/api/tables/${encodeURIComponent(id)}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!res.ok) throw new Error("Не удалось удалить таблицу");

      if (currentUserId) await fetchTables(currentUserId, token);
    } catch (e: any) {
      setError(String(e?.message ?? e));
    }
  }

  // -------------------------------
  // Filtering + sorting
  // -------------------------------
  const filtered = useMemo(() => {
    let out = tables.slice();
    const q = query.trim().toLowerCase();

    if (q) {
      out = out.filter(
        (t) =>
          t.title?.toLowerCase().includes(q) ||
          t.description?.toLowerCase().includes(q)
      );
    }

    if (sortBy === "alpha") {
      out.sort((a, b) => (a.title ?? "").localeCompare(b.title ?? ""));
    } else {
      out.sort((a, b) =>
        (b.updated_at ?? "").localeCompare(a.updated_at ?? "")
      );
    }

    return out;
  }, [tables, query, sortBy]);

  // -------------------------------
  // Renders
  // -------------------------------

  function renderCard(t: TableItem) {
    return (
      <div
        key={t.id}
        style={{
          padding: 14,
          borderRadius: 12,
          background: "#fff",
          boxShadow: "0 8px 24px rgba(15,23,42,0.04)",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
        }}
      >
        <div>
          <div style={{ fontWeight: 700 }}>{t.title}</div>
          <div style={{ color: "#667085", fontSize: 13, minHeight: 30 }}>
            {t.description ?? "—"}
          </div>
        </div>

        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            marginTop: 12,
            gap: 8,
          }}
        >
          <div style={{ color: "#94a3b8", fontSize: 12 }}>
            {friendlyDate(t.updated_at)}
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <button onClick={() => handleQuickEdit(t.id)} style={smallBtnStyle}>
              Открыть
            </button>
            <button
              onClick={() => handleDelete(t.id)}
              style={smallDangerBtnStyle}
            >
              Удалить
            </button>
          </div>
        </div>
      </div>
    );
  }

  function renderListRow(t: TableItem) {
    return (
      <div
        key={t.id}
        style={{
          padding: 12,
          borderRadius: 10,
          background: "#fff",
          boxShadow: "0 6px 18px rgba(15,23,42,0.03)",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          gap: 12,
        }}
      >
        <div style={{ display: "flex", gap: 12 }}>
          <div style={{ fontWeight: 700 }}>{t.title}</div>
        </div>

        <div style={{ display: "flex", gap: 8 }}>
          <div style={{ color: "#94a3b8", fontSize: 12 }}>
            {friendlyDate(t.updated_at)}
          </div>
          <button onClick={() => handleQuickEdit(t.id)} style={smallBtnStyle}>
            Открыть
          </button>
          <button
            onClick={() => handleDelete(t.id)}
            style={smallDangerBtnStyle}
          >
            Удалить
          </button>
        </div>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 1100, margin: "0 auto", padding: "18px 12px" }}>
      <DuplicateTableModal
        visible={modalVisible}
        onClose={() => setModalVisible(false)}
        existingTable={existingTable}
        userId={currentUserId}
      />

      <h1 style={{ fontSize: 22 }}>Мои таблицы</h1>

      {/* Create form */}
      <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
        <input
          placeholder="Название новой таблицы"
          value={newTitle}
          onChange={(e) => setNewTitle(e.target.value)}
          style={{
            padding: 10,
            borderRadius: 10,
            border: "1px solid #ddd",
            flex: "1 1 auto",
          }}
        />

        <button onClick={handleCreate} disabled={creating} style={primaryBtnStyle}>
          {creating ? "Создаём..." : "Создать таблицу"}
        </button>
      </div>

      {error && <div style={{ color: "crimson" }}>{error}</div>}

      {loading ? (
        <div>Загрузка...</div>
      ) : filtered.length === 0 ? (
        <div
          style={{
            background: "#fff",
            padding: 30,
            borderRadius: 12,
            textAlign: "center",
          }}
        >
          У вас пока нет таблиц.
        </div>
      ) : view === "grid" ? (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill,minmax(260px,1fr))",
            gap: 12,
          }}
        >
          {filtered.map((t) => renderCard(t))}
        </div>
      ) : (
        <div style={{ display: "grid", gap: 10 }}>
          {filtered.map((t) => renderListRow(t))}
        </div>
      )}
    </div>
  );
}

// ==== styles ====

const primaryBtnStyle: React.CSSProperties = {
  padding: "10px 14px",
  borderRadius: 10,
  border: "none",
  background: "#0f1724",
  color: "#fff",
  fontWeight: 700,
  cursor: "pointer",
};

const smallBtnStyle: React.CSSProperties = {
  padding: "6px 10px",
  borderRadius: 8,
  border: "1px solid #e6e7eb",
  background: "#fff",
  cursor: "pointer",
};

const smallDangerBtnStyle: React.CSSProperties = {
  ...smallBtnStyle,
  color: "#dc2626",
  borderColor: "rgba(220,38,38,0.3)",
};
