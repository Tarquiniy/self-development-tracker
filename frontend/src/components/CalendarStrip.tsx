// frontend/src/components/CalendarStrip.tsx
"use client";

import React, { useEffect, useMemo, useState } from "react";

/* --- helpers ------------------------------------------------------------ */
function shortWeekday(date: Date) {
  return date.toLocaleDateString(undefined, { weekday: "short" });
}
function dayNum(date: Date) {
  return date.getDate();
}
const iso = (d: Date) => d.toISOString().slice(0, 10);

/* ------------------------------------------------------------------------ */
/* CalendarStrip API:

  props:
    selectedDate?: Date
    onChange?: (d: Date) => void
    onRange?: (startIso: string, endIso: string) => void

------------------------------------------------------------------------ */

export type CalendarStripProps = {
  selectedDate?: Date;
  onChange?: (d: Date) => void;
  onRange?: (startIso: string, endIso: string) => void;
};

export default function CalendarStrip({
  selectedDate,
  onChange,
  onRange
}: CalendarStripProps): React.ReactElement {
  // internal selected date
  const [selected, setSelected] = useState<Date>(selectedDate ?? new Date());

  // sync external → internal
  useEffect(() => {
    if (selectedDate) setSelected(selectedDate);
  }, [selectedDate]);

  const center = selected;

  const days = useMemo(() => {
    const arr: Date[] = [];
    for (let i = -7; i <= 7; i++) {
      const d = new Date(center);
      d.setDate(center.getDate() + i);
      arr.push(d);
    }
    return arr;
  }, [center]);

  function pick(d: Date) {
    setSelected(d);
    onChange?.(d);
  }

  function shift(days: number) {
    const d = new Date(selected);
    d.setDate(selected.getDate() + days);
    pick(d);
  }

  /* --- RANGE panel ---------------------------------------------------- */

  const [rangeStart, setRangeStart] = useState<string>(iso(selected));
  const [rangeEnd, setRangeEnd] = useState<string>(iso(selected));

  function applyRange() {
    if (!onRange) return;
    onRange(rangeStart, rangeEnd);
  }

  /* -------------------------------------------------------------------- */

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      {/* Horizontal strip */}
      <div className="calendar-strip" role="group" aria-label="calendar">
        <button className="nav" onClick={() => shift(-7)}>◀</button>

        <div className="days">
          {days.map((d) => {
            const isSel = d.toDateString() === selected.toDateString();
            return (
              <button
                key={d.toISOString()}
                onClick={() => pick(d)}
                className={`day ${isSel ? "sel" : ""}`}
              >
                <div className="weekday">{shortWeekday(d)}</div>
                <div className="daynum">{dayNum(d)}</div>
              </button>
            );
          })}
        </div>

        <button className="nav" onClick={() => shift(7)}>▶</button>

        <style jsx>{`
          .calendar-strip {
            display: flex;
            gap: 8px;
            align-items: center;
          }
          .nav {
            background: transparent;
            border: 0;
            font-size: 18px;
            padding: 8px;
            cursor: pointer;
          }
          .days {
            display: flex;
            gap: 8px;
            overflow: auto;
            padding: 4px 2px;
          }
          .day {
            background: transparent;
            border: 0;
            padding: 6px 10px;
            border-radius: 8px;
            display: flex;
            flex-direction: column;
            gap: 4px;
            align-items: center;
            cursor: pointer;
          }
          .weekday {
            font-size: 12px;
            color: #6b7b88;
          }
          .daynum {
            font-weight: 700;
            font-size: 16px;
            color: #0b1720;
          }
          .day.sel {
            background: linear-gradient(90deg, #e8f7ff, #f2fbff);
            box-shadow: 0 6px 18px rgba(10, 20, 30, 0.04);
            border-radius: 10px;
          }
        `}</style>
      </div>

     
    </div>
  );
}
