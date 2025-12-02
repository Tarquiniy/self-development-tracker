// frontend/src/components/TableEditorClient.tsx
"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import PetalChart from "@/components/PetalChart";
import CategoriesManager from "@/components/CategoriesManager";
import CalendarStrip from "@/components/CalendarStrip";
import { supabase } from "@/lib/supabaseClient";

type Category = {
  id: string;
  title: string;
  description?: string | null;
  max?: number | null;
  color?: string | null;
  value: number; // daily value (computed via SUM(delta))
};

type JournalRecord = {
  id: string;
  date: string;
  text: string;
  category_id: string | null;
  points: number;
  created_at: string;
};

type Props = { tableId: string; serverData?: any }; // <-- serverData добавлен как опциональный

function safeNum(v: any, fallback = 0) {
  if (v == null) return fallback;
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

export default function TableEditorClient({ tableId, serverData }: Props) {
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

  // === INITIAL LOAD ===
  useEffect(() => {
    // если серверные данные были переданы — используем
    if (serverData) setServerTable(serverData);
    fetchTableHeader();
    fetchAllDataForDate(selectedDate);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tableId]);

  // === ON DATE CHANGE ===
  useEffect(() => {
    setSelectedRange(null);
    fetchAllDataForDate(selectedDate);

    const dateIso = selectedDate.toISOString().slice(0, 10);
    window.dispatchEvent(
      new CustomEvent("tableEditor:refreshCategories", {
        detail: { dateIso },
      })
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedDate]);

  // === LOAD TABLE HEADER ===
  async function fetchTableHeader() {
    try {
      const { data, error } = await supabase
        .from("user_tables")
        .select("id,title")
        .eq("id", tableId)
        .single();

      if (!error && data) setServerTable(data);
    } catch (e) {
      // ignore - not critical
      console.warn("fetchTableHeader:", e);
    }
  }

  // === LOAD EVERYTHING FOR SELECTED DATE ===
  async function fetchAllDataForDate(date: Date) {
    setLoading(true);
    setError(null);

    try {
      await fetchCategoriesWithDailyValues(date);

      const dateIso = date.toISOString().slice(0, 10);
      await fetchJournalForDate(dateIso);
    } catch (e: any) {
      setError(String(e?.message ?? e));
    } finally {
      setLoading(false);
    }
  }

  // === LOAD CATEGORIES + DAILY SUMS (client-side aggregation) ===
  async function fetchCategoriesWithDailyValues(date: Date) {
    const dateIso = date.toISOString().slice(0, 10);

    // 1. Categories
    const { data: cats, error: catErr } = await supabase
      .from("tables_categories")
      .select("id,title,description,max,color")
      .eq("table_id", tableId)
      .order("position", { ascending: true });

    if (catErr) throw new Error(catErr.message);

    // 2. Load entries for date (no server-side grouping to avoid .group type issues)
    const { data: entries, error: entriesErr } = await supabase
      .from("entries")
      .select("category_id, delta, created_at")
      .eq("table_id", tableId)
      .gte("created_at", `${dateIso}T00:00:00`)
      .lte("created_at", `${dateIso}T23:59:59`);

    if (entriesErr) {
      // если ошибка — логируем, но продолжаем (сума будет нулевой)
      console.warn("Failed to load entries for date:", entriesErr);
    }

    // 3. Aggregate in JS
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
      color: c.color ?? undefined,
      value: sums[String(c.id)] ?? 0,
    }));

    setCategories(normalized);
  }

  // === LOAD JOURNAL FOR SINGLE DATE ===
  async function fetchJournalForDate(dateIso: string) {
    setJournalLoading(true);
    setJournalEntries([]);

    try {
      const res = await fetch(
        `/api/tables/${encodeURIComponent(tableId)}/journal?date=${encodeURIComponent(dateIso)}`
      );

      if (!res.ok) throw new Error("Journal load failed");
      const json = await res.json();
      setJournalEntries(Array.isArray(json?.data) ? json.data : []);
    } catch (e) {
      console.warn("Journal load error", e);
      setJournalEntries([]);
    } finally {
      setJournalLoading(false);
    }
  }

  // === LOAD JOURNAL FOR RANGE ===
  async function fetchJournalForRange(startIso: string, endIso: string) {
    setJournalLoading(true);
    setJournalEntries([]);
    try {
      const res = await fetch(
        `/api/tables/${encodeURIComponent(tableId)}/journal?start=${startIso}&end=${endIso}`
      );
      if (!res.ok) throw new Error("Journal range error");

      const json = await res.json();
      setJournalEntries(Array.isArray(json?.data) ? json.data : []);
      setSelectedRange({ start: startIso, end: endIso });
    } catch (e) {
      console.warn("Journal range load error", e);
      setJournalEntries([]);
      setSelectedRange(null);
    } finally {
      setJournalLoading(false);
    }
  }

  // === HANDLE ADD/REMOVE VALUE ===
  async function handleAddDelta(categoryId: string, delta: number) {
    if (!categoryId) return;
    if (addingMap[categoryId]) return;

    // lock button 1 second
    setAddingMap((m) => ({ ...m, [categoryId]: true }));
    if (unlockTimeoutsRef.current[categoryId]) {
      clearTimeout(unlockTimeoutsRef.current[categoryId] as any);
    }
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

    // optimistic update
    setCategories((prevCats) =>
      prevCats.map((c) => (c.id === categoryId ? { ...c, value: newVal } : c))
    );

    try {
      // === 1) Insert delta into entries ===
      const { error: insertErr } = await supabase.from("entries").insert([
        {
          table_id: tableId,
          category_id: categoryId,
          delta: actualDelta,
          value: actualDelta,
          created_at: new Date().toISOString(),
        },
      ]);
      if (insertErr) throw new Error(insertErr.message);

      // === 2) Insert into journal_entries ===
      const dateIso = selectedDate.toISOString().slice(0, 10);
      const text = `${actualDelta > 0 ? "+" : ""}${actualDelta} ${cat.title}`;

      const jr = await fetch(`/api/tables/${encodeURIComponent(tableId)}/journal`, {
        method: "POST",
        body: JSON.stringify({
          date: dateIso,
          text,
          category_id: categoryId,
          points: actualDelta,
        }),
      });

      if (!jr.ok) {
        const t = await jr.text().catch(() => "");
        console.warn("Failed to create journal entry:", t);
      }

      // === 3) Refresh categories (daily sums) ===
      window.dispatchEvent(
        new CustomEvent("tableEditor:refreshCategories", {
          detail: { dateIso },
        })
      );

      // === 4) Refresh journal ===
      if (selectedRange) {
        await fetchJournalForRange(selectedRange.start, selectedRange.end);
      } else {
        await fetchJournalForDate(dateIso);
      }
    } catch (e: any) {
      console.error("handleAddDelta error:", e);
      setError(String(e?.message ?? e));
      // rollback
      setCategories((prevCats) =>
        prevCats.map((c) => (c.id === categoryId ? { ...c, value: prev } : c))
      );
    }
  }

  // === PETAL-CHART DATA ===
  const radarCats = useMemo(
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

  return (
    <div className="table-editor-root" style={{ padding: 12 }}>
      {error && (
        <div style={{ color: "crimson", marginBottom: 8 }}>Ошибка: {error}</div>
      )}

      <div
        style={{
          display: "grid",
          gap: 18,
          gridTemplateColumns: "1fr",
          alignItems: "start",
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <div>
            <h1 style={{ margin: 0, fontSize: 20 }}>
              {serverTable?.title ?? "Таблица"}
            </h1>
            <div style={{ color: "#667085", fontSize: 13 }}>
              {categories.length} целей
            </div>
          </div>

          <button onClick={() => fetchAllDataForDate(selectedDate)} style={{ padding: "6px 10px", borderRadius: 8 }}>
            Обновить
          </button>
        </div>

        <div className="editor-grid" style={{ display: "grid", gap: 18 }}>
          {/* LEFT SECTION */}
          <div className="radar-area" style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
            {/* DATE PICKER */}
            <div style={{ width: "100%", maxWidth: 520, marginBottom: 12 }}>
              <CalendarStrip
                selectedDate={selectedDate}
                onChange={(d: Date) => {
                  setSelectedDate(d);
                  setSelectedRange(null);
                }}
                onRange={(startIso: string, endIso: string) => {
                  fetchJournalForRange(startIso, endIso);
                }}
              />
            </div>

            {/* RADAR */}
            <div style={{ width: "100%", display: "flex", justifyContent: "center", alignItems: "center", minHeight: 380 }}>
              <PetalChart
                categories={radarCats}
                size={360}
                onAddDelta={handleAddDelta}
                onEditCategory={(id) => {
                  window.dispatchEvent(new CustomEvent("tableEditor:editCategory", { detail: { categoryId: id } }));
                }}
              />
            </div>

            {/* JOURNAL PREVIEW */}
            <div style={{ width: "100%", maxWidth: 520, marginTop: 12 }}>
              <div style={{ fontSize: 14, color: "#333", marginBottom: 8 }}>
                {selectedRange ? `Журнал с ${selectedRange.start} по ${selectedRange.end}` : `Журнал за ${selectedDate.toISOString().slice(0, 10)}`}
              </div>

              <div style={{ display: "grid", gap: 8 }}>
                {journalLoading && <div style={{ color: "#666" }}>Загружаю записи журнала...</div>}

                {!journalLoading && journalEntries.length === 0 && <div style={{ color: "#666" }}>Нет записей.</div>}

                {!journalLoading && journalEntries.slice(0, 3).map((je) => (
                  <div key={je.id} style={{ border: "1px solid #eee", padding: 10, borderRadius: 8, background: "#fff" }}>
                    <div style={{ fontSize: 13, color: "#0b1720" }}>{je.text}</div>
                    <div style={{ marginTop: 6, fontSize: 12, color: "#999" }}>
                      {je.date} • {je.created_at ? new Date(je.created_at).toLocaleTimeString() : ""}
                    </div>
                  </div>
                ))}

                {!journalLoading && journalEntries.length > 3 && (
                  <div style={{ color: "#0b66ff", cursor: "pointer" }}>
                    <Link href={`/tables/${encodeURIComponent(tableId)}/journal`}>Открыть полный журнал →</Link>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* RIGHT SECTION */}
          <div className="cats-area">
            <CategoriesManager
              tableId={tableId}
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

      <style jsx>{`
        .table-editor-root { max-width: 1100px; margin: 0 auto; }
        @media (min-width: 980px) { .editor-grid { grid-template-columns: 420px 1fr; } }
      `}</style>
    </div>
  );
}
