"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import Link from "next/link";
import CalendarStrip from "@/components/CalendarStrip";
import PetalChart from "@/components/PetalChart";
import { supabase } from "@/lib/supabaseClient";
import { getTableIdClient } from "@/lib/getTableId";

type JournalRow = {
  id: string;
  date: string;
  text: string;
  category_id: string | null;
  points: number;
  created_at: string;
};

type CategoryRow = {
  id: string;
  title: string;
  description?: string | null;
  max: number | null;
  value: number;
  color?: string | undefined;
};

function safeNum(v: any, fallback = 0) {
  if (v == null) return fallback;
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

export default function JournalClient({ tableId: initialTableId }: { tableId?: string | null }) {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  // ── all hooks declared at top
  const [resolvedTableId, setResolvedTableId] = useState<string | null>(null);
  const [resolving, setResolving] = useState(true);

  const [selectedDate, setSelectedDate] = useState<Date>(() => new Date());
  const [selectedRange, setSelectedRange] = useState<{ start: string; end: string } | null>(null);

  const [journalRows, setJournalRows] = useState<JournalRow[]>([]);
  const [journalLoading, setJournalLoading] = useState(false);

  const [categories, setCategories] = useState<CategoryRow[]>([]);
  const [catsLoading, setCatsLoading] = useState(false);

  const [addingMap, setAddingMap] = useState<Record<string, boolean>>({});
  const [error, setError] = useState<string | null>(null);

  const unlockTimeoutsRef = useRef<Record<string, number | null>>({});

  // resolve table id (same logic as TableEditor)
  useEffect(() => {
    setResolving(true);
    const id = getTableIdClient({
      propId: initialTableId ?? null,
      searchParams: searchParams as unknown as URLSearchParams,
      pathname: pathname ?? null,
      href: typeof window !== "undefined" ? window.location.href : null,
    });
    setResolvedTableId(id);
    setResolving(false);
  }, [initialTableId, pathname, searchParams]);

  // fetch categories & journal when table id or date changes
  useEffect(() => {
    if (!resolvedTableId) {
      setCategories([]);
      setJournalRows([]);
      return;
    }

    const dateIso = selectedDate.toISOString().slice(0, 10);
    fetchCategoriesWithDailyValues(selectedDate, resolvedTableId).catch((e) => {
      console.warn("fetchCategoriesWithDailyValues err", e);
      setError(String((e as any)?.message ?? e));
    });
    fetchJournalForDate(dateIso, resolvedTableId).catch((e) => {
      console.warn("fetchJournalForDate err", e);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resolvedTableId, selectedDate]);

  async function fetchCategoriesWithDailyValues(date: Date, rId: string) {
    if (!rId) return;
    setCatsLoading(true);
    try {
      const dateIso = date.toISOString().slice(0, 10);
      const { data: cats, error: catErr } = await supabase
        .from("tables_categories")
        .select("id,title,description,max,color,position")
        .eq("table_id", rId)
        .order("position", { ascending: true });
      if (catErr) throw new Error(catErr.message);

      const { data: entries, error: entriesErr } = await supabase
        .from("entries")
        .select("category_id, delta, created_at")
        .eq("table_id", rId)
        .gte("created_at", `${dateIso}T00:00:00`)
        .lte("created_at", `${dateIso}T23:59:59`);
      if (entriesErr) console.warn("Failed to load entries for date:", entriesErr);

      const sums: Record<string, number> = {};
      (Array.isArray(entries) ? entries : []).forEach((e: any) => {
        const cid = String(e.category_id);
        const d = safeNum(e.delta, 0);
        sums[cid] = (sums[cid] || 0) + d;
      });

      const normalized = (Array.isArray(cats) ? cats : []).map((c: any, i: number) => ({
        id: String(c.id),
        title: c.title ?? `Цель ${i + 1}`,
        description: c.description ?? null,
        max: typeof c.max === "number" ? c.max : null,
        value: sums[String(c.id)] ?? 0,
        color: c.color ?? undefined,
      }));

      setCategories(normalized);
    } finally {
      setCatsLoading(false);
    }
  }

  async function fetchJournalForDate(dateIso: string, rId: string) {
    if (!rId) {
      setJournalRows([]);
      return;
    }
    setJournalLoading(true);
    setJournalRows([]);
    try {
      const path = `/api/tables/${encodeURIComponent(rId)}/journal?date=${encodeURIComponent(dateIso)}`;
      const res = await fetch(path, { credentials: "same-origin" });
      if (!res.ok) {
        const t = await res.text().catch(() => "");
        console.warn("Journal load failed:", res.status, t);
        throw new Error(`Journal load failed: ${res.status}`);
      }
      const json = await res.json();
      const items = Array.isArray(json?.data) ? json.data : [];
      setJournalRows(items);
    } catch (e) {
      console.warn("Journal load error", e);
      setJournalRows([]);
    } finally {
      setJournalLoading(false);
    }
  }

  // optimistic update: set absolute value
  async function handleSetValue(categoryId: string, newValue: number) {
    const rId = resolvedTableId;
    if (!rId) {
      setError("Не указан идентификатор таблицы.");
      return;
    }
    const cat = categories.find((c) => c.id === categoryId);
    if (!cat) return;

    const prev = safeNum(cat.value, 0);
    const maxVal = typeof cat.max === "number" ? cat.max : Infinity;
    const next = Math.max(0, Math.min(newValue, maxVal));
    const delta = next - prev;
    if (delta === 0) return;

    const previousCategories = categories.map((c) => ({ ...c }));

    setCategories((prevCats) => prevCats.map((c) => (c.id === categoryId ? { ...c, value: next } : c)));

    // optimistic throttle/unlock UI
    setAddingMap((m) => ({ ...m, [categoryId]: true }));
    if (unlockTimeoutsRef.current[categoryId]) clearTimeout(unlockTimeoutsRef.current[categoryId] as any);
    unlockTimeoutsRef.current[categoryId] = window.setTimeout(() => {
      setAddingMap((m) => {
        const nm = { ...m };
        delete nm[categoryId];
        return nm;
      });
      unlockTimeoutsRef.current[categoryId] = null;
    }, 700);

    try {
      const { error: insertErr } = await supabase.from("entries").insert([
        { table_id: rId, category_id: categoryId, delta: delta, value: delta, created_at: new Date().toISOString() },
      ]);
      if (insertErr) throw new Error(insertErr.message);

      // best-effort: journal entry
      try {
        const dateIso = selectedDate.toISOString().slice(0, 10);
        const text = `${delta > 0 ? "+" : ""}${delta} ${cat.title}`;
        await fetch(`/api/tables/${encodeURIComponent(rId)}/journal`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ table_id: rId, date: dateIso, text, category_id: categoryId, points: delta }),
          credentials: "same-origin",
        });
      } catch {}

      await fetchCategoriesWithDailyValues(selectedDate, rId);
      const dateIso = selectedDate.toISOString().slice(0, 10);
      await fetchJournalForDate(dateIso, rId);
    } catch (e: any) {
      console.error("handleSetValue error:", e);
      setError(String(e?.message ?? e));
      setCategories(previousCategories);
    } finally {
      setAddingMap((m) => {
        const nm = { ...m };
        delete nm[categoryId];
        return nm;
      });
    }
  }

  async function handleAddDelta(categoryId: string, delta: number) {
    const cat = categories.find((c) => c.id === categoryId);
    if (!cat) return;
    await handleSetValue(categoryId, safeNum(cat.value, 0) + delta);
  }

  async function handleDeleteCategory(categoryId: string) {
    const r = window.confirm("Удалить категорию? Это действие необратимо (записи останутся). Продолжить?");
    if (!r) return;
    if (!resolvedTableId) return;

    try {
      const { error } = await supabase.from("tables_categories").delete().eq("id", categoryId);
      if (error) throw new Error(error.message);
      await fetchCategoriesWithDailyValues(selectedDate, resolvedTableId);
    } catch (e: any) {
      console.error("deleteCategory error:", e);
      setError(String(e?.message ?? e));
    }
  }

  function handleEditCategory(categoryId: string) {
    try {
      window.dispatchEvent(new CustomEvent("tableEditor:editCategory", { detail: { categoryId } }));
    } catch {
      if (resolvedTableId) window.location.href = `/tables/${encodeURIComponent(resolvedTableId)}/edit#category-${encodeURIComponent(categoryId)}`;
    }
  }

  const petalCats = useMemo(
    () =>
      categories.map((c) => ({
        id: c.id,
        title: c.title,
        value: safeNum(c.value, 0),
        max: c.max ?? null,
        color: c.color ?? undefined,
      })),
    [categories]
  );

  // UI guards
  if (resolving) return <div style={{ color: "#64748b" }}>Идёт поиск таблицы…</div>;
  if (!resolvedTableId)
    return (
      <div style={{ padding: 24, borderRadius: 12, background: "#fff", boxShadow: "0 8px 24px rgba(15,23,42,0.04)" }}>
        <h2 style={{ marginTop: 0 }}>Таблица не найдена</h2>
        <p style={{ margin: 0, color: "#64748b" }}>Не удалось определить идентификатор таблицы. Проверьте URL.</p>
      </div>
    );

  // render
  return (
    <div className="journal-root" style={{ padding: 12, overflowX: "hidden", boxSizing: "border-box", maxWidth: 1100, margin: "0 auto" }}>
      {error && <div style={{ color: "crimson", marginBottom: 8 }}>Ошибка: {error}</div>}

      <div style={{ display: "grid", gap: 18 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div>
            <h1 style={{ margin: 0, fontSize: 20 }}>Журнал</h1>
            <div style={{ color: "#667085", fontSize: 13 }}>{categories.length} целей</div>
          </div>

          <div style={{ display: "flex", gap: 8 }}>

            <Link href={`/tables/${encodeURIComponent(resolvedTableId)}`}>
              <a className="btn">Открыть таблицу</a>
            </Link>
          </div>
        </div>

        <div style={{ width: "100%", maxWidth: 720, margin: "0 auto" }}>
          <CalendarStrip
            selectedDate={selectedDate}
            onChange={(d: Date) => {
              setSelectedDate(d);
              setSelectedRange(null);
            }}
            onRange={(startIso: string, endIso: string) => {
              setSelectedRange({ start: startIso, end: endIso });
              fetchJournalForDate(startIso, resolvedTableId).catch(() => {});
            }}
          />
        </div>

        <div style={{ display: "flex", justifyContent: "center" }}>
          <div style={{ width: "100%", maxWidth: 520, padding: "0 6px", boxSizing: "border-box" }}>
            <PetalChart categories={petalCats} size={340} onAddDelta={handleAddDelta} />
          </div>
        </div>

        <div style={{ width: "100%", maxWidth: 720, margin: "0 auto" }}>
          <div style={{ fontSize: 14, color: "#333", marginBottom: 8 }}>
            {selectedRange ? `Журнал с ${selectedRange.start} по ${selectedRange.end}` : `Журнал за ${selectedDate.toISOString().slice(0, 10)}`}
          </div>

          <div style={{ display: "grid", gap: 8 }}>
            {journalLoading && <div style={{ color: "#666" }}>Загружаю записи журнала...</div>}
            {!journalLoading && journalRows.length === 0 && <div style={{ color: "#666" }}>Нет записей.</div>}
            {!journalLoading &&
              journalRows.slice(0, 5).map((je) => (
                <div key={je.id} className="entry">
                  <div className="entry-text">{je.text}</div>
                  <div className="entry-meta">{je.date} • {je.created_at ? new Date(je.created_at).toLocaleTimeString() : ""}</div>
                </div>
              ))}
          </div>
        </div>

        <div style={{ width: "100%", boxSizing: "border-box", padding: "0 6px", maxWidth: 720, margin: "0 auto" }}>
          <h2 style={{ marginTop: 12, marginBottom: 8 }}>Цели</h2>

          {catsLoading && <div style={{ color: "#666" }}>Загружаю цели...</div>}
          {!catsLoading && categories.length === 0 && <div style={{ color: "#666" }}>Нет целей.</div>}

          <div style={{ display: "grid", gap: 12 }}>
            {categories.map((c) => {
              const isAdding = !!addingMap[c.id];
              return (
                <div key={c.id} className="cat-card">
                  <div className="cat-mid">
                    <div className="cat-title">{c.title}</div>
                    {c.description ? <div className="cat-desc">{c.description}</div> : null}
                    <div className="cat-meta">{c.max ? `Цель: ${c.max}` : "без лимита"}</div>
                  </div>

                  <div className="cat-controls">
                    <div className="ctrl-row">
                      <button className="icon-btn" aria-label="minus" onClick={() => handleAddDelta(c.id, -1)} disabled={isAdding}>
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden focusable="false"><rect x="4" y="11" width="16" height="2" rx="1" fill="currentColor"/></svg>
                      </button>

                      <div style={{ width: 56, textAlign: "center", fontWeight: 700, color: "#0b1720" }}>
                        {c.value ?? 0}
                      </div>

                      <button className="icon-btn" aria-label="plus" onClick={() => handleAddDelta(c.id, +1)} disabled={isAdding}>
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden focusable="false"><path d="M11 5v14M5 11h14" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
                      </button>
                    </div>

                    <div className="ctrl-row small-actions">
                      <button className="text-btn" onClick={() => handleEditCategory(c.id)} title="Редактировать категорию">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden focusable="false"><path d="M3 21l3-1 11-11 1-3-3 1L4 20v1z" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round"/></svg>
                        <span>Ред.</span>
                      </button>

                      <button className="text-btn danger" onClick={() => handleDeleteCategory(c.id)} title="Удалить категорию">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden focusable="false"><path d="M3 6h18M8 6v12a2 2 0 002 2h4a2 2 0 002-2V6M10 6V4a2 2 0 012-2h0a2 2 0 012 2v2" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round"/></svg>
                        <span>Удал.</span>
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      <style jsx>{`
        .journal-root * { box-sizing: border-box; min-width: 0; }

        .btn {
          padding: 8px 12px;
          border-radius: 10px;
          border: 1px solid rgba(12,20,30,0.06);
          background: #fff;
          color: #0b1720;
          text-decoration: none;
          display: inline-flex;
          align-items: center;
          gap: 8px;
        }
        .entry {
          border-radius: 10px;
          padding: 12px;
          background: #fff;
          box-shadow: 0 6px 18px rgba(12,20,30,0.03);
          border: 1px solid rgba(12,20,30,0.04);
        }
        .entry-text { font-size: 14px; color: #0b1720; margin-bottom: 6px; }
        .entry-meta { font-size: 12px; color: #8892a6; }

        .cat-card {
          display:flex;
          gap:12px;
          align-items:flex-start;
          padding:12px;
          border-radius:12px;
          background: linear-gradient(180deg, #ffffff, #fbfdff);
          box-shadow: 0 8px 24px rgba(15,23,42,0.04);
          border: 1px solid rgba(12,20,30,0.04);
        }
        .cat-mid { flex:1 1 auto; min-width:0; }
        .cat-title { font-size:15px; color:#0b1720; font-weight:600; margin-bottom:6px; word-break:break-word; }
        .cat-desc { font-size:13px; color:#667085; margin-bottom:6px; }
        .cat-meta { font-size:12px; color:#8892a6; }

        .cat-controls { flex:0 0 auto; display:flex; flex-direction:column; gap:8px; align-items:flex-end; }

        .ctrl-row { display:flex; gap:8px; align-items:center; }
        .icon-btn {
          width:40px;
          height:36px;
          border-radius:8px;
          display:inline-flex;
          align-items:center;
          justify-content:center;
          border:1px solid rgba(12,20,30,0.06);
          background:#fff;
          color:#0b1720;
        }

        .text-btn {
          display:inline-flex;
          gap:8px;
          align-items:center;
          padding:6px 10px;
          border-radius:8px;
          border:1px solid rgba(12,20,30,0.06);
          background:#fff;
          color:#0b1720;
          font-size:13px;
        }
        .text-btn span { font-size:13px; }
        .text-btn.danger { border-color: rgba(220,20,60,0.12); color:#b91c1c; }

        @media (max-width: 640px) {
          .cat-card { flex-direction: column; align-items:stretch; gap:10px; }
          .cat-controls { align-items:stretch; }
          .ctrl-row { justify-content:space-between; flex-wrap:wrap; }
        }

        @media (min-width: 980px) {
          .journal-root { padding-left:16px; padding-right:16px; }
        }
      `}</style>
    </div>
  );
}
