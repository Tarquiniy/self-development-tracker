"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import supabase from "@/lib/supabaseClient";
import { JSX } from "react/jsx-runtime";

type TableMeta = {
  id: string;
  title: string;
  created_at?: string;
  updated_at?: string;
  rows_count?: number;
  last_entry_at?: string | null;
  // дополнительные поля, какие есть в бэке
};

function PetalChart({ values = [30, 20, 15, 20, 15], size = 86 }: { values?: number[]; size?: number }) {
  // Простая "лепестковая" диаграмма — для визуала
  const petals = values.slice(0, 6);
  const cx = size / 2;
  const cy = size / 2;
  const rBase = size * 0.12;
  const step = (Math.PI * 2) / petals.length;
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden>
      <defs>
        <filter id="soft" x="-50%" y="-50%" width="200%" height="200%">
          <feDropShadow dx="0" dy="2" stdDeviation="4" floodOpacity="0.06" />
        </filter>
      </defs>
      <g transform={`translate(${cx},${cy})`} filter="url(#soft)">
        {petals.map((v, i) => {
          const a = i * step - Math.PI / 2;
          const len = rBase + (Math.max(0, v) / 100) * (size * 0.45);
          const x = Math.cos(a) * len;
          const y = Math.sin(a) * len;
          // path: simple rounded petal using ellipse arc approximations
          const rx = size * 0.14;
          const ry = Math.max(8, Math.abs(len) * 0.6);
          const rotate = (a * 180) / Math.PI;
          const colorHue = (i * 55) % 360;
          const fill = `hsl(${colorHue} 85% 55% / 1)`;
          return (
            <g key={i} transform={`rotate(${rotate}) translate(${x * 0.12}, ${y * 0.12})`}>
              <ellipse cx={0} cy={ry * -0.4} rx={rx} ry={ry} fill={fill} opacity={0.98} />
            </g>
          );
        })}
        {/* center */}
        <circle r={size * 0.13} fill="#ffffff" stroke="rgba(15,23,36,0.06)" />
      </g>
    </svg>
  );
}

export default function TablesPage(): JSX.Element {
  const [tables, setTables] = useState<TableMeta[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [debugLog, setDebugLog] = useState<string[]>([]);

  useEffect(() => {
    loadTables();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function log(msg: string) {
    setDebugLog((s) => [new Date().toISOString() + " — " + msg, ...s].slice(0, 80));
    console.debug(msg);
  }

  async function loadTables() {
    setLoading(true);
    setError(null);
    await log("Запрос /api/tables?user_id=me");
    try {
      // попытка через internal API. Сервер должен корректно разрешать "me"
      const resp = await fetch(`/api/tables?user_id=me`, { cache: "no-store" });
      const json = await resp.json().catch(() => null);
      if (!resp.ok) {
        setError(String(json?.error ?? resp.statusText ?? "Ошибка загрузки"));
        await log(`API error ${resp.status}: ${JSON.stringify(json)}`);
        setTables([]);
        setLoading(false);
        return;
      }
      const data = (json?.data ?? json) as TableMeta[] | null;
      await log(`Получено ${Array.isArray(data) ? data.length : 0} таблиц`);
      setTables(Array.isArray(data) ? data : []);
    } catch (e: any) {
      setError(String(e?.message ?? e));
      await log("Fetch exception: " + String(e?.message ?? e));
      setTables([]);
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <main className="pt-container">
        <div className="headerRow">
          <div>
            <h1>Мои таблицы</h1>
            <p className="muted">Создавай таблицы и отслеживай записи. Данные сохраняются в Supabase.</p>
          </div>
          <div className="actions">
            <Link href="/tables/new" className="btn primary">Создать таблицу</Link>
          </div>
        </div>

        <section className="gridWrap">
          {loading && (
            <>
              <div className="skeletonCard" />
              <div className="skeletonCard" />
              <div className="skeletonCard" />
            </>
          )}

          {!loading && tables && tables.length === 0 && (
            <div className="empty">
              <p>У вас ещё нет таблиц.</p>
              <Link href="/tables/new" className="btn">Создать первую таблицу</Link>
            </div>
          )}

          {!loading && tables && tables.map((t) => (
            <article key={t.id} className="card">
              <div className="cardLeft">
                <div className="petalWrap">
                  <PetalChart values={[
                    Math.min(100, (t.rows_count ?? 0) % 100),
                    Math.min(100, Math.floor(Math.random() * 80)),
                    Math.min(100, Math.floor(Math.random() * 60)),
                    Math.min(100, Math.floor(Math.random() * 40)),
                    Math.min(100, Math.floor(Math.random() * 30)),
                  ]} />
                </div>
              </div>

              <div className="cardMain">
                <div className="titleRow">
                  <h3 className="title">{t.title || "Без названия"}</h3>
                  <div className="meta">
                    <span className="muted small">{t.rows_count ?? 0} записей</span>
                  </div>
                </div>

                <div className="infoRow">
                  <div className="infoCol">
                    <div className="label">Последняя запись</div>
                    <div className="value small">{t.last_entry_at ? new Date(t.last_entry_at).toLocaleString() : "—"}</div>
                  </div>

                  <div className="infoCol">
                    <div className="label">Дата создания</div>
                    <div className="value small">{t.created_at ? new Date(t.created_at).toLocaleDateString() : "—"}</div>
                  </div>
                </div>

                <div className="cardFooter">
                  <Link href={`/tables/${t.id}`} className="btn ghost small">Открыть</Link>
                  <Link href={`/tables/${t.id}/edit`} className="btn small">Редактировать</Link>
                </div>
              </div>
            </article>
          ))}
        </section>

        <aside className="sidebar">
          <div className="panel">
            <h4>Быстрые действия</h4>
            <ul>
              <li><Link href="/tables/new" className="lnk">Создать таблицу</Link></li>
              <li><Link href="/profile" className="lnk">Перейти в профиль</Link></li>
              <li><a className="lnk" onClick={() => { loadTables(); }}>Обновить</a></li>
            </ul>
          </div>

          <div className="panel debug">
            <h4>Отладка</h4>
            <div className="dbgArea">
              <strong>{loading ? "Загрузка..." : "Готово"}</strong>
              <pre>{debugLog.slice(0, 12).join("\n")}</pre>
            </div>
          </div>
        </aside>
      </main>

      <style jsx>{`
        :root {
          --bg: #f7fbff;
          --card: #ffffff;
          --muted: #6b7280;
          --accent: linear-gradient(90deg,#0073e6,#1fa6ff);
          --shadow: 0 10px 30px rgba(16,24,40,0.08);
          --radius: 12px;
        }
        .pt-container {
          max-width: 1180px;
          margin: 28px auto;
          padding: 18px;
          display: grid;
          grid-template-columns: 1fr 320px;
          gap: 18px;
          align-items: start;
        }
        .headerRow {
          grid-column: 1 / -1;
          display:flex;
          justify-content:space-between;
          align-items:center;
          gap:16px;
          margin-bottom: 6px;
        }
        h1 { margin:0; font-size:22px; color:#0f1724; }
        .muted { color: var(--muted); }
        .actions { display:flex; gap:8px; }

        .gridWrap {
          display:grid;
          grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
          gap: 16px;
        }

        .card {
          display:flex;
          gap:12px;
          background: var(--card);
          border-radius: var(--radius);
          padding: 14px;
          box-shadow: var(--shadow);
          align-items: center;
        }
        .cardLeft { width:110px; display:flex; align-items:center; justify-content:center; }
        .petalWrap { width:86px; height:86px; display:flex; align-items:center; justify-content:center; }

        .cardMain { flex:1; display:flex; flex-direction:column; gap:8px; }
        .titleRow { display:flex; justify-content:space-between; align-items:center; gap:8px; }
        .title { margin:0; font-size:16px; color:#051124; }
        .meta .small { color:var(--muted); }

        .infoRow { display:flex; gap:18px; margin-top:4px; }
        .infoCol .label { font-size:12px; color:var(--muted); }
        .infoCol .value { color:#0f1724; font-weight:600; }

        .cardFooter { margin-top:8px; display:flex; gap:8px; align-items:center; }

        .btn {
          display:inline-flex;
          align-items:center;
          gap:8px;
          padding:8px 12px;
          border-radius:10px;
          text-decoration:none;
          background: transparent;
          border: 1px solid rgba(15,23,36,0.06);
          color: #0f1724;
          font-weight:700;
        }
        .btn.primary {
          background: linear-gradient(90deg,#0073e6,#1fa6ff);
          color: #fff;
          border: none;
        }
        .btn.ghost {
          background: rgba(2,6,23,0.03);
          color:#051124;
        }
        .btn.small { padding:6px 10px; font-size:13px; }

        .skeletonCard {
          height:120px;
          border-radius:12px;
          background: linear-gradient(90deg,#f3f7fb,#ffffff);
          box-shadow: var(--shadow);
        }

        .sidebar { background: transparent; }
        .panel { background: var(--card); padding:12px; border-radius:12px; box-shadow: var(--shadow); margin-bottom:12px; }
        .panel h4 { margin:0 0 8px 0; font-size:14px; }
        .panel .dbgArea pre { white-space: pre-wrap; font-size:11px; color:#0f1724; max-height:160px; overflow:auto; }

        .empty { grid-column: 1 / -1; background: var(--card); padding: 22px; border-radius:12px; box-shadow: var(--shadow); text-align:center; }

        @media (max-width: 980px) {
          .pt-container { grid-template-columns: 1fr; padding:12px; }
          .sidebar { order: 2; }
        }
      `}</style>
    </>
  );
}
