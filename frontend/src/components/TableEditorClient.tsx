// frontend/src/components/TableEditorClient.tsx
"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import Link from "next/link";
import PetalChart from "@/components/PetalChart";
import CategoriesManager from "@/components/CategoriesManager";
import CalendarStrip from "@/components/CalendarStrip";
import { supabase } from "@/lib/supabaseClient";
import { getTableIdClient } from "@/lib/getTableId";

type Category = {
  id: string;
  title: string;
  description?: string | null;
  max?: number | null;
  color?: string | null;
  value: number;
};
type JournalRecord = { id: string; date: string; text: string; category_id: string | null; points: number; created_at: string };

type Props = { tableId?: string | null; serverData?: any };

function safeNum(v: any, fallback = 0) {
  if (v == null) return fallback;
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

export default function TableEditorClient({ tableId: initialTableId, serverData }: Props) {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  // hooks (all declared before any conditional returns)
  const [resolvedTableId, setResolvedTableId] = useState<string | null>(null);
  const [resolving, setResolving] = useState(true);

  const [loading, setLoading] = useState(false);
  const [serverTable, setServerTable] = useState<any | null>(serverData ?? null);
  const [error, setError] = useState<string | null>(null);

  const [categories, setCategories] = useState<Category[]>([]);
  const [addingMap, setAddingMap] = useState<Record<string, boolean>>({});
  const [journalEntries, setJournalEntries] = useState<JournalRecord[]>([]);
  const [journalLoading, setJournalLoading] = useState(false);

  const [selectedDate, setSelectedDate] = useState<Date>(() => new Date());
  const [selectedRange, setSelectedRange] = useState<{ start: string; end: string } | null>(null);

  const unlockTimeoutsRef = useRef<Record<string, number | null>>({});

  // chart size responsive
  const [chartSize, setChartSize] = useState<number>(340);
  useEffect(() => {
    function update() {
      // prefer a slightly padded container width on mobile
      const ww = typeof window !== "undefined" ? window.innerWidth : 360;
      // content padding total ~ 48 (24 left+right) on small screens
      const avail = Math.max(220, ww - 48);
      const size = Math.min(520, Math.max(260, avail, 260, Math.min(360, avail)));
      setChartSize(Math.round(Math.min(360, size)));
    }
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, []);

  // resolve table id robustly
  useEffect(() => {
    setResolving(true);
    const id = getTableIdClient({
      propId: initialTableId ?? null,
      searchParams: (searchParams as unknown) as URLSearchParams,
      pathname: pathname ?? null,
      href: typeof window !== "undefined" ? window.location.href : null,
    });
    setResolvedTableId(id);
    setResolving(false);
  }, [initialTableId, pathname, searchParams]);

  // load header & data when resolved id changes
  useEffect(() => {
    if (!resolvedTableId) {
      setServerTable(serverData ?? null);
      setCategories([]);
      setJournalEntries([]);
      return;
    }

    if (serverData && (serverData.id === resolvedTableId || serverData.ID === resolvedTableId || serverData.table_id === resolvedTableId)) {
      setServerTable(serverData);
    } else {
      (async function () {
        try {
          const { data, error } = await supabase.from("user_tables").select("id,title").eq("id", resolvedTableId).single();
          if (!error && data) setServerTable(data);
        } catch (e) {
          console.warn("fetchTableHeader err", e);
        }
      })();
    }

    fetchAllDataForDate(selectedDate, resolvedTableId).catch((e) => console.warn("fetchAllDataForDate err:", e));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resolvedTableId]);

  useEffect(() => {
    if (!resolvedTableId) return;
    setSelectedRange(null);
    fetchAllDataForDate(selectedDate, resolvedTableId).catch((e) => console.warn("fetchAllDataForDate err:", e));
    const dateIso = selectedDate.toISOString().slice(0, 10);
    window.dispatchEvent(new CustomEvent("tableEditor:refreshCategories", { detail: { dateIso } }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedDate, resolvedTableId]);

  async function fetchAllDataForDate(date: Date, rId: string | null) {
    if (!rId) return;
    setLoading(true);
    setError(null);
    try {
      await fetchCategoriesWithDailyValues(date, rId);
      const dateIso = date.toISOString().slice(0, 10);
      await fetchJournalForDate(dateIso, rId);
    } catch (e: any) {
      console.warn("fetchAllDataForDate error", e);
      setError(String(e?.message ?? e));
    } finally {
      setLoading(false);
    }
  }

  async function fetchCategoriesWithDailyValues(date: Date, rId: string) {
    if (!rId) return;
    const dateIso = date.toISOString().slice(0, 10);
    const { data: cats, error: catErr } = await supabase.from("tables_categories").select("id,title,description,max,color,position").eq("table_id", rId).order("position", { ascending: true });
    if (catErr) throw new Error(catErr.message);
    const { data: entries, error: entriesErr } = await supabase.from("entries").select("category_id, delta, created_at").eq("table_id", rId).gte("created_at", `${dateIso}T00:00:00`).lte("created_at", `${dateIso}T23:59:59`);
    if (entriesErr) console.warn("Failed to load entries for date:", entriesErr);
    const sums: Record<string, number> = {};
    (Array.isArray(entries) ? entries : []).forEach((e: any) => {
      const cid = String(e.category_id);
      const d = safeNum(e.delta, 0);
      sums[cid] = (sums[cid] || 0) + d;
    });
    const normalized = (Array.isArray(cats) ? cats : []).map((c: any, i: number) => ({ id: String(c.id), title: c.title ?? `Цель ${i + 1}`, description: c.description ?? null, max: typeof c.max === "number" ? c.max : null, color: c.color ?? undefined, value: sums[String(c.id)] ?? 0 }));
    setCategories(normalized);
  }

  async function fetchJournalForDate(dateIso: string, rId: string) {
    if (!rId) {
      setJournalEntries([]);
      return;
    }
    setJournalLoading(true);
    setJournalEntries([]);
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
      setJournalEntries(items);
    } catch (e) {
      console.warn("Journal load error", e);
      setJournalEntries([]);
    } finally {
      setJournalLoading(false);
    }
  }

  async function fetchJournalForRange(startIso: string, endIso: string, rId: string) {
    if (!rId) return;
    setJournalLoading(true);
    setJournalEntries([]);
    try {
      const path = `/api/tables/${encodeURIComponent(rId)}/journal?start=${encodeURIComponent(startIso)}&end=${encodeURIComponent(endIso)}`;
      const res = await fetch(path, { credentials: "same-origin" });
      if (!res.ok) {
        const t = await res.text().catch(() => "");
        console.warn("Journal range failed:", res.status, t);
        throw new Error("Journal range error");
      }
      const json = await res.json();
      const items = Array.isArray(json?.data) ? json.data : [];
      setJournalEntries(items);
      setSelectedRange({ start: startIso, end: endIso });
    } catch (e) {
      console.warn("Journal range load error", e);
      setJournalEntries([]);
      setSelectedRange(null);
    } finally {
      setJournalLoading(false);
    }
  }

  // increment/decrement handler (optimistic)
  async function handleAddDelta(categoryId: string, delta: number) {
    const rId = resolvedTableId;
    if (!rId) {
      setError("Не указан идентификатор таблицы.");
      return;
    }
    if (!categoryId) return;
    if (addingMap[categoryId]) return;

    setAddingMap((m) => ({ ...m, [categoryId]: true }));
    if (unlockTimeoutsRef.current[categoryId]) clearTimeout(unlockTimeoutsRef.current[categoryId] as any);
    unlockTimeoutsRef.current[categoryId] = window.setTimeout(() => {
      setAddingMap((m) => {
        const nm = { ...m };
        delete nm[categoryId];
        return nm;
      });
      unlockTimeoutsRef.current[categoryId] = null;
    }, 900);

    setError(null);

    const cat = categories.find((c) => String(c.id) === String(categoryId));
    if (!cat) return;

    const prev = safeNum(cat.value, 0);
    const maxVal = typeof cat.max === "number" ? cat.max : Infinity;
    const newVal = Math.max(0, Math.min(prev + delta, maxVal));
    const actualDelta = newVal - prev;
    if (actualDelta === 0) {
      setAddingMap((m) => {
        const nm = { ...m };
        delete nm[categoryId];
        return nm;
      });
      return;
    }

    const previousCategories = categories.map((c) => ({ ...c }));

    setCategories((prevCats) => prevCats.map((c) => (c.id === categoryId ? { ...c, value: newVal } : c)));

    try {
      const { error: insertErr } = await supabase.from("entries").insert([{ table_id: rId, category_id: categoryId, delta: actualDelta, value: actualDelta, created_at: new Date().toISOString() }]);
      if (insertErr) throw new Error(insertErr.message);

      const dateIso = selectedDate.toISOString().slice(0, 10);
      const text = `${actualDelta > 0 ? "+" : ""}${actualDelta} ${cat.title}`;

      try {
        await fetch(`/api/tables/${encodeURIComponent(rId)}/journal`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ table_id: rId, date: dateIso, text, category_id: categoryId, points: actualDelta }), credentials: "same-origin" });
      } catch {
        // ignore
      }

      window.dispatchEvent(new CustomEvent("tableEditor:refreshCategories", { detail: { dateIso } }));

      if (selectedRange) await fetchJournalForRange(selectedRange.start, selectedRange.end, rId);
      else await fetchJournalForDate(dateIso, rId);
    } catch (e: any) {
      console.error("handleAddDelta error:", e);
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

  // delete category (confirm)
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

  // edit -> emit event (TableEditor modal/manager listens)
  function handleEditCategory(categoryId: string) {
    try {
      window.dispatchEvent(new CustomEvent("tableEditor:editCategory", { detail: { categoryId } }));
    } catch {
      if (resolvedTableId) window.location.href = `/tables/${encodeURIComponent(resolvedTableId)}/edit#category-${encodeURIComponent(categoryId)}`;
    }
  }

  // open create modal helper (used by the new button)
  function openCreateCategoryModal() {
    try {
      // preferred: helper exposed by CategoriesManager (if present)
      const w = window as any;
      if (typeof w.openCategoryManager === "function") {
        w.openCategoryManager();
        return;
      }
      // fallback: dispatch legacy event (tableEditor:editCategory with null means "create")
      window.dispatchEvent(new CustomEvent("tableEditor:editCategory", { detail: { categoryId: null } }));
    } catch (e) {
      console.warn("openCreateCategoryModal failed", e);
    }
  }

  const radarCats = useMemo(() => categories.map((c) => ({ id: c.id, title: c.title, value: safeNum(c.value, 0), max: c.max ?? null, color: c.color ?? undefined })), [categories]);

  if (resolving) return <div style={{ color: "#64748b" }}>Идёт поиск таблицы…</div>;
  if (!resolvedTableId)
    return (
      <div style={{ padding: 24, borderRadius: 12, background: "#fff", boxShadow: "0 8px 24px rgba(15,23,42,0.04)" }}>
        <h2 style={{ marginTop: 0 }}>Таблица не найдена</h2>
        <p style={{ margin: 0, color: "#64748b" }}>Не удалось определить идентификатор таблицы. Проверьте URL — он должен содержать /tables/&lt;uuid&gt;/...</p>
      </div>
    );

  return (
    <div className="table-editor-root" style={{ padding: 12, overflowX: "hidden", boxSizing: "border-box", maxWidth: 1100, margin: "0 auto" }}>
      {error && <div style={{ color: "crimson", marginBottom: 8 }}>Ошибка: {error}</div>}
      <div style={{ display: "grid", gap: 18 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
          <div>
            <h1 style={{ margin: 0, fontSize: 20 }}>{serverTable?.title ?? "Таблица"}</h1>
            <div style={{ color: "#667085", fontSize: 13 }}>{categories.length} целей</div>
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <button onClick={() => fetchAllDataForDate(selectedDate, resolvedTableId)} style={{ padding: "10px 14px", borderRadius: 10, minWidth: 48, fontSize: 14, touchAction: "manipulation" }} aria-label="Обновить данные">
              Обновить
            </button>

            <button onClick={() => openCreateCategoryModal()} style={{ padding: "10px 14px", borderRadius: 10, minWidth: 48, fontSize: 14, touchAction: "manipulation", background: "#0b1720", color: "#fff", fontWeight: 700 }} aria-label="Добавить цель">
              Добавить цель
            </button>

            <button onClick={() => (window.location.href = `/tables/${encodeURIComponent(resolvedTableId)}/journal`)} style={{ padding: "10px 14px", borderRadius: 10, minWidth: 48, fontSize: 14, touchAction: "manipulation" }} aria-label="Открыть журнал">
              Журнал
            </button>
          </div>
        </div>

        <div className="editor-grid" style={{ display: "grid", gap: 18 }}>
          <div className="radar-area" style={{ display: "flex", flexDirection: "column", alignItems: "center", width: "100%", boxSizing: "border-box" }}>
            <div className="calendar-wrapper" style={{ width: "100%", maxWidth: 720, margin: "0 auto 12px", overflowX: "auto", WebkitOverflowScrolling: "touch", boxSizing: "border-box" }}>
              <CalendarStrip selectedDate={selectedDate} onChange={(d: Date) => { setSelectedDate(d); setSelectedRange(null); }} onRange={(startIso: string, endIso: string) => fetchJournalForRange(startIso, endIso, resolvedTableId)} />
            </div>

            <div style={{ width: "100%", display: "flex", justifyContent: "center", alignItems: "center" }}>
              <div style={{ width: "100%", maxWidth: 720, padding: "0 6px", boxSizing: "border-box", margin: "0 auto" }}>
                <PetalChart categories={radarCats} size={chartSize} onAddDelta={handleAddDelta} onEditCategory={(id) => handleEditCategory(String(id))} onSelectCategory={(id) => window.dispatchEvent(new CustomEvent("tableEditor:selectCategory", { detail: { categoryId: id } }))} />
              </div>
            </div>

            <div style={{ width: "100%", maxWidth: 720, marginTop: 12, marginLeft: "auto", marginRight: "auto", boxSizing: "border-box" }}>
              <div style={{ fontSize: 14, color: "#333", marginBottom: 8 }}>{selectedRange ? `Журнал с ${selectedRange.start} по ${selectedRange.end}` : `Журнал за ${selectedDate.toISOString().slice(0, 10)}`}</div>
              <div style={{ display: "grid", gap: 8 }}>
                {journalLoading && <div style={{ color: "#666" }}>Загружаю записи журнала...</div>}
                {!journalLoading && journalEntries.length === 0 && <div style={{ color: "#666" }}>Нет записей.</div>}
                {!journalLoading && journalEntries.slice(0, 3).map((je) => (
                  <div key={je.id} style={{ border: "1px solid #eee", padding: 10, borderRadius: 8, background: "#fff" }}>
                    <div style={{ fontSize: 13, color: "#0b1720" }}>{je.text}</div>
                    <div style={{ marginTop: 6, fontSize: 12, color: "#999" }}>{je.date} • {je.created_at ? new Date(je.created_at).toLocaleTimeString() : ""}</div>
                  </div>
                ))}
                {!journalLoading && journalEntries.length > 3 && <div style={{ color: "#0b66ff", cursor: "pointer" }}><Link href={`/tables/${encodeURIComponent(resolvedTableId)}/journal`}>Открыть полный журнал →</Link></div>}
              </div>
            </div>
          </div>

          <div className="cats-area" style={{ width: "100%", boxSizing: "border-box", padding: "0 6px" }}>
            <div style={{ width: "100%", maxWidth: 720, margin: "0 auto", boxSizing: "border-box" }}>
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

              {/* CategoriesManager mounted (it renders hidden sentinel when not open). */}
              <div style={{ display: "block", marginTop: 12 }}>
                <CategoriesManager
                  tableId={resolvedTableId}
                  selectedDate={selectedDate}
                  onChange={(items) => {
                    const normalized = (items || []).map((r: any) => ({
                      id: String(r.id),
                      title: r.title ?? "",
                      max: typeof r.max === "number" ? r.max : null,
                      value: typeof r.value === "number" ? r.value : 0,
                      color: r.color ?? undefined,
                    }));
                    setCategories(normalized);
                  }}
                  onDelta={handleAddDelta}
                  disabledMap={addingMap}
                />
              </div>
            </div>
          </div>
        </div>
      </div>

      <style jsx>{`
        .table-editor-root * { box-sizing: border-box; min-width: 0; }

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
        .icon-btn { width:40px; height:36px; border-radius:8px; display:inline-flex; align-items:center; justify-content:center; border:1px solid rgba(12,20,30,0.06); background:#fff; color:#0b1720; }
        .text-btn { display:inline-flex; gap:8px; align-items:center; padding:6px 10px; border-radius:8px; border:1px solid rgba(12,20,30,0.06); background:#fff; color:#0b1720; font-size:13px; }
        .text-btn.danger { border-color: rgba(220,20,60,0.12); color:#b91c1c; }

        @media (max-width: 720px) {
          .cat-card { flex-direction: column; align-items:stretch; gap:10px; }
          .cat-controls { align-items:stretch; }
          .ctrl-row { justify-content:space-between; flex-wrap:wrap; }
        }

        button {
          border: 1px solid rgba(12,20,30,0.06);
          background: #fff;
          color: #0b1720;
        }
      `}</style>
    </div>
  );
}
