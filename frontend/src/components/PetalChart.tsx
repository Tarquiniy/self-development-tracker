// frontend/src/components/PetalChart.tsx
"use client";

import React, { useMemo } from "react";
import { useSprings, animated, SpringValue } from "@react-spring/web";

/**
 * PetalChart — same behavior as previous version but WITHOUT rendering
 * numeric values and category names on the chart.
 *
 * - Colored fill grows from center outward (circle), clipped to petal shape via clipPath.
 * - Progress -> radius mapping: innerRadius .. outerRadius.
 * - Animated radius via react-spring when available.
 * - Hooks are called unconditionally to obey rules-of-hooks.
 */

type Category = {
  id: string;
  title?: string;
  value?: number | null;
  max?: number | null;
  color?: string | null;
};

type Props = {
  categories?: Category[] | any;
  size?: number;
  onAddDelta?: (categoryId: string, delta: number) => Promise<void> | void;
  onEditCategory?: (categoryId: string | null) => void;
  selectedCategoryId?: string | null;
  onSelectCategory?: (categoryId: string | null) => void;
};

type Petal = {
  id: string;
  title: string;
  value: number;
  max: number | null;
  color: string;
  angle: number;
  width: number;
  basePath: string;
  fixedLen: number;
  progress: number; // 0..1
};

export default function PetalChart(props: Props) {
  const {
    categories = [],
    size = 340,
    onAddDelta,
    onEditCategory,
    selectedCategoryId = null,
    onSelectCategory,
  } = props;

  // Normalize incoming categories into a safe array
  const catsInput: any[] = Array.isArray(categories)
    ? categories
    : typeof categories === "object" && categories
    ? Array.isArray((categories as any).data)
      ? (categories as any).data
      : Array.isArray((categories as any).categories)
      ? (categories as any).categories
      : [categories]
    : [];

  // layout sizes
  const W = Math.max(120, Number(size) || 340);
  const H = W;
  const pad = Math.max(28, Math.round(W * 0.1));
  const viewW = W + pad * 2;
  const viewH = H + pad * 2;
  const outerRadius = Math.max(24, Math.min(W, H) * 0.45);
  const innerRadius = Math.max(6, Math.min(W, H) * 0.045);

  const DEFAULT_COLORS = [
    "#FF6EC7",
    "#5A9CFF",
    "#7CE389",
    "#FFD59A",
    "#FF8A6B",
    "#9A7CFF",
    "#6AD3FF",
    "#FFB4E6",
  ];

  // Build petals array (pure data) - stable across renders
  const petals: Petal[] = useMemo(() => {
    try {
      const normalized: {
        id: string;
        title: string;
        value: number;
        max: number | null;
        color: string;
      }[] = catsInput.map((c: any, i: number) => {
        const id = String(c?.id ?? c?.cid ?? c?.category_id ?? `cat_${i}`);
        const title = String(c?.title ?? c?.name ?? `Цель ${i + 1}`);
        const rawValue = typeof c?.value === "number" && !Number.isNaN(c.value) ? c.value : 0;
        const rawMax = typeof c?.max === "number" && !Number.isNaN(c.max) && c.max > 0 ? c.max : null;
        const value = Math.max(0, rawValue);
        const max = rawMax ? Math.max(1, rawMax) : null;
        const color = typeof c?.color === "string" && c.color ? c.color : DEFAULT_COLORS[i % DEFAULT_COLORS.length];
        return { id, title, value, max, color };
      });

      const globalMax = Math.max(
        1,
        ...normalized.map((x) => (x.max && x.max > 0 ? x.max : Math.max(0, x.value)))
      );

      const N = Math.max(1, normalized.length);
      const sector = (Math.PI * 2) / N;

      const result: Petal[] = [];
      for (let i = 0; i < N; i++) {
        const c = normalized[i];
        const angle = i * sector - Math.PI / 2;
        const progress = clamp((c.value ?? 0) / (c.max ? c.max : globalMax), 0, 1);
        const width = Math.max(14, Math.min(W, H) * 0.115);

        const tipY = -outerRadius;
        const cp1x = width * 0.55;
        const cp1y = -outerRadius * 0.36;
        const cp2x = -width * 0.55;
        const cp2y = -outerRadius * 0.36;

        // basePath is a closed shape centered at (0,0) and pointing upward
        const basePath = `M 0 0 C ${cp1x} ${cp1y} ${width} ${-outerRadius * 0.6} 0 ${tipY} C ${-width} ${-outerRadius * 0.6} ${cp2x} ${cp2y} 0 0 Z`;

        result.push({
          id: c.id,
          title: c.title,
          value: c.value,
          max: c.max,
          color: c.color,
          angle,
          width,
          basePath,
          fixedLen: outerRadius,
          progress,
        });
      }
      return result;
    } catch (err) {
      // on error return empty array
      try {
        (window as any).__DEBUG_PETAL_CHART_ERROR__ = { err: String(err), catsInput };
      } catch {}
      return [];
    }
    // deps: stringify the input to avoid referential instability
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [JSON.stringify(catsInput), W, H, outerRadius]);

  // build progress array (always compute, even if petals is empty)
  const progressArray: number[] = petals.map((p) => clamp(Number(p.progress ?? 0), 0, 1));

  // useSprings with function form — MUST be called on every render in same order
  const springs = useSprings(
    petals.length,
    (index) => {
      const toPct = typeof progressArray[index] === "number" ? progressArray[index] : 0;
      return { to: { pct: toPct }, config: { tension: 150, friction: 26 } };
    }
  );

  if (!petals.length) {
    return (
      <div style={{ padding: 12, textAlign: "center", color: "#6b7b88" }}>
        <div style={{ fontWeight: 700, marginBottom: 6 }}>Диаграмма недоступна</div>
        <div style={{ fontSize: 13 }}>Нет корректных категорий для отображения.</div>
      </div>
    );
  }

  // selection - purely controlled by parent (if provided)
  const localSelectedId = selectedCategoryId ?? petals[0]?.id ?? null;

  function selectId(id: string | null) {
    if (typeof onSelectCategory === "function") onSelectCategory(id);
  }

  async function addDeltaTo(id: string | null, delta: number) {
    if (!id) return;

    // Find petal and prevent exceeding max on client-side
    const p = petals.find((x) => String(x.id) === String(id));
    if (p) {
      if (delta > 0 && p.max != null && Number(p.value ?? 0) >= Number(p.max)) {
        // already at or above max — do nothing
        return;
      }
      // also clamp negative deltas so value doesn't drop below 0 (defensive)
      if (delta < 0 && Number(p.value ?? 0) <= 0) {
        return;
      }
    }

    if (typeof onAddDelta === "function") {
      try {
        await onAddDelta(id, delta);
      } catch (e) {
        console.warn("onAddDelta failed", e);
      }
    }
  }

  const totalUnits = petals.reduce((s, p) => s + (p.value ?? 0), 0);

  // radius calculation helper: maps progress -> radius between innerRadius and outerRadius
  const progressToRadius = (progress: number) =>
    innerRadius + clamp(progress, 0, 1) * (outerRadius - innerRadius);

  return (
    <div style={{ width: "100%", display: "flex", flexDirection: "column", alignItems: "center", gap: 10 }}>
      <div style={{ width: W, height: H, display: "flex", justifyContent: "center", alignItems: "center" }}>
        <svg
          width={W}
          height={H}
          viewBox={`${-viewW / 2} ${-viewH / 2} ${viewW} ${viewH}`}
          preserveAspectRatio="xMidYMid meet"
          style={{ overflow: "visible", display: "block" }}
          aria-hidden={true}
        >
          <defs>
            <filter id="pc_drop" x="-80%" y="-80%" width="260%" height="260%">
              <feDropShadow dx="0" dy="6" stdDeviation="12" floodOpacity="0.12" />
            </filter>

            {/* clipPath for each petal */}
            {petals.map((p) => {
              const clipId = sanitizeId(`pc_clip_${p.id}`);
              return (
                <clipPath id={clipId} key={`clip-${clipId}`}>
                  <path d={p.basePath} />
                </clipPath>
              );
            })}
          </defs>

          {/* background rings */}
          <g>
            <circle r={outerRadius + 4} fill="none" stroke="rgba(12,20,30,0.03)" strokeWidth={1} />
            <circle r={innerRadius + 1} fill="none" stroke="rgba(12,20,30,0.02)" strokeWidth={1} />
          </g>

          {/* petals */}
          <g transform={`translate(0,0)`}>
            {petals.map((p, i) => {
              const isSelected = p.id === localSelectedId;
              const color = p.color ?? DEFAULT_COLORS[i % DEFAULT_COLORS.length];

              const clipId = sanitizeId(`pc_clip_${p.id}`);

              // spring for this petal
              const spring = springs && springs[i] ? (springs[i] as any) : null;

              // Animated radius (SpringValue) or static number
              const animatedRadius = spring && spring.pct && typeof (spring.pct as SpringValue<number>).to === "function"
                ? (spring.pct as SpringValue<number>).to((v: number) => progressToRadius(clamp(v, 0, 1)))
                : progressToRadius(p.progress);

              // For accessibility/controls: clicking center of petal selects; double click edits
              return (
                // outer group rotated to petal angle
                <g
                  key={p.id}
                  transform={`rotate(${(p.angle * 180) / Math.PI})`}
                  style={{ cursor: "pointer" }}
                  onClick={() => selectId(p.id)}
                  onDoubleClick={() => typeof onEditCategory === "function" && onEditCategory(p.id)}
                >
                  {/* semi-transparent background full petal */}
                  <path d={p.basePath} fill={rgba(color, 0.14)} stroke="rgba(0,0,0,0.02)" strokeWidth={0.6} />

                  {/* Colored fill implemented as a circle centered at (0,0), clipped to petal.
                      This ensures the colored area starts at center and grows outward,
                      and never appears outside the background shape. */}
                  <g clipPath={`url(#${clipId})`} filter="url(#pc_drop)" opacity={isSelected ? 1 : 0.98}>
                    {spring && spring.pct && typeof (spring.pct as SpringValue<number>).to === "function" ? (
                      <animated.circle cx={0} cy={0} r={animatedRadius} fill={rgba(color, 1)} />
                    ) : (
                      <circle cx={0} cy={0} r={animatedRadius as number} fill={rgba(color, 1)} />
                    )}
                  </g>

                  {/* outline */}
                  <path d={p.basePath} fill="none" stroke={rgba("#000000", 0.05)} strokeWidth={0.6} />
                </g>
              );
            })}
          </g>

          {/* center circle */}
          <g>
            <circle r={innerRadius} fill="#fff" stroke="rgba(10,20,30,0.04)" strokeWidth={1} />
          </g>
        </svg>
      </div>

      {/* removed controls per user's request */}
    </div>
  );
}

// helpers
function clamp(n: number, a = 0, b = 1) {
  return Math.max(a, Math.min(b, n));
}
function rgba(hex?: string | null, a = 1) {
  if (!hex) return `rgba(88,140,255,${a})`;
  const s = String(hex).replace("#", "");
  const r = parseInt(s.length === 3 ? s[0] + s[0] : s.slice(0, 2), 16);
  const g = parseInt(s.length === 3 ? s[1] + s[1] : s.slice(2, 4), 16);
  const b = parseInt(s.length === 3 ? s[2] + s[2] : s.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${a})`;
}
function sanitizeId(s: string) {
  return String(s).replace(/[^a-zA-Z0-9_-]/g, "_");
}
