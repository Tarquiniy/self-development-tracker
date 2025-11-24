"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import CategoriesManager from "./CategoriesManager";
import PetalChart from "./PetalChart";
import ProgressCalendar from "./ProgressCalendar";

type Cat = {
  id: string;
  title: string;
  description?: string | null;
  max?: number | null;
  value?: number | null;
  color?: string | null;
};

type Props = {
  tableId: string;
  serverData?: any;
};

function isIterable(value: any): value is Iterable<any> {
  return value != null && typeof value[Symbol.iterator] === "function";
}
function toArray<T = any>(value?: T | T[] | Iterable<T> | null): T[] {
  if (value == null) return [];
  if (Array.isArray(value)) return value as T[];
  if (isIterable(value)) return Array.from(value as Iterable<T>);
  if (typeof value === "object") {
    if (Array.isArray((value as any).data)) return (value as any).data;
    if (Array.isArray((value as any).categories)) return (value as any).categories;
    return [value as T];
  }
  return [value as T];
}

function safeNum(v: any, fallback = 0) {
  if (v == null) return fallback;
  if (typeof v === "number" && !Number.isNaN(v)) return v;
  if (typeof v === "string") {
    const n = parseFloat(v.replace(",", "."));
    return Number.isFinite(n) ? n : fallback;
  }
  return fallback;
}

export default function TableEditorClient({ tableId, serverData }: Props) {
  const [loading, setLoading] = useState(false);
  const [server, setServer] = useState<any | null>(serverData ?? null);
  const [error, setError] = useState<string | null>(null);
  const [entries, setEntries] = useState<any[]>([]);
  const [categories, setCategories] = useState<Cat[]>([]);
  const [addingMap, setAddingMap] = useState<Record<string, boolean>>({});
  const [calendarData, setCalendarData] = useState<{ [key: string]: any }>({});

  const prevValueRef = useRef<Record<string, number>>({});
  const unlockTimeoutsRef = useRef<Record<string, number | null>>({});

  useEffect(() => {
    try {
      (window as any).__DEBUG_TABLE_EDITOR__ = { tableId, categoriesLen: categories.length, entriesLen: entries.length };
    } catch {}
  }, [server, categories, tableId, entries]);

  useEffect(() => {
    if (serverData) {
      setServer(serverData);
      const cand = serverData?.categories ?? serverData?.data?.categories ?? serverData?.data ?? serverData;
      const arr = toArray(cand).filter(Boolean);
      const normalized = arr.map((r: any, i: number) => ({
        id: String(r?.id ?? r?.cid ?? r?.category_id ?? `cat_${i}`),
        title: String(r?.title ?? r?.name ?? "Без названия"),
        description: r?.description ?? null,
        max: typeof r?.max === "number" && !isNaN(r.max) ? r.max : null,
        value: typeof r?.value === "number" && !isNaN(r.value) ? r.value : 0,
        color: r?.color ?? undefined,
      }));
      setCategories(normalized);
      fetchEntries();
      fetchCalendarData();
    } else {
      fetchServer();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tableId]);

  useEffect(() => {
    return () => {
      Object.values(unlockTimeoutsRef.current).forEach((t) => {
        if (t) clearTimeout(t as any);
      });
      unlockTimeoutsRef.current = {};
    };
  }, []);

  async function fetchServer() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/tables/${encodeURIComponent(tableId)}`);
      if (!res.ok) {
        const body = await res.text().catch(() => "");
        throw new Error(`failed to load table (${res.status}) ${body}`);
      }
      const json = await res.json().catch(() => ({}));
      setServer(json);

      const cand = json?.categories ?? json?.data?.categories ?? json?.data ?? json;
      const arr = toArray(cand).filter(Boolean);
      const normalized = arr.map((r: any, i: number) => ({
        id: String(r?.id ?? r?.cid ?? r?.category_id ?? `cat_${i}`),
        title: String(r?.title ?? r?.name ?? "Без названия"),
        description: r?.description ?? null,
        max: typeof r?.max === "number" && !isNaN(r.max) ? r.max : null,
        value: typeof r?.value === "number" && !isNaN(r.value) ? r.value : 0,
        color: r?.color ?? undefined,
      }));
      if (normalized.length) setCategories(normalized);

      await fetchEntries();
      await fetchCalendarData();
    } catch (e: any) {
      const msg = e && typeof e === "object" ? e.message ?? JSON.stringify(e) : String(e ?? "Ошибка загрузки");
      setError(msg);
      console.error("fetchServer error:", e);
    } finally {
      setLoading(false);
    }
  }

  async function fetchEntries() {
    try {
      const res = await fetch(`/api/tables/${encodeURIComponent(tableId)}/entries`);
      if (!res.ok) {
        const body = await res.text().catch(() => "");
        console.warn("fetchEntries failed:", res.status, body);
        return;
      }
      const json = await res.json().catch(() => ({}));
      setEntries(Array.isArray(json?.data) ? json.data : toArray(json).filter(Boolean));
    } catch (e) {
      console.warn("fetchEntries exception", e);
    }
  }

  async function fetchCalendarData() {
    try {
      const res = await fetch(`/api/tables/progress/calendar_data/?table=${tableId}`);
      if (!res.ok) {
        console.warn("fetchCalendarData failed:", res.status);
        return;
      }
      const data = await res.json().catch(() => ({}));
      setCalendarData(data);
    } catch (e) {
      console.warn("fetchCalendarData exception", e);
    }
  }

  // fetch single category state from server (used to reconcile optimistic state)
  async function fetchCategoryFromServer(categoryId: string) {
    try {
      const res = await fetch(`/api/tables/${encodeURIComponent(tableId)}`);
      if (!res.ok) return null;
      const json = await res.json().catch(() => null);
      if (!json) return null;
      const cand = json?.categories ?? json?.data?.categories ?? json?.data ?? json;
      const arr = toArray(cand).filter(Boolean);
      const normalized = arr.map((r: any, i: number) => ({
        id: String(r?.id ?? r?.cid ?? r?.category_id ?? `cat_${i}`),
        title: String(r?.title ?? r?.name ?? "Без названия"),
        description: r?.description ?? null,
        max: typeof r?.max === "number" && !isNaN(r.max) ? r.max : null,
        value: typeof r?.value === "number" && !isNaN(r.value) ? r.value : 0,
        color: r?.color ?? undefined,
      }));
      const found = normalized.find((c) => String(c.id) === String(categoryId));
      if (found) {
        setCategories((prev) => prev.map((c) => (String(c.id) === String(categoryId) ? found : c)));
        return found;
      }
      return null;
    } catch (e) {
      console.warn("fetchCategoryFromServer", e);
      return null;
    }
  }

  async function refreshAll() {
    await fetchServer();
    await fetchEntries();
    await fetchCalendarData();
  }

  const radarCats = useMemo(() => {
    try {
      return (Array.isArray(categories) ? categories : []).map((c) => {
        const id = String(c?.id ?? "");
        const maxVal = typeof c?.max === "number" && c.max > 0 ? c.max : null;
        const rawValue = typeof c?.value === "number" ? Number(c.value) : 0;
        return {
          id,
          title: String(c?.title ?? "Без названия"),
          value: Math.max(0, rawValue),
          max: maxVal,
          color: c?.color ?? undefined,
        };
      });
    } catch (err) {
      try {
        (window as any).__DEBUG_TABLE_EDITOR__ = { radarCatsError: String(err), categoriesSample: categories?.slice?.(0, 6) ?? categories, entriesSample: entries?.slice?.(0, 6) ?? entries };
      } catch {}
      return [];
    }
  }, [categories]);

  async function handleAddDelta(categoryId: string, delta: number) {
    if (!categoryId) return;
    if (addingMap[categoryId]) return;

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
    }, 3000);

    setError(null);

    const idx = categories.findIndex((c) => String(c.id) === String(categoryId));
    if (idx === -1) {
      setAddingMap((m) => {
        const nm = { ...m };
        delete nm[categoryId];
        return nm;
      });
      if (unlockTimeoutsRef.current[categoryId]) {
        clearTimeout(unlockTimeoutsRef.current[categoryId] as any);
        unlockTimeoutsRef.current[categoryId] = null;
      }
      return;
    }

    const cat = categories[idx];
    const cur = Math.max(0, safeNum(cat.value, 0));
    const maxVal = typeof cat.max === "number" && !Number.isNaN(cat.max) ? cat.max : Infinity;
    const newValClamped = Math.max(0, Math.min(maxVal, cur + delta));
    const actualDelta = newValClamped - cur;
    if (actualDelta === 0) {
      return;
    }

    prevValueRef.current[categoryId] = cur;

    const ts = Date.now();
    const tmpId = `tmp-${ts}-${Math.random().toString(36).slice(2)}`;
    const tmpEntry = {
      id: tmpId,
      category_id: categoryId,
      category_title: cat?.title ?? null,
      delta: actualDelta,
      value: actualDelta,
      created_at: new Date().toISOString(),
      __optimistic: true,
    };

    setEntries((prev) => [tmpEntry, ...prev]);

    setCategories((prev) =>
      prev.map((c) => {
        if (String(c.id) !== String(categoryId)) return c;
        return { ...c, value: Math.max(0, Math.min(maxVal, safeNum(c.value, 0) + actualDelta)) };
      })
    );

    try {
      const res = await fetch(`/api/tables/${encodeURIComponent(tableId)}/entries`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ category_id: categoryId, delta: actualDelta }),
      });

      if (!res.ok) {
        const body = await res.text().catch(() => "");
        throw new Error(`Server error ${res.status} ${body}`);
      }

      const json = await res.json().catch(() => null);

      if (json && (json.id || json?.data?.id || json?.entry?.id)) {
        const serverEntry = (json?.data ?? json?.entry ?? json) as any;
        setEntries((prev) => prev.map((e) => (e.id === tmpId ? { ...serverEntry } : e)));
      } else {
        setEntries((prev) => prev.map((e) => (e.id === tmpId ? { ...e, __optimistic: false } : e)));
      }

      if (json && json?.category) {
        const ret = json.category;
        const id = String(ret?.id ?? ret?.cid ?? ret?.category_id ?? "");
        setCategories((prev) => prev.map((c) => (String(c.id) === id ? { ...c, value: typeof ret.value === "number" ? ret.value : c.value, max: typeof ret.max === "number" ? ret.max : c.max } : c)));
      } else if (json && Array.isArray(json?.categories)) {
        const srvCats = json.categories.map((r: any, i: number) => ({
          id: String(r?.id ?? r?.cid ?? r?.category_id ?? `cat_${i}`),
          title: String(r?.title ?? r?.name ?? "Без названия"),
          description: r?.description ?? null,
          max: typeof r?.max === "number" && !isNaN(r.max) ? r.max : null,
          value: typeof r?.value === "number" && !isNaN(r.value) ? r.value : 0,
          color: r?.color ?? undefined,
        }));
        setCategories((prev) => {
          const map = new Map(srvCats.map((c: { id: any; }) => [String(c.id), c]));
          return prev.map((p) => map.has(String(p.id)) ? (map.get(String(p.id)) as any) : p);
        });
      } else {
        await fetchCategoryFromServer(categoryId);
      }

      // Обновляем данные календаря после успешного добавления
      await fetchCalendarData();
    } catch (e: any) {
      setEntries((prev) => prev.filter((it) => it.id !== tmpId));
      setCategories((prev) =>
        prev.map((c) => {
          if (String(c.id) !== String(categoryId)) return c;
          const prevVal = prevValueRef.current[categoryId];
          return { ...c, value: typeof prevVal === "number" ? prevVal : 0 };
        })
      );
      const message = e && typeof e === "object" ? e.message ?? JSON.stringify(e) : String(e ?? "Ошибка при добавлении");
      setError(message);
      console.error("handleAddDelta error", e);
    } finally {
      delete prevValueRef.current[categoryId];
    }
  }

  function handleEditCategory(categoryId: string | null) {
    try {
      window.dispatchEvent(new CustomEvent("tableEditor:editCategory", { detail: { categoryId } }));
    } catch {
      // fallback
    }
  }

  useEffect(() => {
    const styleId = "table-editor-button-override";
    if (document.getElementById(styleId)) return;
    const style = document.createElement("style");
    style.id = styleId;
    style.innerHTML = `
      .table-editor-root button { color: #0b2336 !important; background-clip: padding-box; border-radius: 8px !important; padding: 8px 10px !important; }
      .table-editor-root .goal-action-btn { min-width: 40px; min-height: 36px; display: inline-flex; align-items: center; justify-content: center; font-weight: 700; border: 1px solid rgba(11,35,54,0.06) !important; background: #fff !important; box-shadow: 0 8px 20px rgba(11,35,54,0.04); color: #0b2336 !important; }
      .table-editor-root .goal-action-btn[disabled] { opacity: 0.45; pointer-events: none; }
    `;
    document.head.appendChild(style);
  }, []);

  return (
    <div className="table-editor-root" style={{ padding: 12 }}>
      {error && <div style={{ color: "crimson", marginBottom: 8 }}>Ошибка: {error}</div>}

      <div style={{ display: "grid", gap: 12, gridTemplateColumns: "1fr", alignItems: "start" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <h1 style={{ margin: 0, fontSize: 20 }}>{server?.title ?? "Таблица"}</h1>
          <div style={{ fontSize: 12, color: "#556" }}>{loading ? "Загрузка…" : `Категорий: ${categories.length}`}</div>
        </div>

        {/* Календарь прогресса */}
        <div className="calendar-section">
          <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 8, width: "100%" }}>
            <h3 style={{ margin: 0, fontSize: 16 }}>История прогресса</h3>
            <button
              onClick={() => refreshAll()}
              style={{ marginLeft: "auto", padding: "6px 10px", borderRadius: 8, border: "1px solid #e6eef9", background: "#fff", color: "#0b2336" }}
            >
              Обновить
            </button>
          </div>
          
          <ProgressCalendar
            tableId={tableId}
            categories={categories}
            calendarData={calendarData}
            onDataUpdate={fetchCalendarData}
          />
        </div>

        <div className="editor-grid">
          <div className="radar-area">
            <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 8, width: "100%" }}>
              <h3 style={{ margin: 0, fontSize: 16 }}>Прогресс</h3>
            </div>

            <div className="petal-wrapper" style={{ width: "100%", display: "flex", justifyContent: "center", alignItems: "center", overflow: "visible", minHeight: 440 }}>
              <PetalChart
                categories={radarCats}
                size={360}
                onAddDelta={handleAddDelta}
                onEditCategory={handleEditCategory}
              />
            </div>
          </div>

          <div className="cats-area">
            <CategoriesManager
              tableId={tableId}
              onChange={(items) => {
                const normalized = (Array.isArray(items) ? items : []).filter(Boolean).map((r: any, i: number) => ({
                  id: String(r?.id ?? r?.cid ?? r?.category_id ?? r?.cat_id ?? `cat_${i}`),
                  title: String(r?.title ?? r?.name ?? "Без названия"),
                  description: r?.description ?? null,
                  max: typeof r?.max === "number" && !isNaN(r.max) ? r.max : null,
                  value: typeof r?.value === "number" && !isNaN(r.value) ? r.value : 0,
                  color: r?.color ?? undefined,
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
        .table-editor-root {
          max-width: 1100px;
          margin: 0 auto;
        }
        .calendar-section {
          background: white;
          border-radius: 12px;
          padding: 20px;
          margin-bottom: 20px;
          box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
        }
        .editor-grid {
          display: grid;
          gap: 18px;
          grid-template-columns: 1fr;
        }
        .radar-area {
          display: flex;
          flex-direction: column;
          align-items: center;
        }
        .cats-area {
          display: block;
        }

        @media (min-width: 980px) {
          .editor-grid {
            grid-template-columns: 420px 1fr;
            align-items: start;
          }
          .radar-area {
            position: sticky;
            top: 18px;
            align-self: start;
          }
        }
      `}</style>
    </div>
  );
}