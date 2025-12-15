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

  // allowedLimit: number | Infinity | null
  const [allowedLimit, setAllowedLimit] = useState<number | typeof Infinity | null>(null);
  const [currentCount, setCurrentCount] = useState<number | null>(null);

  useEffect(() => {
    (async () => {
      // Get current session and user id
      const { data: sessData } = await supabase.auth.getSession();
      const session = (sessData as any)?.session ?? null;
      const token = session ? (session as any)?.access_token ?? null : null;
      const userId = session ? session.user?.id ?? null : ((await supabase.auth.getUser()) as any)?.data?.user?.id ?? null;

      setCurrentUserId(userId);
      setAccessToken(token);

      if (userId) {
        await Promise.all([fetchProfileFromSupabase(userId), fetchTablesFromSupabase(userId)]);
      } else {
        // fallback: fetch public tables
        await fetchTables();
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ---------- supabase reads ----------

  // Read tables_limit directly from Supabase profiles table
  async function fetchProfileFromSupabase(userId: string) {
    try {
      const { data, error } = await supabase
        .from("profiles")
        .select("tables_limit")
        .eq("id", userId)
        .maybeSingle();

      if (error) {
        console.warn("fetchProfileFromSupabase error:", error);
        setAllowedLimit(null);
        return;
      }

      const raw = data?.tables_limit ?? null;
      normalizeAndSetLimit(raw);
    } catch (e) {
      console.warn("fetchProfileFromSupabase failed:", e);
      setAllowedLimit(null);
    }
  }

  // Read count and rows from Supabase user_tables; returns normalized rows
  async function fetchTablesFromSupabase(userId: string): Promise<TableItem[]> {
    setLoading(true);
    setError(null);
    try {
      // count only for performance
      const tablesRes = await supabase
        .from("user_tables")
        .select("id", { count: "exact" })
        .eq("owner", userId);

      if (tablesRes.error) {
        console.warn("fetchTablesFromSupabase error (count):", tablesRes.error);
        // fallback to public fetch
        await fetchTables();
        return [];
      }

      const count = typeof tablesRes.count === "number" ? tablesRes.count : (Array.isArray(tablesRes.data) ? tablesRes.data.length : 0);
      setCurrentCount(count);

      // fetch actual rows to display (ordered newest first)
      const rowsRes = await supabase
        .from("user_tables")
        .select("*")
        .eq("owner", userId)
        .order("created_at", { ascending: false });

      if (rowsRes.error) {
        console.warn("rowsRes error:", rowsRes.error);
        setTables([]);
        return [];
      } else {
        const arr = Array.isArray(rowsRes.data) ? rowsRes.data : [];
        const normalized: TableItem[] = arr.map((t: any) => ({
          id: String(t?.id ?? t?.table_id ?? t?.ID ?? ""),
          title: t?.title ?? "Без названия",
          description: t?.description ?? null,
          categories: t?.categories ?? [],
          updated_at: t?.updated_at ?? t?.created_at ?? undefined,
          owner: t?.owner ?? null,
          created_at: t?.created_at ?? null,
          user_id: t?.user_id ?? null,
        })).filter(x => Boolean(x.id));
        setTables(normalized);
        return normalized;
      }
    } catch (e: any) {
      console.warn("fetchTablesFromSupabase failed:", e);
      setTables([]);
      setCurrentCount(null);
      return [];
    } finally {
      setLoading(false);
    }
  }

  // fallback: fetch public tables via /api/tables
  async function fetchTables(): Promise<TableItem[]> {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/tables");
      if (!res.ok) {
        setTables([]);
        setLoading(false);
        return [];
      }
      const j = await res.json().catch(() => ({}));
      const arr: any[] = Array.isArray(j?.data) ? j.data : [];
      const normalized: TableItem[] = arr.map((t: any) => ({
        id: String(t?.id ?? t?.table_id ?? t?.ID ?? ""),
        title: t?.title ?? "Без названия",
        description: t?.description ?? null,
        categories: t?.categories ?? [],
        updated_at: t?.updated_at ?? t?.created_at ?? undefined,
        owner: t?.owner ?? null,
        created_at: t?.created_at ?? null,
        user_id: t?.user_id ?? null,
      })).filter(x => Boolean(x.id));
      setTables(normalized);
      setCurrentCount(normalized.length);
      return normalized;
    } catch (e: any) {
      setError(String(e?.message ?? e));
      setTables([]);
      setCurrentCount(null);
      return [];
    } finally {
      setLoading(false);
    }
  }

  function normalizeAndSetLimit(raw: any) {
    let val: number | typeof Infinity | null = null;
    if (raw === null || raw === undefined) val = null;
    else {
      const n = Number(raw);
      if (!Number.isFinite(n)) val = null;
      else if (n < 0) val = Infinity;
      else val = Math.floor(n);
    }
    setAllowedLimit(val);
  }

  // helper: whether user reached limit
  function hasReachedLimit(): boolean {
    const limit = allowedLimit === null ? 1 : allowedLimit;
    if (limit === Infinity) return false;
    if (currentCount === null) return false; // unknown count -> allow (server will protect)
    return currentCount >= Number(limit);
  }

  // ------------------------------
  // Создание таблицы
  // ------------------------------
  async function handleCreate() {
    if (!newTitle.trim()) return;

    setCreating(true);
    setError(null);

    try {
      // ensure current user id
      if (!currentUserId) {
        const ures = await supabase.auth.getUser();
        const userId = (ures as any)?.data?.user?.id ?? null;
        setCurrentUserId(userId);
      }

      // client-side check: show modal if reached
      if (hasReachedLimit()) {
        setExistingTable(tables[0] ?? null);
        setModalVisible(true);
        setCreating(false);
        return;
      }

      // call backend
      const payload = { title: newTitle.trim(), owner: currentUserId };
      const res = await fetch("/api/tables", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      // parse response
      const j = await res.json().catch(() => ({}));

      if (!res.ok) {
        // handle 409 specially
        if (res.status === 409 && j?.error === "user_has_table") {
          setExistingTable(j.existing ?? tables[0] ?? null);
          setModalVisible(true);
          setCreating(false);
          // refresh counts
          if (currentUserId) await fetchTablesFromSupabase(currentUserId);
          return;
        }
        throw new Error(j?.detail ?? j?.error ?? `Ошибка создания таблицы (${res.status})`);
      }

      // Successful creation — try to pick id from different locations
      const createdCandidate = j?.data?.table ?? j?.data ?? j;
      let newId: string | null = null;

      if (createdCandidate) {
        newId = String(createdCandidate?.id ?? createdCandidate?.ID ?? createdCandidate?.table_id ?? createdCandidate?.table?.id ?? createdCandidate?.table?.ID ?? createdCandidate?._id ?? "");
        if (!newId) newId = null;
      }

      // If no id returned by API — fallback: query supabase for newest table of user
      if (!newId) {
        if (currentUserId) {
          const newest = await fetchTablesFromSupabase(currentUserId);
          newId = newest?.[0]?.id ?? null;
        }
      }

      // Refresh local state anyway
      if (currentUserId) await fetchTablesFromSupabase(currentUserId);
      setNewTitle("");
      setCreating(false);

      if (newId) {
        router.push(`/tables/${encodeURIComponent(newId)}`);
      } else {
        // nothing to navigate to — show helpful error and log response
        console.error("Could not determine created table id. Server response:", j);
        setError("Таблица создана, но не удалось открыть её автоматически — перейдите в «Мои таблицы».");
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
    // Попробуем получить токен из supabase клиента (v2 API)
    let token: string | null = null;
    try {
      const sessionRes = await supabase.auth.getSession();
      token = sessionRes?.data?.session?.access_token ?? null;
    } catch {
      // ignore
    }

    const headers: Record<string, string> = { "Content-Type": "application/json" };
    if (token) {
      headers["Authorization"] = `Bearer ${token}`;
    }

    const res = await fetch(`/api/tables/${encodeURIComponent(tableId)}`, {
      method: "DELETE",
      headers,
      credentials: "same-origin", // отправит cookies, если сессия в cookie
    });

    if (!res.ok) {
      const txt = await res.text().catch(() => "");
      throw new Error(`Удаление не удалось (${res.status}): ${txt}`);
    }

    // обновляем список таблиц
    if (currentUserId) await fetchTablesFromSupabase(currentUserId);
  } catch (e: any) {
    setError(String(e?.message ?? e));
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

  // ---------------- UI ----------------
  return (
    <div style={{ maxWidth: 1100, margin: "0 auto", padding: "18px 12px" }}>
      <DuplicateTableModal
        visible={modalVisible}
        onClose={() => setModalVisible(false)}
        existingTable={existingTable}
        userId={currentUserId}
      />

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, marginBottom: 18 }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 22 }}>Мои таблицы</h1>
          <div style={{ color: "#667085", fontSize: 13 }}>Управление вашими таблицами</div>
        </div>

        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <input placeholder="Поиск таблиц..." value={query} onChange={(e) => setQuery(e.target.value)} style={{ padding: 8, borderRadius: 8, border: "1px solid #e6eef9" }} />

          <select value={sortBy} onChange={(e) => setSortBy(e.target.value as any)} style={{ padding: 8, borderRadius: 8 }}>
            <option value="recent">Сначала недавно</option>
            <option value="alpha">По названию</option>
          </select>

          <button onClick={() => setView(view === "grid" ? "list" : "grid")} style={{ padding: 8, borderRadius: 8 }}>
            {view === "grid" ? "Список" : "Плитка"}
          </button>
        </div>
      </div>

      {/* создание */}
      <div style={{ marginBottom: 16, display: "flex", gap: 8, alignItems: "center" }}>
        <input placeholder="Название новой таблицы" value={newTitle} onChange={(e) => setNewTitle(e.target.value)} style={{ padding: 10, borderRadius: 10, border: "1px solid #e5e7eb", flex: "1 1 auto" }} />
        <button onClick={handleCreate} disabled={creating} style={{ ...primaryBtnStyle, opacity: creating ? 0.6 : 1 }}>
          {creating ? "Создаём..." : "Создать таблицу"}
        </button>
      </div>

      {allowedLimit !== null && (
        <div style={{ marginBottom: 8, color: "#64748b", fontSize: 13 }}>
          Лимит таблиц: {allowedLimit === Infinity ? "∞" : allowedLimit} • Создано: {currentCount ?? tables.length}
        </div>
      )}

      {error && <div style={{ color: "crimson", marginBottom: 12 }}>{error}</div>}

      {loading ? (
        <div style={{ color: "#64748b" }}>Загрузка...</div>
      ) : filtered.length === 0 ? (
        <div style={{ padding: 24, borderRadius: 12, background: "#fff", boxShadow: "0 8px 24px rgba(15,23,42,0.04)" }}>
          <h3 style={{ marginTop: 0 }}>Таблицы не найдены</h3>
          <p style={{ margin: 0, color: "#64748b" }}>У вас пока нет таблиц. Создайте первую таблицу через форму выше.</p>
        </div>
      ) : view === "grid" ? (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(260px,1fr))", gap: 12 }}>{filtered.map((t) => renderCard(t))}</div>
      ) : (
        <div style={{ display: "grid", gap: 10 }}>{filtered.map((t) => renderListRow(t))}</div>
      )}
    </div>
  );

  function renderCard(t: TableItem) {
    return (
      <div key={t.id} style={{ padding: 14, borderRadius: 12, background: "#fff", boxShadow: "0 8px 24px rgba(15,23,42,0.04)", display: "flex", flexDirection: "column", justifyContent: "space-between", minWidth: 220 }}>
        <div>
          <div style={{ fontWeight: 700, marginBottom: 6 }}>{t.title}</div>
          <div style={{ color: "#667085", fontSize: 13, minHeight: 38 }}>{t.description ?? "—"}</div>
        </div>

        <div style={{ display: "flex", justifyContent: "space-between", marginTop: 12, gap: 8 }}>
          <div style={{ color: "#94a3b8", fontSize: 12 }}>{friendlyDate(t.updated_at ?? t.created_at)}</div>
          <div style={{ display: "flex", gap: 8 }}>
            <button onClick={() => handleQuickEdit(t.id)} style={smallBtnStyle}>Открыть</button>
            <button onClick={() => handleDelete(t.id)} style={smallDangerBtnStyle}>Удалить</button>
          </div>
        </div>
      </div>
    );
  }

  function renderListRow(t: TableItem) {
    return (
      <div key={t.id} style={{ padding: 12, borderRadius: 10, background: "#fff", boxShadow: "0 6px 18px rgba(15,23,42,0.03)", display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
        <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
          <div style={{ width: 8, height: 40, borderRadius: 6, background: "#e6eef9" }} />
          <div>
            <div style={{ fontWeight: 700 }}>{t.title}</div>
            <div style={{ color: "#64748b", fontSize: 13 }}>{t.description ?? "—"}</div>
          </div>
        </div>

        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <div style={{ color: "#94a3b8", fontSize: 12 }}>{friendlyDate(t.updated_at ?? t.created_at)}</div>
          <button onClick={() => handleQuickEdit(t.id)} style={smallBtnStyle}>Открыть</button>
          <button onClick={() => handleDelete(t.id)} style={smallDangerBtnStyle}>Удалить</button>
        </div>
      </div>
    );
  }
}

// styles
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
