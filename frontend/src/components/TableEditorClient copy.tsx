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

type Category = { id: string; title: string; description?: string | null; max?: number | null; color?: string | null; value: number };
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

  // resolve id robustly on mount and when pathname/search/prop changes
  useEffect(() => {
    setResolving(true);
    const id = getTableIdClient({
      propId: initialTableId ?? null,
      searchParams: (searchParams as unknown) as URLSearchParams,
      pathname: pathname ?? null,
      href: typeof window !== "undefined" ? window.location.href : null,
    });
    console.debug("[TableEditorClient] resolvedTableId candidate:", { id, initialTableId, pathname, searchParams: searchParams?.toString?.(), href: typeof window !== "undefined" ? window.location.href : null });
    setResolvedTableId(id);
    setResolving(false);
  }, [initialTableId, pathname, searchParams]);

  useEffect(() => {
    if (!resolvedTableId) {
      setServerTable(serverData ?? null);
      setCategories([]);
      setJournalEntries([]);
      return;
    }

    // use serverData when matches id
    if (serverData && (serverData.id === resolvedTableId || serverData.ID === resolvedTableId || serverData.table_id === resolvedTableId)) {
      setServerTable(serverData);
    } else {
      // safe fetch header via supabase if needed
      (async function () {
        try {
          const { data, error } = await supabase.from("user_tables").select("id,title").eq("id", resolvedTableId).single();
          if (!error && data) setServerTable(data);
        } catch (e) {
          console.warn("fetchTableHeader err", e);
        }
      })();
    }

    // fetch categories & journal for selectedDate
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
    if (!rId) {
      console.warn("fetchAllDataForDate: missing rId — skipping");
      return;
    }
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
      console.warn("fetchJournalForDate called without rId", { dateIso });
      setJournalEntries([]);
      return;
    }
    setJournalLoading(true);
    setJournalEntries([]);
    try {
      const path = `/api/tables/${encodeURIComponent(rId)}/journal?date=${encodeURIComponent(dateIso)}`;
      console.debug("[TableEditorClient] fetchJournalForDate ->", path);
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
      console.debug("[TableEditorClient] fetchJournalForRange ->", path);
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
    }, 1000);

    setError(null);

    const cat = categories.find((c) => String(c.id) === String(categoryId));
    if (!cat) return;

    const prev = safeNum(cat.value, 0);
    const maxVal = typeof cat.max === "number" ? cat.max : Infinity;
    const newVal = Math.max(0, Math.min(prev + delta, maxVal));
    const actualDelta = newVal - prev;
    if (actualDelta === 0) return;

    setCategories((prevCats) => prevCats.map((c) => (c.id === categoryId ? { ...c, value: newVal } : c)));

    try {
      const { error: insertErr } = await supabase.from("entries").insert([{ table_id: rId, category_id: categoryId, delta: actualDelta, value: actualDelta, created_at: new Date().toISOString() }]);
      if (insertErr) throw new Error(insertErr.message);

      const dateIso = selectedDate.toISOString().slice(0, 10);
      const text = `${actualDelta > 0 ? "+" : ""}${actualDelta} ${cat.title}`;

      const path = `/api/tables/${encodeURIComponent(rId)}/journal`;
      console.debug("[TableEditorClient] POST journal ->", path, { date: dateIso, text, category_id: categoryId, points: actualDelta });
      const jr = await fetch(path, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ table_id: rId, date: dateIso, text, category_id: categoryId, points: actualDelta }), credentials: "same-origin" });
      if (!jr.ok) {
        const t = await jr.text().catch(() => "");
        console.warn("Failed to create journal entry:", t);
      }

      window.dispatchEvent(new CustomEvent("tableEditor:refreshCategories", { detail: { dateIso } }));

      if (selectedRange) await fetchJournalForRange(selectedRange.start, selectedRange.end, rId);
      else await fetchJournalForDate(dateIso, rId);
    } catch (e: any) {
      console.error("handleAddDelta error:", e);
      setError(String(e?.message ?? e));
      setCategories((prevCats) => prevCats.map((c) => (c.id === categoryId ? { ...c, value: prev } : c)));
    }
  }

  const radarCats = useMemo(() => categories.map((c) => ({ id: c.id, title: c.title, value: safeNum(c.value, 0), max: c.max ?? null, color: c.color ?? undefined })), [categories]);

  if (resolving) return <div style={{ color: "#64748b" }}>Идёт поиск таблицы…</div>;
  if (!resolvedTableId) return <div style={{ padding: 24, borderRadius: 12, background: "#fff", boxShadow: "0 8px 24px rgba(15,23,42,0.04)" }}><h2 style={{ marginTop: 0 }}>Таблица не найдена</h2><p style={{ margin: 0, color: "#64748b" }}>Не удалось определить идентификатор таблицы. Проверьте URL — он должен содержать /tables/&lt;uuid&gt;/...</p></div>;

  return (
    <div className="table-editor-root" style={{ padding: 12 }}>
      {error && <div style={{ color: "crimson", marginBottom: 8 }}>Ошибка: {error}</div>}
      <div style={{ display: "grid", gap: 18, gridTemplateColumns: "1fr", alignItems: "start" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div>
            <h1 style={{ margin: 0, fontSize: 20 }}>{serverTable?.title ?? "Таблица"}</h1>
            <div style={{ color: "#667085", fontSize: 13 }}>{categories.length} целей</div>
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <button onClick={() => fetchAllDataForDate(selectedDate, resolvedTableId)} style={{ padding: "6px 10px", borderRadius: 8 }}>Обновить</button>
            <button onClick={() => (window.location.href = `/tables/${encodeURIComponent(resolvedTableId)}/journal`)} style={{ padding: "6px 10px", borderRadius: 8 }}>Открыть журнал</button>
          </div>
        </div>

        <div className="editor-grid" style={{ display: "grid", gap: 18 }}>
          <div className="radar-area" style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
            <div style={{ width: "100%", maxWidth: 520, marginBottom: 12 }}>
              <CalendarStrip selectedDate={selectedDate} onChange={(d: Date) => { setSelectedDate(d); setSelectedRange(null); }} onRange={(startIso: string, endIso: string) => fetchJournalForRange(startIso, endIso, resolvedTableId)} />
            </div>

            <div style={{ width: "100%", display: "flex", justifyContent: "center", alignItems: "center", minHeight: 380 }}>
              <PetalChart categories={radarCats} size={360} onAddDelta={handleAddDelta} onEditCategory={(id) => window.dispatchEvent(new CustomEvent("tableEditor:editCategory", { detail: { categoryId: id } }))} />
            </div>

            <div style={{ width: "100%", maxWidth: 520, marginTop: 12 }}>
              <div style={{ fontSize: 14, color: "#333", marginBottom: 8 }}>{selectedRange ? `Журнал с ${selectedRange.start} по ${selectedRange.end}` : `Журнал за ${selectedDate.toISOString().slice(0, 10)}`}</div>
              <div style={{ display: "grid", gap: 8 }}>
                {journalLoading && <div style={{ color: "#666" }}>Загружаю записи журнала...</div>}
                {!journalLoading && journalEntries.length === 0 && <div style={{ color: "#666" }}>Нет записей.</div>}
                {!journalLoading && journalEntries.slice(0, 3).map((je) => (<div key={je.id} style={{ border: "1px solid #eee", padding: 10, borderRadius: 8, background: "#fff" }}><div style={{ fontSize: 13, color: "#0b1720" }}>{je.text}</div><div style={{ marginTop: 6, fontSize: 12, color: "#999" }}>{je.date} • {je.created_at ? new Date(je.created_at).toLocaleTimeString() : ""}</div></div>))}
                {!journalLoading && journalEntries.length > 3 && <div style={{ color: "#0b66ff", cursor: "pointer" }}><Link href={`/tables/${encodeURIComponent(resolvedTableId)}/journal`}>Открыть полный журнал →</Link></div>}
              </div>
            </div>
          </div>

          <div className="cats-area">
            <CategoriesManager tableId={resolvedTableId} selectedDate={selectedDate} onChange={(items) => { const normalized = (items || []).map((r: any) => ({ id: String(r.id), title: r.title ?? "", max: typeof r.max === "number" ? r.max : null, value: typeof r.value === "number" ? r.value : 0, color: r.color ?? undefined })); setCategories(normalized); }} onDelta={handleAddDelta} disabledMap={addingMap} />
          </div>
        </div>
      </div>

      <style jsx>{`
        .table-editor-root { max-width: 1100px; margin: 0 auto; }
        @media (min-width: 980px) { .editor-grid { grid-template-columns: 420px 1fr; } }
      `}</style>
    </div>
  );
}
