// frontend/src/components/CalendarStrip.tsx
"use client";
import React, { useMemo, useState } from "react";

function formatShortWeekday(date: Date) {
  return date.toLocaleDateString(undefined, { weekday: "short" }); // e.g. "Пн"
}
function formatDayNum(date: Date) {
  return date.getDate();
}

/** small horizontal calendar: shows +/- 14 days around selected date and allows picking */
export default function CalendarStrip({ onChange }: { onChange?: (d: Date) => void }): React.ReactElement {
  const [selected, setSelected] = useState<Date>(() => new Date());
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

  return (
    <div className="calendar-strip" role="group" aria-label="calendar">
      <button className="nav" onClick={() => pick(new Date(selected.getFullYear(), selected.getMonth(), selected.getDate() - 7))}>◀</button>

      <div className="days">
        {days.map((d) => {
          const isSel = d.toDateString() === selected.toDateString();
          return (
            <button key={d.toISOString()} onClick={() => pick(d)} className={`day ${isSel ? "sel" : ""}`}>
              <div className="weekday">{formatShortWeekday(d)}</div>
              <div className="daynum">{formatDayNum(d)}</div>
            </button>
          );
        })}
      </div>

      <button className="nav" onClick={() => pick(new Date(selected.getFullYear(), selected.getMonth(), selected.getDate() + 7))}>▶</button>

      <style jsx>{`
        .calendar-strip { display:flex; gap:8px; align-items:center; }
        .nav { background:transparent; border:0; font-size:18px; padding:8px; cursor:pointer; }
        .days { display:flex; gap:8px; overflow:auto; padding:4px 2px; }
        .day { background:transparent; border:0; padding:6px 10px; border-radius:8px; display:flex; flex-direction:column; gap:4px; align-items:center; cursor:pointer; }
        .day .weekday { font-size:12px; color:#6b7b88; }
        .day .daynum { font-weight:700; font-size:16px; color:#0b1720; }
        .day.sel { background:linear-gradient(90deg,#e8f7ff,#f2fbff); box-shadow:0 6px 18px rgba(10,20,30,0.04); border-radius:10px; }
      `}</style>
    </div>
  );
}
