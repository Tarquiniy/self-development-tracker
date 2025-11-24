// frontend/src/components/RadarChart.tsx
"use client";

import React, { useMemo } from "react";

type CatForRadar = {
  id: string;
  title: string;
  value?: number | null;
  max?: number | null;
};

type Props = {
  categories: CatForRadar[];
  size?: number; // px square, default 320
  stroke?: string;
  fill?: string;
};

/**
 * Простая лепестковая (radar) диаграмма на SVG.
 * Работает без внешних библиотек.
 *
 * - categories: массив целей { id, title, value, max }
 * - если у категории нет max, используется общий максимум (макс по max или по value)
 * - size: ширина/высота SVG (по умолчанию 320)
 */

function clamp01(v: number) {
  if (!Number.isFinite(v)) return 0;
  return Math.max(0, Math.min(1, v));
}

export default function RadarChart({ categories, size = 320, stroke = "#0b84ff", fill = "rgba(11,132,255,0.12)" }: Props) {
  const data = useMemo(() => {
    const cats = (categories ?? []).map((c) => ({
      id: c.id,
      title: c.title ?? "—",
      value: typeof c.value === "number" ? c.value : 0,
      max: typeof c.max === "number" && c.max > 0 ? c.max : null,
    }));
    // determine normalization denominator per category or global fallback
    const maxCandidates = cats.map((c) => (c.max ?? c.value ?? 0));
    const globalMax = Math.max(...maxCandidates, 1);
    return { cats, globalMax };
  }, [categories]);

  const n = data.cats.length || 1;
  const cx = size / 2;
  const cy = size / 2;
  const padding = Math.max(20, size * 0.06);
  const radius = Math.min(cx, cy) - padding;

  // build polygon points and radial lines
  const points = data.cats.map((c, i) => {
    const angle = (Math.PI * 2 * i) / n - Math.PI / 2; // start at top
    const denom = c.max ?? data.globalMax;
    const ratio = clamp01((c.value ?? 0) / denom);
    const r = ratio * radius;
    const x = cx + r * Math.cos(angle);
    const y = cy + r * Math.sin(angle);
    return { x, y, ratio, angle, title: c.title, value: c.value, max: denom, id: c.id };
  });

  // polygon for outer grid (rings)
  const rings = 4;
  const ringPolygons = Array.from({ length: rings }, (_, ringIndex) => {
    const ringRatio = (ringIndex + 1) / rings;
    const pts = new Array(n).fill(0).map((_, i) => {
      const angle = (Math.PI * 2 * i) / n - Math.PI / 2;
      const r = ringRatio * radius;
      const x = cx + r * Math.cos(angle);
      const y = cy + r * Math.sin(angle);
      return `${x},${y}`;
    });
    return pts.join(" ");
  });

  const polygonPoints = points.map((p) => `${p.x},${p.y}`).join(" ");

  // labels positions slightly outside full radius
  const labels = data.cats.map((c, i) => {
    const angle = (Math.PI * 2 * i) / n - Math.PI / 2;
    const lx = cx + (radius + padding * 0.6) * Math.cos(angle);
    const ly = cy + (radius + padding * 0.6) * Math.sin(angle);
    // decide text anchor
    let anchor: "start" | "middle" | "end" = "middle";
    const deg = (angle * 180) / Math.PI;
    if (deg > -90 && deg < 90) anchor = "start";
    if (deg > 90 || deg < -90) anchor = "end";
    return { x: lx, y: ly, anchor, title: c.title };
  });

  return (
    <div style={{ width: size, height: size, maxWidth: "100%" }}>
      <svg viewBox={`0 0 ${size} ${size}`} width="100%" height="100%" role="img" aria-label="Лепестковая диаграмма">
        <defs>
          <filter id="soft" x="-50%" y="-50%" width="200%" height="200%">
            <feDropShadow dx="0" dy="6" stdDeviation="10" floodColor="#0b84ff" floodOpacity="0.08" />
          </filter>
        </defs>

        {/* background rings */}
        <g stroke="#e6eef9" strokeWidth={1} fill="none">
          {ringPolygons.map((pts, i) => (
            <polygon key={`r-${i}`} points={pts} />
          ))}
        </g>

        {/* radial lines */}
        <g stroke="#eef6ff" strokeWidth={1}>
          {new Array(n).fill(0).map((_, i) => {
            const angle = (Math.PI * 2 * i) / n - Math.PI / 2;
            const x = cx + radius * Math.cos(angle);
            const y = cy + radius * Math.sin(angle);
            return <line key={`rad-${i}`} x1={cx} y1={cy} x2={x} y2={y} />;
          })}
        </g>

        {/* filled polygon */}
        <g filter="url(#soft)">
          <polygon points={polygonPoints} fill={fill} stroke={stroke} strokeWidth={2} strokeLinejoin="round" />
        </g>

        {/* nodes */}
        <g>
          {points.map((p) => (
            <circle key={`pt-${p.id}`} cx={p.x} cy={p.y} r={6} fill="#fff" stroke={stroke} strokeWidth={2} />
          ))}
        </g>

        {/* labels */}
        <g fontSize={12} fill="#0b2336" fontWeight={600}>
          {labels.map((l, idx) => (
            <text
              key={`lbl-${idx}`}
              x={l.x}
              y={l.y}
              textAnchor={l.anchor}
              alignmentBaseline="middle"
              style={{ fontSize: 11 }}
            >
              {l.title}
            </text>
          ))}
        </g>

        {/* center stats: sum / average */}
        <g fontSize={12} textAnchor="middle" fill="#0b2336">
          <text x={cx} y={cy - 6} style={{ fontSize: 14, fontWeight: 700 }}>
            {Math.round((data.cats.reduce((s, c) => s + (c.value ?? 0), 0) * 100) / Math.max(1, data.cats.reduce((s, c) => s + (c.max ?? data.globalMax), 0)))}
            %
          </text>
          <text x={cx} y={cy + 12} style={{ fontSize: 11, fill: "#607185" }}>
            Заполнено
          </text>
        </g>
      </svg>
    </div>
  );
}
