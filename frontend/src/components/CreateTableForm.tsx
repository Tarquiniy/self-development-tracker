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
  const [allowedLimit, setAllowedLimit] = useState<number | typeof Infinity | null>(null);
  const [currentCount, setCurrentCount] = useState<number | null>(null);

  const [existingTable, setExistingTable] = useState<any | null>(null);
  const [modalVisible, setModalVisible] = useState(false);

  const router = useRouter();

  useEffect(() => {
    (async () => {
      const { data: sessData } = await supabase.auth.getSession();
      const session = (sessData as any)?.session ?? null;
      const userId = session ? session.user?.id ?? null : ((await supabase.auth.getUser()) as any)?.data?.user?.id ?? null;
      setCurrentUserId(userId);
      if (userId) {
        await Promise.all([fetchProfileFromSupabase(userId), fetchCountFromSupabase(userId)]);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function fetchProfileFromSupabase(userId: string) {
    try {
      const { data, error } = await supabase.from("profiles").select("tables_limit").eq("id", userId).maybeSingle();
      if (error) {
        console.warn("fetchProfileFromSupabase:", error);
        setAllowedLimit(null);
        return;
      }
      const raw = (data as any)?.tables_limit ?? null;
      normalizeAndSetLimit(raw);
    } catch (e) {
      console.warn("fetchProfileFromSupabase failed:", e);
      setAllowedLimit(null);
    }
  }

  async function fetchCountFromSupabase(userId: string) {
    try {
      const res = await supabase.from("user_tables").select("id", { count: "exact" }).eq("owner", userId);
      if (res.error) {
        console.warn("fetchCountFromSupabase error:", res.error);
        setCurrentCount(null);
        return;
      }
      setCurrentCount(typeof res.count === "number" ? res.count : (Array.isArray(res.data) ? (res.data as any[]).length : 0));
    } catch (e) {
      console.warn("fetchCountFromSupabase failed:", e);
      setCurrentCount(null);
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

  function hasReachedLimit(): boolean {
    const limit = allowedLimit === null ? 1 : allowedLimit;
    if (limit === Infinity) return false;
    if (currentCount === null) return false;
    return currentCount >= Number(limit);
  }

  // helper to fetch newest table for user (returns id or null)
  async function fetchNewestTableId(userId: string): Promise<string | null> {
    try {
      const rowsRes = await supabase
        .from("user_tables")
        .select("id,created_at")
        .eq("owner", userId)
        .order("created_at", { ascending: false })
        .limit(1);

      if (rowsRes.error) {
        console.warn("fetchNewestTableId error:", rowsRes.error);
        return null;
      }

      const arr: any[] = Array.isArray(rowsRes.data) ? (rowsRes.data as any[]) : [];
      const row = arr[0] as any | undefined;
      if (!row) return null;

      // Normalise possible id fields (id, table_id, ID, _id...)
      const candidate = row.id ?? row.table_id ?? row.ID ?? row._id ?? null;
      return candidate ? String(candidate) : null;
    } catch (e) {
      console.warn("fetchNewestTableId failed:", e);
      return null;
    }
  }

  async function handleSubmit(e?: React.FormEvent) {
    if (e) e.preventDefault();
    if (!title.trim()) return;

    setCreating(true);
    setError(null);

    // client-side check -> show modal if reached
    if (hasReachedLimit()) {
      setModalVisible(true);
      setCreating(false);
      return;
    }

    try {
      const payload = { title: title.trim(), owner: currentUserId };
      const res = await fetch("/api/tables", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const j = await res.json().catch(() => ({}));
      if (!res.ok) {
        if (res.status === 409 && j?.error === "user_has_table") {
          setExistingTable(j.existing ?? null);
          setModalVisible(true);
          setCreating(false);
          if (currentUserId) await fetchCountFromSupabase(currentUserId);
          return;
        }
        throw new Error(j?.detail ?? j?.error ?? `Ошибка создания таблицы (${res.status})`);
      }

      // success — try to get id
      const createdCandidate = j?.data?.table ?? j?.data ?? j;
      let newId: string | null = null;
      if (createdCandidate) {
        const c = createdCandidate as any;
        newId = String(c?.id ?? c?.ID ?? c?.table_id ?? c?.table?.id ?? c?._id ?? "");
        if (!newId) newId = null;
      }

      // fallback: fetch newest created by user
      if (!newId && currentUserId) {
        newId = await fetchNewestTableId(currentUserId);
      }

      if (currentUserId) await fetchCountFromSupabase(currentUserId);
      setTitle("");
      setCreating(false);

      if (newId) {
        router.push(`/tables/${encodeURIComponent(newId)}`);
      } else {
        console.error("Could not determine created table id. Server response:", j);
        setError("Таблица создана, но не удалось открыть её автоматически — перейдите в «Мои таблицы».");
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
          <button type="submit" disabled={creating} style={{ ...primaryBtnStyle, opacity: creating ? 0.6 : 1 }}>
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
