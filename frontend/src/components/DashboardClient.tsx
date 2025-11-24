// frontend/src/components/DashboardClient.tsx
"use client";

import React from "react";
import CategoriesManager from "./CategoriesManager";

type Props = {
  tableId?: string; // id таблицы с целями (если не передан — CategoriesManager покажет сообщение)
};

export default function DashboardClient({ tableId }: Props) {
  return (
    <div className="dashboard-root">
      <main className="page">
        <section className="left-panel">
          <div className="top-card">
            <div className="date-row">
              <div className="date-title">Сегодня</div>
              <div className="date-controls">
                <button aria-label="prev" className="icon-btn">‹</button>
                <div className="date-box">ВС 15</div>
                <button aria-label="next" className="icon-btn">›</button>
              </div>
            </div>

            <div className="petal-wrap" role="img" aria-label="petal-visual">
              <svg viewBox="0 0 320 320" className="petal">
                {/* stylized petals - gentle colors */}
                <g transform="translate(160,160)">
                  <path d="M0 0 C60 -30 120 -10 150 30 C90 60 30 80 0 0" fill="#6fd3ff" opacity="0.95"/>
                  <path d="M0 0 C-30 -70 -80 -110 -120 -90 C-60 -20 -20 10 0 0" fill="#ff6fbf" opacity="0.95"/>
                  <path d="M0 0 C40 60 100 90 140 70 C90 20 40 -10 0 0" fill="#ffd39f" opacity="0.95"/>
                  <path d="M0 0 C-40 60 -100 90 -140 70 C-90 20 -40 -10 0 0" fill="#9fe09f" opacity="0.95"/>
                  <circle cx="0" cy="0" r="10" fill="#ffffff" opacity="0.9"/>
                </g>
              </svg>
            </div>

            <div className="cta-row">
              <button className="btn-add-points">Добавить баллы</button>
            </div>
          </div>

          <div className="goals-card">
            {/* CategoriesManager содержит список целей и форму создания.
                Передаем tableId; если не указан, внутри будет подсказка */}
            <CategoriesManager tableId={tableId ?? ""} />
          </div>
        </section>

        <aside className="right-panel">
          <div className="profile-card">
            <button className="btn-profile">Мой профиль</button>
          </div>

          <div className="metrics-card">
            <h3>Обзор метрик</h3>
            <div className="metrics-graph">— график —</div>
          </div>

          <div className="quick-actions">
            <h4>Быстрые действия</h4>
            <div className="actions-grid">
              <a className="action-create" href="/tables/new">Создать таблицу</a>
              <a className="action-edit" href="/profile">Редактировать профиль</a>
            </div>
          </div>
        </aside>
      </main>

      <style jsx>{`
        .dashboard-root { font-family: Inter, system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial; color:#0b2336; padding: 18px; }

        .page { display:flex; gap:24px; align-items:flex-start; }

        /* Left column (main) */
        .left-panel { flex: 1 1 0; display:flex; flex-direction:column; gap:18px; min-width:0; }
        .top-card { background:linear-gradient(180deg,#fff,#fbfdff); padding:18px; border-radius:16px; box-shadow:0 10px 30px rgba(15,25,40,0.04); }
        .date-row { display:flex; justify-content:space-between; align-items:center; gap:12px; }
        .date-title { font-size:36px; font-weight:800; margin:0; }
        .date-controls { display:flex; align-items:center; gap:8px; }
        .icon-btn { background:transparent; border:1px solid rgba(10,20,30,0.06); border-radius:8px; width:36px; height:36px; font-size:20px; }
        .date-box { border-radius:10px; padding:8px 12px; background:#f6fbff; color:#0b2336; font-weight:700; box-shadow:0 6px 20px rgba(15,25,40,0.03); }

        .petal-wrap { display:flex; justify-content:center; padding:18px 0; }
        .petal { width:320px; height:320px; max-width:80%; }

        .cta-row { display:flex; justify-content:flex-start; margin-top:8px; }
        .btn-add-points { background:#0a1722; color:white; padding:10px 18px; border-radius:12px; border:0; font-weight:700; box-shadow:0 10px 30px rgba(10,20,30,0.08); }

        .goals-card { background:linear-gradient(180deg,#fff,#fffafc); padding:14px; border-radius:16px; box-shadow:0 10px 30px rgba(15,25,40,0.04) }

        /* Right column (sidebar) */
        .right-panel { width:340px; display:flex; flex-direction:column; gap:18px; }
        .profile-card { display:flex; justify-content:flex-end; }
        .btn-profile { background:#0b1720; color:white; padding:10px 16px; border-radius:12px; border:0; font-weight:700; }

        .metrics-card { background:#fff; padding:16px; border-radius:12px; box-shadow:0 8px 24px rgba(15,25,40,0.04) }
        .metrics-card h3 { margin:0 0 12px 0; }
        .metrics-graph { height:160px; display:flex; align-items:center; justify-content:center; color:#6b7b88; }

        .quick-actions { background:#fff; padding:12px; border-radius:12px; box-shadow:0 8px 24px rgba(15,25,40,0.04) }
        .actions-grid { display:flex; gap:12px; margin-top:8px; }
        .action-create { background:linear-gradient(90deg,#0073e6,#1fa6ff); color:white; padding:10px 14px; border-radius:12px; font-weight:700; text-decoration:none; }
        .action-edit { background:#fff; border:1px solid rgba(10,20,30,0.06); padding:10px 14px; border-radius:12px; text-decoration:none; color:#0b2336; }

        /* mobile layout */
        @media (max-width: 880px) {
          .page { flex-direction:column; }
          .right-panel { width:100%; order:3; }
          .left-panel { order:1; }
          .petal { width: 260px; height:260px; }
          .date-title { font-size:28px; }
          .btn-add-points { width:100%; justify-content:center; }
        }
      `}</style>
    </div>
  );
}
