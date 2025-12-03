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

  const [profile, setProfile] = useState<{ max_tables?: number; tables_limit?: number } | null>(null);

  // Базовый URL бекенда: настройте в Vercel/Render -> NEXT_PUBLIC_API_BASE
  // Примеры:
  // - локально: "/api" — fallback relative
  // - в проде: "https://your-backend.onrender.com"
  const BACKEND_BASE = (process.env.NEXT_PUBLIC_API_BASE || "").replace(/\/+$/, "") || ""; // no trailing slash here
  // Константы endpoint'ов (всегда с завершающим слэшем)
  const TABLES_URL = (BACKEND_BASE ? `${BACKEND_BASE}/api/tables/tables/` : "/api/tables/tables/");
  const PROFILE_URL = (BACKEND_BASE ? `${BACKEND_BASE}/api/auth/profile/` : "/api/auth/profile/");

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

      // log фактический URL — поможет вам увидеть, куда уходит запрос
      console.log("[TablesDashboard] PROFILE_URL ->", PROFILE_URL);

      if (!token) {
        // попытка через Supabase (локально/если нет JWT)
        try {
          const { data: userData } = await supabase.auth.getUser();
          const user = (userData as any)?.user ?? null;
          if (user) {
            const { data: prof, error } = await supabase.from("profiles").select("*").eq("id", user.id).single();
            if (!error && prof) {
              setProfile({ max_tables: Number(prof.max_tables ?? prof.tables_limit ?? 1), tables_limit: Number(prof.tables_limit ?? prof.max_tables ?? 1) });
            }
            return;
          }
        } catch (e) {
          // ignore
        }
        return;
      }

      const res = await fetch(PROFILE_URL, { headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` } });
      if (!res.ok) {
        console.warn("[TablesDashboard] fetchUserProfile failed status:", res.status);
        return;
      }
      const j = await res.json().catch(() => null);
      const prof = j?.profile ?? j?.data ?? j;
      if (prof) {
        setProfile({ max_tables: prof.max_tables ? Number(prof.max_tables) : undefined, tables_limit: prof.tables_limit ? Number(prof.tables_limit) : undefined });
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

      console.log("[TablesDashboard] TABLES_URL ->", TABLES_URL);

      const res = await fetch(TABLES_URL, { headers });
      if (res.status === 405) {
        throw new Error("Method Not Allowed (405) — убедитесь, что backend правильно доступен по TABLES_URL");
      }
      if (!res.ok) {
        const txt = await res.text().catch(() => "");
        throw new Error(`Failed fetching tables (${res.status}): ${txt}`);
      }

      const j = await res.json().catch(() => ({}));
      const arr: any[] = Array.isArray(j?.data) ? j.data : Array.isArray(j) ? j : Array.isArray(j?.tables) ? j.tables : [];

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

      console.log("[TablesDashboard] POST ->", TABLES_URL);

      const res = await fetch(TABLES_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ title: newTitle.trim() }),
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

      if (res.status === 405) {
        throw new Error("Method Not Allowed (405) при POST — проверьте backend роуты и что TABLES_URL указывает на бекенд");
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

      const res = await fetch(`${TABLES_URL}${encodeURIComponent(tableId)}/`, {
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

  // renderCard / renderListRow — как раньше (опущены для краткости в этом фрагменте)
  // ... (оставьте рендеры из существующего файла)

  return (
    <div style={{ maxWidth: 1100, margin: "0 auto", padding: "18px 12px" }}>
      <DuplicateTableModal visible={modalVisible} onClose={() => setModalVisible(false)} existingTable={existingTable} userId={currentUserId} />

      {/* ... остальной UI: заголовок, форма создания и список таблиц — как раньше ... */}

    </div>
  );
}
