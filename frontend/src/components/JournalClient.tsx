// frontend/src/components/JournalClient.tsx
"use client";

import React, { useEffect, useMemo, useState } from "react";
import CalendarStrip from "./CalendarStrip";
import JournalList from "./JournalList";
import PetalChart from "@/components/PetalChart";
import Link from "next/link";

type CatMeta = { id: string; title: string; max?: number | null; color?: string | undefined; current?: number };
type CellRow = { category_id: string; title?: string; color?: string | undefined; max?: number | null; points: number };

export default function JournalClient({ tableId }: { tableId: string }) {
  const [selectedDate, setSelectedDate] = useState<Date>(() => new Date());
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [categories, setCategories] = useState<CatMeta[]>([]);
  const [cells, setCells] = useState<CellRow[]>([]);
  const [didRunSync, setDidRunSync] = useState(false);

  // load categories (from server) on mount
  useEffect(() => {
    let mounted = true;
    async function loadCats() {
      try {
        const res = await fetch(`/api/tables/${encodeURIComponent(tableId)}/categories`);
        if (!res.ok) {
          const t = await res.text().catch(() => "");
          throw new Error(`Failed categories: ${res.status} ${t}`);
        }
        const j = await res.json();
        const arr = Array.isArray(j?.data) ? j.data : j?.data ?? j?.data ?? [];
        // fallback: some endpoints return { data: [...] } or data directly
        const rows = Array.isArray(j?.data) ? j.data : Array.isArray(j) ? j : (j?.data ?? []);
        const mapped = (Array.isArray(rows) ? rows : []).map((r: any) => ({
          id: String(r.id),
          title: r.title ?? r.name ?? "",
          max: typeof r.max === "number" ? r.max : null,
          color: r.color ?? undefined,
          current: typeof r.current === "number" ? r.current : Number(r.current ?? 0),
        }));
        if (!mounted) return;
        setCategories(mapped);
      } catch (e: any) {
        console.warn("loadCats error", e);
        setError(String(e?.message ?? e));
      }
    }
    loadCats();
    return () => {
      mounted = false;
    };
  }, [tableId]);

  // run daily-sync once per mount (simple approach: call on mount if not yet called)
  useEffect(() => {
    if (didRunSync) return;
    let mounted = true;
    async function runSync() {
      try {
        const res = await fetch(`/api/tables/${encodeURIComponent(tableId)}/daily-sync`, { method: "POST" });
        if (!res.ok) {
          const t = await res.text().catch(() => "");
          console.warn("daily-sync failed", res.status, t);
        } else {
          const j = await res.json().catch(() => null);
          // console.log("daily-sync:", j);
        }
      } catch (e) {
        console.warn("daily-sync error", e);
      } finally {
        if (mounted) setDidRunSync(true);
      }
    }
    runSync();
    return () => {
      mounted = false;
    };
  }, [tableId, didRunSync]);

  // when selectedDate or categories change -> load cells for that date
  useEffect(() => {
    let mounted = true;
    async function loadCells() {
      setLoading(true);
      setError(null);
      setCells([]);
      try {
        const iso = selectedDate.toISOString().slice(0, 10);
        const res = await fetch(`/api/tables/${encodeURIComponent(tableId)}/cells?day=${encodeURIComponent(iso)}`);
        if (!res.ok) {
          const t = await res.text().catch(() => "");
          throw new Error(`Failed cells: ${res.status} ${t}`);
        }
        const j = await res.json();
        const rows = Array.isArray(j?.data) ? j.data : (j?.data ?? j ?? []);
        const mapped = (Array.isArray(rows) ? rows : []).map((r: any) => ({
          category_id: String(r.category_id),
          title: r.title ?? "",
          color: r.color ?? undefined,
          max: typeof r.max === "number" ? r.max : null,
          points: typeof r.points === "number" ? r.points : Number(r.points ?? 0),
        }));
        // If no snapshot rows, create zero rows from categories (so UI shows categories with zero)
        if (mapped.length === 0 && categories.length > 0) {
          const zeros = categories.map((c) => ({
            category_id: c.id,
            title: c.title,
            color: c.color,
            max: c.max ?? null,
            points: 0,
          }));
          if (mounted) setCells(zeros);
        } else {
          if (mounted) setCells(mapped);
        }
      } catch (e: any) {
        console.warn("loadCells error", e);
        setError(String(e?.message ?? e));
      } finally {
        if (mounted) setLoading(false);
      }
    }
    loadCells();
    return () => {
      mounted = false;
    };
  }, [tableId, selectedDate, categories]);

  const petalCats = useMemo(() => {
    return (cells || []).map((c) => ({
      id: String(c.category_id),
      title: c.title ?? "",
      value: Math.max(0, Number(c.points ?? 0)),
      max: typeof c.max === "number" ? c.max : null,
      color: c.color ?? undefined,
    }));
  }, [cells]);

  return (
    <div style={{ display: "grid", gap: 12 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <h2 style={{ margin: 0 }}>Журнал — состояние категорий</h2>
        <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
          <div style={{ color: "#666" }}>{selectedDate.toISOString().slice(0, 10)}</div>
          <Link href={`/tables/${encodeURIComponent(tableId)}`}>Открыть таблицу</Link>
        </div>
      </div>

      <div style={{ display: "flex", gap: 16, flexWrap: "wrap", alignItems: "flex-start" }}>
        <div style={{ minWidth: 320, maxWidth: 520 }}>
          <CalendarStrip
            selectedDate={selectedDate}
            onChange={(d: Date) => {
              setSelectedDate(d);
            }}
          />
        </div>

        <div style={{ flex: 1, minWidth: 360 }}>
          <div style={{ border: "1px solid #eee", padding: 12, borderRadius: 8, marginBottom: 12 }}>
            <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 8 }}>Просмотр состояния категорий</div>
            <div style={{ color: "#666" }}>
              Журнал показывает снимок значений категорий за выбранную дату. Изменять значения здесь нельзя — используйте страницу таблицы.
            </div>
          </div>

          <div style={{ display: "flex", justifyContent: "center", marginBottom: 12 }}>
            <PetalChart categories={petalCats} size={360} />
          </div>

          <JournalList groupedSummaries={[
            {
              date: selectedDate.toISOString().slice(0, 10),
              summaries: petalCats.map((c) => ({
                category_id: c.id,
                title: c.title,
                color: c.color,
                points: c.value,
                max: c.max ?? null
              }))
            }
          ]} loading={loading} error={error} totalCount={petalCats.length} />
        </div>
      </div>
    </div>
  );
}
