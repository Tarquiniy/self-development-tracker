// frontend/src/components/RadarOverview.tsx
"use client";

import React, { useEffect, useMemo, useState } from "react";
import {
  RadarChart as RechartsRadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Radar,
  ResponsiveContainer,
} from "recharts";

type Category = { id: string; name?: string; [k: string]: any };

function isoDate(d: Date) {
  return d.toISOString().slice(0, 10);
}

function datesBetween(startIso: string, endIso: string) {
  const arr: string[] = [];
  const s = new Date(startIso + "T00:00:00");
  const e = new Date(endIso + "T00:00:00");
  if (isNaN(s.getTime()) || isNaN(e.getTime())) return arr;
  for (let d = new Date(s); d <= e; d.setDate(d.getDate() + 1)) {
    arr.push(isoDate(new Date(d)));
  }
  return arr;
}

export default function RadarOverview({ tableId }: { tableId: string }) {
  const [dataRaw, setDataRaw] = useState<any[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [rangeDays, setRangeDays] = useState<number>(14);

  // date range (ISO yyyy-mm-dd)
  const [endDate, setEndDate] = useState<string>(() => isoDate(new Date()));
  const [startDate, setStartDate] = useState<string>(() => {
    const d = new Date();
    d.setDate(d.getDate() - (14 - 1));
    return isoDate(d);
  });

  // Load table data (categories + progress rows)
  useEffect(() => {
    let mounted = true;
    async function load() {
      try {
        const res = await fetch(`/api/tables/${tableId}`);
        if (!res.ok) {
          const txt = await res.text();
          console.warn("RadarOverview: failed to load table", res.status, txt);
          return;
        }
        const j = await res.json();
        if (!mounted) return;
        setCategories(j.categories ?? []);
        setDataRaw(j.progress ?? []);
      } catch (err) {
        console.error("RadarOverview load error", err);
      }
    }
    load();
    return () => {
      mounted = false;
    };
  }, [tableId]);

  // When user chooses preset rangeDays, update start/end
  useEffect(() => {
    const e = new Date();
    const s = new Date();
    s.setDate(e.getDate() - (rangeDays - 1));
    setEndDate(isoDate(e));
    setStartDate(isoDate(s));
  }, [rangeDays]);

  // Derived array of date strings between startDate and endDate (inclusive)
  const dates = useMemo(() => {
    if (!startDate || !endDate) return [];
    // if start > end, swap
    if (startDate > endDate) {
      return datesBetween(endDate, startDate);
    }
    return datesBetween(startDate, endDate);
  }, [startDate, endDate]);

  // Aggregation: for each category compute sum over selected dates
  const aggregated = useMemo(() => {
    // build a quick lookup: for each (category_id, date) sum values
    // dataRaw expected shape: [{category_id, date, value, ...}, ...]
    if (!Array.isArray(categories)) return [];
    return categories.map((cat: any) => {
      let sum = 0;
      for (const row of dataRaw) {
        // row.date expected to be 'YYYY-MM-DD' (as in your backend)
        if (String(row?.category_id) === String(cat.id) && dates.includes(String(row?.date ?? ""))) {
          sum += Number(row?.value ?? 0);
        }
      }
      // clamp to 0..100 for radar domain (original code used Math.min(99, sum))
      const A = Math.min(100, Math.round(sum));
      const subject = String(cat.name ?? cat.title ?? cat.title ?? cat.id);
      return { subject, A };
    });
  }, [categories, dataRaw, dates]);

  // helper: quick presets
  const applyPreset = (days: number) => {
    setRangeDays(days);
  };

  return (
    <div style={{ height: 420, border: "1px solid #eee", padding: 12, borderRadius: 8 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
        <div style={{ fontWeight: 700 }}>Лепестковая диаграмма</div>

        {/* Controls: presets + manual calendar inputs */}
        <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
          <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
            <label style={{ fontSize: 13 }}>Период:</label>
            <button
              onClick={() => applyPreset(7)}
              type="button"
              style={{ padding: "6px 8px", borderRadius: 8, border: "1px solid #e6eef9", background: rangeDays === 7 ? "#eef6ff" : "#fff" }}
            >
              7
            </button>
            <button
              onClick={() => applyPreset(14)}
              type="button"
              style={{ padding: "6px 8px", borderRadius: 8, border: "1px solid #e6eef9", background: rangeDays === 14 ? "#eef6ff" : "#fff" }}
            >
              14
            </button>
            <button
              onClick={() => applyPreset(30)}
              type="button"
              style={{ padding: "6px 8px", borderRadius: 8, border: "1px solid #e6eef9", background: rangeDays === 30 ? "#eef6ff" : "#fff" }}
            >
              30
            </button>
          </div>

          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <label style={{ fontSize: 13 }}>C</label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => {
                setStartDate(e.target.value);
                // adjust rangeDays to match manual selection length
                try {
                  const d1 = new Date(e.target.value + "T00:00:00");
                  const d2 = new Date(endDate + "T00:00:00");
                  const diffDays = Math.round((d2.getTime() - d1.getTime()) / (1000 * 3600 * 24)) + 1;
                  if (diffDays > 0) setRangeDays(diffDays);
                } catch {}
              }}
              style={{ padding: "6px 8px", borderRadius: 8, border: "1px solid #e6eef9" }}
            />
            <label style={{ fontSize: 13 }}>По</label>
            <input
              type="date"
              value={endDate}
              onChange={(e) => {
                setEndDate(e.target.value);
                try {
                  const d1 = new Date(startDate + "T00:00:00");
                  const d2 = new Date(e.target.value + "T00:00:00");
                  const diffDays = Math.round((d2.getTime() - d1.getTime()) / (1000 * 3600 * 24)) + 1;
                  if (diffDays > 0) setRangeDays(diffDays);
                } catch {}
              }}
              style={{ padding: "6px 8px", borderRadius: 8, border: "1px solid #e6eef9" }}
            />
          </div>

          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <label style={{ fontSize: 13 }}>Дней:</label>
            <select
              value={rangeDays}
              onChange={(e) => setRangeDays(Number(e.target.value))}
              style={{ padding: "6px 8px", borderRadius: 8, border: "1px solid #e6eef9" }}
            >
              <option value={7}>7</option>
              <option value={14}>14</option>
              <option value={30}>30</option>
            </select>
          </div>
        </div>
      </div>

      {/* Radar */}
      <div style={{ width: "100%", height: 340, marginTop: 12 }}>
        <ResponsiveContainer>
          <RechartsRadarChart cx="50%" cy="50%" outerRadius="80%" data={aggregated}>
            <PolarGrid />
            <PolarAngleAxis dataKey="subject" />
            <PolarRadiusAxis angle={30} domain={[0, 100]} />
            <Radar name="Прогресс" dataKey="A" stroke="#8884d8" fill="#8884d8" fillOpacity={0.6} />
          </RechartsRadarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
