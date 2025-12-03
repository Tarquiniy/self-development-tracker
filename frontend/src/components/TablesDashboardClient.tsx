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
  user_id?: string | null;
};

function friendlyDate(d?: string | null): string {
  if (!d) return "";
  try {
    const dt = new Date(d);
    return dt.toLocaleString();
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

  // профиль с лимитом
  const [profile, setProfile] = useState<{ max_tables?: number; tables_limit?: number } | null>(null);

  // единый базовый путь для таблиц (без завершающего слеша — backend поддерживает оба варианта)
  const TABLES_BASE = "/api/tables/tables";

  useEffect(() => {
    (async () => {
      const { token } = await getOwnerAndToken();
      await fetchUserProfile(token);
      await fetchTables(token);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function getOwnerAndToken(): Promise<{ userId: string | null; token: string | null }> {
    try {
      const sessRes = await supabase.auth.getSession();
      const session = (sessRes as any)?.data?.session ?? null;

      if (session && session.user) {
        const userId = session.user.id ?? null;
        const token = (session as any)?.access_token ?? null;
        setCurrentUserId(userId);
        setAccessToken(token);
        return { userId, token };
      }

      const userRes = await supabase.auth.getUser();
      const user = (userRes as any)?.data?.user ?? null;
      if (user) {
        setCurrentUserId(user.id ?? null);
        setAccessToken(null);
        return { userId: user.id ?? null, token: null };
      }

      setCurrentUserId(null);
      setAccessToken(null);
      return { userId: null, token: null };
    } catch (e) {
      console.warn("getOwnerAndToken failed:", e);
      setCurrentUserId(null);
      setAccessToken(null);
      return { userId: null, token: null };
    }
  }

  async function fetchUserProfile(tokenParam?: string | null) {
    try {
      const token = tokenParam ?? accessToken;
      if (!token) {
        try {
          const { data: userData } = await supabase.auth.getUser();
          const user = (userData as any)?.user ?? null;
          if (user) {
            const { data: prof, error } = await supabase.from("profiles").select("*").eq("id", user.id).single();
            if (!error && prof) {
              setProfile({
                max_tables: Number(prof.max_tables ?? prof.tables_limit ?? 1),
                tables_limit: Number(prof.tables_limit ?? prof.max_tables ?? 1),
              });
            }
            return;
          }
        } catch (e) {
          // ignore
        }
        return;
      }

      try {
        const res = await fetch("/api/auth/profile/", {
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
        });
        if (!res.ok) {
          return;
        }
        const j = await res.json().catch(() => null);
        const prof = j?.profile ?? j?.data ?? j;
        if (prof) {
          setProfile({
            max_tables: prof.max_tables ? Number(prof.max_tables) : undefined,
            tables_limit: prof.tables_limit ? Number(prof.tables_limit) : undefined,
          });
        }
      } catch (e) {
        console.warn("fetchUserProfile server fail:", e);
      }
    } catch (e) {
      console.warn("fetchUserProfile failed:", e);
    }
  }

  async function fetchTables(tokenParam?: string | null) {
    setLoading(true);
    setError(null);
    try {
      const token = tokenParam ?? accessToken;
      const headers: Record<string, string> = { "Content-Type": "application/json" };
      if (token) headers["Authorization"] = `Bearer ${token}`;

      // Используем TABLES_BASE (без завершающего slash). Backend поддерживает оба варианта.
      const res = await fetch(TABLES_BASE, { headers });
      if (!res.ok) {
        const txt = await res.text().catch(() => "");
        throw new Error(`Failed fetching tables (${res.status}): ${txt}`);
      }

      const j = await res.json().catch(() => ({}));
      const arr: any[] = Array.isArray(j?.data)
        ? j.data
        : Array.isArray(j)
        ? j
        : Array.isArray(j?.tables)
        ? j.tables
        : [];

      const normalized: TableItem[] = arr
        .map((t: any) => ({
          id: String(t?.id ?? t?.table_id ?? t?._id ?? ""),
          title: t?.title ?? t?.name ?? "Без названия",
          description: t?.description ?? null,
          categories: t?.categories ?? t?.cats ?? [],
          updated_at: t?.updated_at ?? t?.created_at ?? t?.createdAt ?? undefined,
          owner: t?.owner ?? t?.user ?? null,
          created_at: t?.created_at ?? null,
          user_id: t?.user_id ?? null,
        }))
        .filter((x: TableItem) => Boolean(x.id));

      let filteredByOwner = normalized;
      if (currentUserId) {
        filteredByOwner = normalized.filter((t) => String(t.owner ?? "") === String(currentUserId));
      }

      setTables(filteredByOwner);
    } catch (e: any) {
      setError(String(e?.message ?? e));
      setTables([]);
    } finally {
      setLoading(false);
    }
  }

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    let out = tables.slice();
    if (q) {
      out = out.filter(
        (t) =>
          (t.title ?? "").toLowerCase().includes(q) ||
          (t.description ?? "").toLowerCase().includes(q)
      );
    }
    if (sortBy === "alpha") out.sort((a, b) => (a.title ?? "").localeCompare(b.title ?? ""));
    else out.sort((a, b) => (b.updated_at ?? "").localeCompare(a.updated_at ?? ""));
    return out;
  }, [tables, query, sortBy]);

  async function handleCreate() {
    if (!newTitle.trim()) return;

    setCreating(true);
    setError(null);

    try {
      let token = accessToken;
      if (!token) {
        const got = await getOwnerAndToken();
        token = got.token;
      }

      const maxAllowed = profile?.max_tables ?? profile?.tables_limit ?? 1;
      if (tables.length >= Number(maxAllowed)) {
        setError(`Вы можете создать максимум ${maxAllowed} таблиц. Попросите администратора увеличить лимит.`);
        setCreating(false);
        return;
      }

      if (!token) {
        throw new Error("missing_token: пользователь не аутентифицирован");
      }

      const payload = { title: newTitle.trim() };

      // POST на TABLES_BASE (backend теперь поддерживает варианты с/без slash)
      const res = await fetch(TABLES_BASE, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify(payload),
      });

      if (res.status === 409) {
        const j409 = await res.json().catch(() => ({}));
        if (j409?.error === "user_has_table") {
          setExistingTable(j409.existing ?? null);
          setModalVisible(true);
          setCreating(false);
          return;
        }
        throw new Error(JSON.stringify(j409));
      }

      const j = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(j?.detail ?? j?.error ?? "Ошибка создания таблицы");
      }

      const created = j?.data?.table ?? j?.data ?? j;

      await fetchTables(token);
      await fetchUserProfile(token);

      setNewTitle("");
      setCreating(false);

      if (created && created.id) {
        router.push(`/tables/${encodeURIComponent(created.id)}`);
      }
    } catch (e: any) {
      setError(String(e?.message ?? e));
      setCreating(false);
    }
  }

  async function handleQuickEdit(tableId: string) {
    router.push(`/tables/${encodeURIComponent(tableId)}`);
  }

  async function handleDelete(tableId: string) {
    if (!confirm("Удалить таблицу? Это действие необратимо.")) return;
    try {
      let token = accessToken;
      if (!token) {
        const got = await getOwnerAndToken();
        token = got.token;
      }

      const headers: Record<string, string> = { "Content-Type": "application/json" };
      if (token) headers["Authorization"] = `Bearer ${token}`;

      const res = await fetch(`${TABLES_BASE}/${encodeURIComponent(tableId)}`, {
        method: "DELETE",
        headers,
      });
      if (!res.ok) {
        const txt = await res.text().catch(() => "");
        throw new Error(`Удаление не удалось (${res.status}): ${txt}`);
      }
      await fetchTables(token);
    } catch (e: any) {
      setError(String(e?.message ?? e));
    }
  }

  // renderCard / renderListRow same as before...
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
          minWidth: 220,
        }}
      >
        <div>
          <div style={{ fontWeight: 700, marginBottom: 6 }}>{t.title}</div>
          <div style={{ color: "#667085", fontSize: 13, minHeight: 38 }}>
            {t.description ?? "—"}
          </div>
        </div>

        <div style={{ display: "flex", justifyContent: "space-between", marginTop: 12, gap: 8 }}>
          <div style={{ color: "#94a3b8", fontSize: 12 }}>{friendlyDate(t.updated_at ?? t.created_at)}</div>
          <div style={{ display: "flex", gap: 8 }}>
            <button onClick={() => handleQuickEdit(t.id)} style={smallBtnStyle}>
              Открыть
            </button>
            <button onClick={() => handleDelete(t.id)} style={smallDangerBtnStyle}>
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
        <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
          <div style={{ width: 8, height: 40, borderRadius: 6, background: "#e6eef9" }} />
          <div>
            <div style={{ fontWeight: 700 }}>{t.title}</div>
            <div style={{ color: "#64748b", fontSize: 13 }}>{t.description ?? "—"}</div>
          </div>
        </div>

        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <div style={{ color: "#94a3b8", fontSize: 12 }}>{friendlyDate(t.updated_at ?? t.created_at)}</div>
          <button onClick={() => handleQuickEdit(t.id)} style={smallBtnStyle}>
            Открыть
          </button>
          <button onClick={() => handleDelete(t.id)} style={smallDangerBtnStyle}>
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

      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          gap: 12,
          marginBottom: 18,
        }}
      >
        <div>
          <h1 style={{ margin: 0, fontSize: 22 }}>Мои таблицы</h1>
          <div style={{ color: "#667085", fontSize: 13 }}>
            Управление вашими таблицами
            {" "}
            {profile && (
              <span style={{ marginLeft: 10, fontSize: 12, color: "#2d3748" }}>
                Лимит: {profile.max_tables ?? profile.tables_limit ?? 1} таблиц
              </span>
            )}
          </div>
        </div>

        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <input
            placeholder="Поиск таблиц..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            style={{ padding: 8, borderRadius: 8, border: "1px solid #e6eef9" }}
          />

          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as any)}
            style={{ padding: 8, borderRadius: 8 }}
          >
            <option value="recent">Сначала недавно</option>
            <option value="alpha">По названию</option>
          </select>

          <button
            onClick={() => setView(view === "grid" ? "list" : "grid")}
            style={{ padding: 8, borderRadius: 8 }}
          >
            {view === "grid" ? "Список" : "Плитка"}
          </button>
        </div>
      </div>

      {/* создание */}
      <div style={{ marginBottom: 16, display: "flex", gap: 8, alignItems: "center" }}>
        <input
          placeholder="Название новой таблицы"
          value={newTitle}
          onChange={(e) => setNewTitle(e.target.value)}
          style={{ padding: 10, borderRadius: 10, border: "1px solid #e5e7eb", flex: "1 1 auto" }}
        />
        <button onClick={handleCreate} disabled={creating} style={primaryBtnStyle}>
          {creating ? "Создаём..." : "Создать таблицу"}
        </button>
      </div>

      {error && (
        <div style={{ color: "crimson", marginBottom: 12 }}>{error}</div>
      )}

      {loading ? (
        <div style={{ color: "#64748b" }}>Загрузка...</div>
      ) : filtered.length === 0 ? (
        <div style={{ padding: 24, borderRadius: 12, background: "#fff", boxShadow: "0 8px 24px rgba(15,23,42,0.04)" }}>
          <h3 style={{ marginTop: 0 }}>Таблицы не найдены</h3>
          <p style={{ margin: 0, color: "#64748b" }}>
            У вас пока нет таблиц. Создайте первую таблицу через форму выше.
          </p>
        </div>
      ) : view === "grid" ? (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(260px,1fr))", gap: 12 }}>
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

// styles (unchanged)
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
  border: "1px solid rgba(220, 38, 38, 0.12)",
  color: "#dc2626",
};
