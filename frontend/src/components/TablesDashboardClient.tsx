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
      const userId =
        session
          ? session.user?.id ?? null
          : ((await supabase.auth.getUser()) as any)?.data?.user?.id ?? null;

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
      const { data, error } = await supabase.from("profiles").select("tables_limit").eq("id", userId).maybeSingle();

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
      const tablesRes = await supabase.from("user_tables").select("id", { count: "exact" }).eq("owner", userId);

      if (tablesRes.error) {
        console.warn("fetchTablesFromSupabase error (count):", tablesRes.error);
        // fallback to public fetch
        await fetchTables();
        return [];
      }

      const count =
        typeof tablesRes.count === "number" ? tablesRes.count : Array.isArray(tablesRes.data) ? tablesRes.data.length : 0;
      setCurrentCount(count);

      // fetch actual rows to display (ordered newest first)
      const rowsRes = await supabase.from("user_tables").select("*").eq("owner", userId).order("created_at", { ascending: false });

      if (rowsRes.error) {
        console.warn("rowsRes error:", rowsRes.error);
        setTables([]);
        return [];
      } else {
        const arr = Array.isArray(rowsRes.data) ? rowsRes.data : [];
        const normalized: TableItem[] = arr
          .map((t: any) => ({
            id: String(t?.id ?? t?.table_id ?? t?.ID ?? ""),
            title: t?.title ?? "Без названия",
            description: t?.description ?? null,
            categories: t?.categories ?? [],
            updated_at: t?.updated_at ?? t?.created_at ?? undefined,
            owner: t?.owner ?? null,
            created_at: t?.created_at ?? null,
            user_id: t?.user_id ?? null,
          }))
          .filter((x) => Boolean(x.id));
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
      const normalized: TableItem[] = arr
        .map((t: any) => ({
          id: String(t?.id ?? t?.table_id ?? t?.ID ?? ""),
          title: t?.title ?? "Без названия",
          description: t?.description ?? null,
          categories: t?.categories ?? [],
          updated_at: t?.updated_at ?? t?.created_at ?? undefined,
          owner: t?.owner ?? null,
          created_at: t?.created_at ?? null,
          user_id: t?.user_id ?? null,
        }))
        .filter((x) => Boolean(x.id));
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
        newId = String(
          createdCandidate?.id ??
            createdCandidate?.ID ??
            createdCandidate?.table_id ??
            createdCandidate?.table?.id ??
            createdCandidate?.table?.ID ??
            createdCandidate?._id ??
            ""
        );
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
    <div className="tables-dashboard">
      <DuplicateTableModal
        visible={modalVisible}
        onClose={() => setModalVisible(false)}
        existingTable={existingTable}
        userId={currentUserId}
      />

      <div className="header-row">
        <div className="heading">
          <h1>Мои таблицы</h1>
          <div className="heading-sub">Управление вашими таблицами</div>
        </div>

        <div className="controls">
          <input
            className="search-input"
            placeholder="Поиск таблиц..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            aria-label="Поиск таблиц"
          />

          <select className="select" value={sortBy} onChange={(e) => setSortBy(e.target.value as any)}>
            <option value="recent">Сначала недавно</option>
            <option value="alpha">По названию</option>
          </select>

          <button className="toggle-view" onClick={() => setView(view === "grid" ? "list" : "grid")}>
            {view === "grid" ? "Список" : "Плитка"}
          </button>
        </div>
      </div>

      {/* создание */}
      <div className="create-row">
        <input
          className="create-input"
          placeholder="Название новой таблицы"
          value={newTitle}
          onChange={(e) => setNewTitle(e.target.value)}
        />
        <button className="primary-btn" onClick={handleCreate} disabled={creating}>
          {creating ? "Создаём..." : "Создать таблицу"}
        </button>
      </div>

      {allowedLimit !== null && (
        <div className="limit-info">Лимит таблиц: {allowedLimit === Infinity ? "∞" : allowedLimit} • Создано: {currentCount ?? tables.length}</div>
      )}

      {error && <div className="error-text">{error}</div>}

      {loading ? (
        <div className="muted">Загрузка...</div>
      ) : filtered.length === 0 ? (
        <div className="empty-state">
          <h3>Таблицы не найдены</h3>
          <p>У вас пока нет таблиц. Создайте первую таблицу через форму выше.</p>
        </div>
      ) : view === "grid" ? (
        <div className="cards-grid">{filtered.map((t) => renderCard(t))}</div>
      ) : (
        <div className="list-grid">{filtered.map((t) => renderListRow(t))}</div>
      )}

      <style jsx>{`
        .tables-dashboard {
          width: 100%;
          max-width: 1100px;
          margin: 0 auto;
          padding: 18px 12px;
          box-sizing: border-box;
        }

        .header-row {
          display: flex;
          gap: 12px;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 18px;
          flex-direction: column;
        }
        .heading h1 { margin: 0; font-size: 22px; }
        .heading-sub { color: #64748b; font-size: 13px; margin-top: 6px; }

        .controls {
          display: flex;
          gap: 8px;
          align-items: center;
          width: 100%;
          margin-top: 12px;
        }

        .search-input {
          flex: 1 1 auto;
          padding: 8px;
          border-radius: 8px;
          border: 1px solid #e6eef9;
          min-width: 0;
        }

        .select {
          padding: 8px;
          border-radius: 8px;
          border: 1px solid #e6eef9;
          background: white;
        }

        .toggle-view {
          padding: 8px 10px;
          border-radius: 8px;
          border: 1px solid #e6eef9;
          background: white;
          cursor: pointer;
        }

        .create-row {
          margin-bottom: 16px;
          display: flex;
          gap: 8px;
          align-items: center;
          flex-direction: column;
        }
        .create-input {
          padding: 10px;
          border-radius: 10px;
          border: 1px solid #e5e7eb;
          width: 100%;
          box-sizing: border-box;
        }
        .primary-btn {
          padding: 10px 14px;
          border-radius: 10px;
          border: none;
          background: #0f1724;
          color: #fff;
          font-weight: 700;
          cursor: pointer;
          width: 100%;
          box-sizing: border-box;
        }

        .limit-info { margin-bottom: 8px; color: #64748b; font-size: 13px; }

        .error-text { color: crimson; margin-bottom: 12px; }

        .muted { color: #64748b; }

        .empty-state {
          padding: 24px;
          border-radius: 12px;
          background: #fff;
          box-shadow: 0 8px 24px rgba(15,23,42,0.04);
        }
        .empty-state h3 { margin-top: 0; }

        /* cards grid: 1 col mobile, 2 col tablet, 3 col desktop */
        .cards-grid {
          display: grid;
          grid-template-columns: 1fr;
          gap: 12px;
        }
        .list-grid {
          display: grid;
          gap: 10px;
        }

        @media (min-width: 640px) {
          .header-row { flex-direction: row; }
          .controls { width: auto; margin-top: 0; }
          .create-row { flex-direction: row; }
          .create-input { flex: 1 1 auto; }
          .primary-btn { width: auto; }
          .cards-grid { grid-template-columns: repeat(2, 1fr); }
        }
        @media (min-width: 1024px) {
          .cards-grid { grid-template-columns: repeat(3, 1fr); }
          .tables-dashboard { padding: 24px; }
        }

        /* card/list styles reused by renderCard / renderListRow via element selectors */
        .card-item {
          padding: 14px;
          border-radius: 12px;
          background: #fff;
          box-shadow: 0 8px 24px rgba(15,23,42,0.04);
          display: flex;
          flex-direction: column;
          justify-content: space-between;
          box-sizing: border-box;
        }
        .card-title { font-weight: 700; margin-bottom: 6px; word-break: break-word; }
        .card-desc { color: #667085; font-size: 13px; min-height: 38px; word-break: break-word; }

        .card-footer {
          display: flex;
          justify-content: space-between;
          margin-top: 12px;
          gap: 8px;
          align-items: center;
        }

        .list-row {
          padding: 12px;
          border-radius: 10px;
          background: #fff;
          box-shadow: 0 6px 18px rgba(15,23,42,0.03);
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 12px;
          box-sizing: border-box;
          flex-wrap: wrap;
        }
        .list-left { display:flex; gap:12px; align-items:center; min-width:0; }
        .list-left .meta { font-weight:700; word-break: break-word; }

        .small-actions { display:flex; gap:8px; align-items:center; }

        .small-btn {
          padding: 6px 10px;
          border-radius: 8px;
          border: 1px solid #e6e7eb;
          background: #fff;
          cursor: pointer;
          min-width: 64px;
        }
        .small-danger {
          border: 1px solid rgba(220, 38, 38, 0.12);
          color: #dc2626;
        }
      `}</style>
    </div>
  );

  function renderCard(t: TableItem) {
    return (
      <article key={t.id} className="card-item">
        <div>
          <div className="card-title">{t.title}</div>
          <div className="card-desc">{t.description ?? "—"}</div>
        </div>

        <div className="card-footer">
          <div style={{ color: "#94a3b8", fontSize: 12 }}>{friendlyDate(t.updated_at ?? t.created_at)}</div>
          <div style={{ display: "flex", gap: 8 }}>
            <button className="small-btn" onClick={() => handleQuickEdit(t.id)}>Открыть</button>
            <button className="small-btn small-danger" onClick={() => handleDelete(t.id)}>Удалить</button>
          </div>
        </div>
      </article>
    );
  }

  function renderListRow(t: TableItem) {
    return (
      <div key={t.id} className="list-row">
        <div className="list-left">
          <div style={{ width: 8, height: 40, borderRadius: 6, background: "#e6eef9" }} />
          <div style={{ minWidth: 0 }}>
            <div className="meta">{t.title}</div>
            <div style={{ color: "#64748b", fontSize: 13 }}>{t.description ?? "—"}</div>
          </div>
        </div>

        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <div style={{ color: "#94a3b8", fontSize: 12 }}>{friendlyDate(t.updated_at ?? t.created_at)}</div>
          <div className="small-actions">
            <button className="small-btn" onClick={() => handleQuickEdit(t.id)}>Открыть</button>
            <button className="small-btn small-danger" onClick={() => handleDelete(t.id)}>Удалить</button>
          </div>
        </div>
      </div>
    );
  }
}
