// frontend/src/components/CreateTableForm.tsx
"use client";

import React, { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import DuplicateTableModal from "@/components/DuplicateTableModal";
import { useRouter } from "next/navigation";

export default function CreateTableForm(): React.ReactElement {
  const [title, setTitle] = useState("");
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [allowedLimit, setAllowedLimit] = useState<number | typeof Infinity | null>(null);
  const [existingTable, setExistingTable] = useState<any | null>(null);
  const [modalVisible, setModalVisible] = useState(false);

  const router = useRouter();

  useEffect(() => {
    (async () => {
      const sess = await supabase.auth.getSession();
      const session = (sess as any)?.data?.session ?? null;
      const token = session ? (session as any)?.access_token ?? null : null;
      const userId = session ? session.user?.id ?? null : ((await supabase.auth.getUser()) as any)?.data?.user?.id ?? null;
      setCurrentUserId(userId);
      setAccessToken(token);
      await fetchProfile(token);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function fetchProfile(token?: string | null) {
    try {
      const headers: Record<string, string> = { "Content-Type": "application/json" };
      if (token) headers["Authorization"] = `Bearer ${token}`;
      const res = await fetch("/api/auth/profile/", { headers });
      if (!res.ok) {
        const res2 = await fetch("/api/auth/profile", { headers }).catch(() => null);
        if (!res2 || !res2.ok) {
          setAllowedLimit(null);
          return;
        } else {
          const j = await res2.json().catch(() => ({}));
          const p = j?.data ?? j?.profile ?? j;
          normalizeAndSetLimit(p?.tables_limit);
          return;
        }
      }
      const j = await res.json().catch(() => ({}));
      const p = j?.data ?? j?.profile ?? j;
      normalizeAndSetLimit(p?.tables_limit);
    } catch {
      setAllowedLimit(null);
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

  // Fetch current count to show on the form
  const [currentCount, setCurrentCount] = useState<number | null>(null);
  useEffect(() => {
    if (currentUserId !== null) fetchCount();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentUserId]);

  async function fetchCount() {
    try {
      const res = await fetch("/api/user/tables", {
        headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : undefined,
      });
      if (!res.ok) {
        // fallback to public /api/tables
        const res2 = await fetch("/api/tables");
        if (!res2.ok) {
          setCurrentCount(null);
          return;
        }
        const j2 = await res2.json().catch(() => ({}));
        const arr2 = Array.isArray(j2?.data) ? j2.data : [];
        setCurrentCount(arr2.length);
        return;
      }
      const j = await res.json().catch(() => ({}));
      const arr = Array.isArray(j?.data) ? j.data : [];
      setCurrentCount(arr.length);
    } catch {
      setCurrentCount(null);
    }
  }

  function hasReachedLimit(): boolean {
    const limit = allowedLimit === null ? 1 : allowedLimit;
    if (limit === Infinity) return false;
    if (currentCount === null) return false; // unknown count -> allow (server will protect)
    return currentCount >= Number(limit);
  }

  async function handleSubmit(e?: React.FormEvent) {
    if (e) e.preventDefault();
    if (!title.trim()) return;
    setCreating(true);
    setError(null);

    // client-side check
    if (hasReachedLimit()) {
      setModalVisible(true);
      setCreating(false);
      return;
    }

    try {
      const payload = { title: title.trim(), owner: currentUserId };
      const headers: Record<string, string> = { "Content-Type": "application/json" };
      if (accessToken) headers.Authorization = `Bearer ${accessToken}`;

      const res = await fetch("/api/tables", {
        method: "POST",
        headers,
        body: JSON.stringify(payload),
      });

      const j = await res.json().catch(() => ({}));
      if (res.status === 409 && j?.error === "user_has_table") {
        setExistingTable(j.existing ?? null);
        setModalVisible(true);
        setCreating(false);
        await fetchCount();
        return;
      }

      if (!res.ok) {
        throw new Error(j?.detail ?? j?.error ?? "Ошибка создания таблицы");
      }

      const created = j?.data?.table ?? j?.data ?? j;
      await fetchCount();
      setTitle("");
      setCreating(false);

      if (created && created.id) {
        router.push(`/tables/${created.id}`);
      } else {
        // go back to tables list
        router.push("/tables");
      }
    } catch (e: any) {
      setError(String(e?.message ?? e));
      setCreating(false);
    }
  }

  return (
    <div style={{ maxWidth: 720 }}>
      <DuplicateTableModal visible={modalVisible} onClose={() => setModalVisible(false)} existingTable={existingTable} userId={currentUserId} />

      <form onSubmit={handleSubmit} style={{ display: "grid", gap: 12 }}>
        <label>
          Название таблицы
          <input value={title} onChange={(e) => setTitle(e.target.value)} style={{ width: "100%", padding: 10, borderRadius: 8, border: "1px solid #e5e7eb" }} />
        </label>

        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <button type="submit" disabled={creating} style={{ ...primaryBtnStyle, opacity: creating || hasReachedLimit() ? 0.6 : 1 }}>
            {creating ? "Создаём..." : "Создать таблицу"}
          </button>

          <div style={{ color: "#64748b", fontSize: 13 }}>
            Лимит: {allowedLimit === Infinity ? "∞" : allowedLimit === null ? "неизвестен" : allowedLimit} • Создано: {currentCount ?? "?"}
          </div>
        </div>

        {error && <div style={{ color: "crimson" }}>{error}</div>}
      </form>
    </div>
  );
}

const primaryBtnStyle: React.CSSProperties = {
  padding: "10px 14px",
  borderRadius: 10,
  border: "none",
  background: "#0f1724",
  color: "#fff",
  fontWeight: 700,
  cursor: "pointer",
};
