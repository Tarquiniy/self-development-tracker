// frontend/src/components/RadarOverview.tsx
"use client";

import React, { useEffect, useMemo, useState } from "react";
import { RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar, ResponsiveContainer } from "recharts";
import { DayPicker } from "react-day-picker";
import "react-day-picker/dist/style.css";

/**
 * RadarOverview
 *
 * - Показывает Lepestkovuyu (radar) диаграмму (Recharts)
 * - Над диаграммой — календарь react-day-picker в режиме range
 * - Есть быстрые пресеты (7, 14, 30 дней)
 * - Работает в режиме "try option 1": мы получаем все записи с /api/tables/{tableId}
 *   и фильтруем их на клиенте по выбранному диапазону.
 *
 * Требования API (ожидаемый формат ответа от /api/tables/:id):
 * {
 *   categories: [{ id, name || title, max? }],
 *   progress: [{ category_id, value, date }] // date в формате YYYY-MM-DD
 * }
 *
 * Если у тебя API возвращает другой формат — сообщи, и я адаптирую.
 */

type Category = {
  id: string | number;
  name?: string;
  title?: string;
  max?: number | null;
};

type ProgressRow = {
  category_id: string | number;
  value?: number | null;
  date: string; // "YYYY-MM-DD"
};

export default function RadarOverview({ tableId }: { tableId: string }) {
  const [categories, setCategories] = useState<Category[]>([]);
  const [progressRows, setProgressRows] = useState<ProgressRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // range state (DayPicker range object: { from, to } or undefined)
  const [range, setRange] = useState<{ from?: Date | undefined; to?: Date | undefined } | undefined>(undefined);

  // preset selected days (when user clicks preset)
  const [presetDays, setPresetDays] = useState<number>(14);

  // initialize default range = last `presetDays` up to today
  useEffect(() => {
    const to = new Date();
    const from = new Date();
    from.setDate(to.getDate() - (presetDays - 1));
    setRange({ from, to });
  }, [presetDays]);

  // Load data from API (attempts to get full dataset — option 1)
  useEffect(() => {
    let mounted = true;
    async function load() {
      setLoading(true);
      setError(null);
      try {
        const resp = await fetch(`/api/tables/${tableId}`);
        if (!resp.ok) {
          const text = await resp.text().catch(() => "");
          throw new Error(`API error ${resp.status} ${text}`);
        }
        const j = await resp.json();
        // try to extract categories & progress
        const cats = j.categories ?? j.data?.categories ?? j.categories ?? [];
        const progress = j.progress ?? j.data?.progress ?? j.progress ?? [];
        if (mounted) {
          setCategories(Array.isArray(cats) ? cats : []);
          setProgressRows(Array.isArray(progress) ? progress : []);
        }
      } catch (e: any) {
        console.error("RadarOverview load error", e);
        if (mounted) setError(String(e?.message ?? e));
      } finally {
        if (mounted) setLoading(false);
      }
    }
    load();
    return () => { mounted = false; };
  }, [tableId]);

  // helper: format date to YYYY-MM-DD
  const toYMD = (d: Date) => {
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const dd = String(d.getDate()).padStart(2, "0");
    return `${yyyy}-${mm}-${dd}`;
  };

  // derived array of strings for selected date range inclusive
  const selectedDates = useMemo(() => {
    if (!range || !range.from || !range.to) return [];
    const arr: string[] = [];
    const cur = new Date(range.from);
    const end = new Date(range.to);
    // normalize times
    cur.setHours(0, 0, 0, 0);
    end.setHours(0, 0, 0, 0);
    while (cur <= end) {
      arr.push(toYMD(cur));
      cur.setDate(cur.getDate() + 1);
    }
    return arr;
  }, [range]);

  // aggregated data for radar chart
  const aggregated = useMemo(() => {
    // categories may have name/title variations
    const cats = categories.map((c) => ({
      id: String(c.id),
      title: (c as any).title ?? (c as any).name ?? `cat-${c.id}`,
      max: typeof c.max === "number" && c.max > 0 ? c.max : null,
    }));

    // sum values for each category within selectedDates
    const sums = cats.map((cat) => {
      const sum = progressRows
        .filter((r) => String(r.category_id) === String(cat.id))
        .filter((r) => {
          if (!selectedDates.length) return true; // if no selection, include all
          return selectedDates.includes(String(r.date));
        })
        .reduce((acc, cur) => acc + (typeof cur.value === "number" ? cur.value : Number(cur.value ?? 0)), 0);
      return { id: cat.id, title: cat.title, sum, max: cat.max };
    });

    // normalize to percentage 0..100
    // if category has its own max -> percent = sum / max * 100
    // otherwise compute globalMax as max(sum) or 1 to avoid divide by 0
    const globalMaxCandidate = Math.max(...sums.map((s) => (s.max && s.max > 0 ? s.max : s.sum)), 1);
    return sums.map((s) => {
      const denom = s.max && s.max > 0 ? s.max : globalMaxCandidate;
      const pct = denom > 0 ? Math.round((s.sum / denom) * 100) : 0;
      return { subject: s.title, A: Math.max(0, Math.min(100, pct)), rawSum: s.sum, rawMax: denom };
    });
  }, [categories, progressRows, selectedDates]);

  // fast preset handler to set date range
  function setPreset(nDays: number) {
    setPresetDays(nDays);
    const to = new Date();
    const from = new Date();
    from.setDate(to.getDate() - (nDays - 1));
    setRange({ from, to });
  }

  // UI: display selected range nicely
  const rangeLabel = useMemo(() => {
    if (!range || !range.from || !range.to) return "За всё время";
    return `${range.from.toLocaleDateString()} — ${range.to.toLocaleDateString()}`;
  }, [range]);

  return (
    <div style={{
      border: "1px solid #eef2ff",
      padding: 12,
      borderRadius: 10,
      background: "#fff",
      boxShadow: "0 6px 18px rgba(16,24,40,0.04)"
    }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "flex-start" }}>
        <div style={{ fontWeight: 700 }}>Лепестковая диаграмма</div>

        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <div style={{ fontSize: 13, color: "#475569" }}>{loading ? "Загрузка…" : rangeLabel}</div>
          <div style={{ borderLeft: "1px solid #eef2ff", height: 28, marginLeft: 8 }} />
          <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
            <button
              onClick={() => setPreset(7)}
              style={{
                padding: "6px 8px",
                borderRadius: 8,
                border: presetDays === 7 ? "2px solid #0b84ff" : "1px solid rgba(11,35,54,0.06)",
                background: presetDays === 7 ? "#eaf4ff" : "#fff",
                cursor: "pointer",
                fontWeight: 700,
              }}
              title="Последние 7 дней"
            >
              7
            </button>
            <button
              onClick={() => setPreset(14)}
              style={{
                padding: "6px 8px",
                borderRadius: 8,
                border: presetDays === 14 ? "2px solid #0b84ff" : "1px solid rgba(11,35,54,0.06)",
                background: presetDays === 14 ? "#eaf4ff" : "#fff",
                cursor: "pointer",
                fontWeight: 700,
              }}
              title="Последние 14 дней"
            >
              14
            </button>
            <button
              onClick={() => setPreset(30)}
              style={{
                padding: "6px 8px",
                borderRadius: 8,
                border: presetDays === 30 ? "2px solid #0b84ff" : "1px solid rgba(11,35,54,0.06)",
                background: presetDays === 30 ? "#eaf4ff" : "#fff",
                cursor: "pointer",
                fontWeight: 700,
              }}
              title="Последние 30 дней"
            >
              30
            </button>
          </div>
        </div>
      </div>

      <div style={{
        display: "flex",
        gap: 12,
        marginTop: 12,
        flexDirection: "column",
      }}>
        {/* Calendar + apply/clear controls */}
        <div style={{
          display: "flex",
          gap: 12,
          alignItems: "flex-start",
          flexWrap: "wrap"
        }}>
          <div style={{
            border: "1px solid #eef6ff",
            padding: 8,
            borderRadius: 8,
            background: "#fbfdff"
          }}>
            <DayPicker
              mode="range"
              selected={range as any}
              onSelect={(r) => {
                // r may be undefined or { from, to }
                setRange(r as any);
              }}
            />
          </div>

          <div style={{ minWidth: 240, display: "flex", flexDirection: "column", gap: 8 }}>
            <div style={{ display: "flex", gap: 8 }}>
              <button
                onClick={() => {
                  if (range && range.from && range.to) {
                    // no-op - already selected
                    return;
                  }
                  // fallback: set to preset days if none
                  setPreset(presetDays || 14);
                }}
                style={{
                  padding: "8px 12px",
                  borderRadius: 8,
                  border: "1px solid rgba(11,35,54,0.06)",
                  background: "#fff",
                  cursor: "pointer",
                }}
              >
                Применить
              </button>

              <button
                onClick={() => {
                  setRange(undefined);
                }}
                style={{
                  padding: "8px 12px",
                  borderRadius: 8,
                  border: "1px solid rgba(11,35,54,0.06)",
                  background: "#fff",
                  cursor: "pointer",
                }}
              >
                Очистить
              </button>
            </div>

            <div style={{ color: "#6b7280", fontSize: 13 }}>
              Подсказка: выбери диапазон на календаре (клик на начало → клик на конец). Пресеты слева — быстрый выбор.
            </div>

            {error && <div style={{ color: "crimson", padding: 8, borderRadius: 8, background: "#fff4f4" }}>{error}</div>}
          </div>
        </div>

        {/* Radar chart */}
        <div style={{ width: "100%", height: 320 }}>
          {aggregated.length === 0 ? (
            <div style={{ padding: 18, color: "#64748b" }}>
              Нет категорий или данных для выбранного диапазона.
            </div>
          ) : (
            <ResponsiveContainer>
              <RadarChart cx="50%" cy="50%" outerRadius="80%" data={aggregated}>
                <PolarGrid />
                <PolarAngleAxis dataKey="subject" />
                <PolarRadiusAxis angle={30} domain={[0, 100]} />
                <Radar name="Прогресс" dataKey="A" stroke="#0b84ff" fill="#0b84ff" fillOpacity={0.24} />
              </RadarChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>
    </div>
  );
}
