// frontend/src/components/CategoriesManager.tsx
"use client";

import React, { useEffect, useRef, useState } from "react";
import { supabase } from "@/lib/supabaseClient";

export type Cat = {
  id: string;
  title: string;
  description?: string | null;
  max?: number | null;
  color?: string | null;
  value?: number;
};

type Props = {
  tableId: string | null;
  selectedDate?: Date;
  onChange?: (items: Cat[]) => void;
  onDelta?: (categoryId: string, delta: number) => Promise<void> | void;
  disabledMap?: Record<string, boolean>;
};

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

function isoDate(d: Date) {
  return d.toISOString().slice(0, 10);
}

export default function CategoriesManager({ tableId, selectedDate, onChange, onDelta, disabledMap }: Props) {
  const [items, setItems] = useState<Cat[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [isOpen, setIsOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [maxValue, setMaxValue] = useState<string>("");
  const [color, setColor] = useState<string>(DEFAULT_COLORS[0]);

  const mounted = useRef(true);
  const titleRef = useRef<HTMLInputElement | null>(null);

  const dateRef = selectedDate ?? new Date();

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  // Expose helper to open "create" modal from page-level buttons:
  useEffect(() => {
    // attach a simple helper to window so page can call window.openCategoryManager()
    (window as any).openCategoryManager = () => {
      openEditor(null);
    };
    return () => {
      try {
        delete (window as any).openCategoryManager;
      } catch {}
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tableId, titleRef, items]);

  useEffect(() => {
    if (!tableId) {
      setItems([]);
      return;
    }
    void fetchList(dateRef);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tableId]);

  useEffect(() => {
    function onEdit(ev: Event) {
      try {
        const detail = (ev as CustomEvent)?.detail ?? {};
        const categoryId = detail?.categoryId ?? null;
        openEditor(categoryId);
      } catch (e) {
        console.warn("onEdit handler error", e);
      }
    }
    function onRefresh(ev: Event) {
      try {
        const detail = (ev as CustomEvent)?.detail ?? {};
        const dateIso = detail?.dateIso ?? null;
        if (dateIso) fetchList(new Date(dateIso)).catch(() => {});
        else fetchList(dateRef).catch(() => {});
      } catch {
        fetchList(dateRef).catch(() => {});
      }
    }
    window.addEventListener("tableEditor:editCategory", onEdit as EventListener);
    window.addEventListener("tableEditor:refreshCategories", onRefresh as EventListener);
    return () => {
      window.removeEventListener("tableEditor:editCategory", onEdit as EventListener);
      window.removeEventListener("tableEditor:refreshCategories", onRefresh as EventListener);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dateRef, tableId, items]);

  async function fetchList(date: Date) {
    if (!tableId) return [];
    setLoading(true);
    setError(null);
    try {
      const dateIso = isoDate(date);
      const { data: cats, error: catErr } = await supabase
        .from("tables_categories")
        .select("id, title, description, max, color")
        .eq("table_id", tableId)
        .order("position", { ascending: true });

      if (catErr) throw new Error(catErr.message || "Ошибка загрузки категорий");

      const { data: entries, error: entriesErr } = await supabase
        .from("entries")
        .select("category_id, delta, created_at")
        .eq("table_id", tableId)
        .gte("created_at", `${dateIso}T00:00:00`)
        .lte("created_at", `${dateIso}T23:59:59`);

      if (entriesErr) console.warn("entries load failed", entriesErr);

      const sums: Record<string, number> = {};
      (Array.isArray(entries) ? entries : []).forEach((e: any) => {
        const cid = String(e.category_id);
        const d = Number(e.delta) || 0;
        sums[cid] = (sums[cid] || 0) + d;
      });

      const normalized: Cat[] = (Array.isArray(cats) ? cats : []).map((c: any, i: number) => ({
        id: String(c.id),
        title: String(c.title ?? `Цель ${i + 1}`),
        description: c.description ?? null,
        max: typeof c.max === "number" ? c.max : null,
        color: c.color ?? DEFAULT_COLORS[i % DEFAULT_COLORS.length],
        value: sums[String(c.id)] ?? 0,
      }));

      if (!mounted.current) return normalized;
      setItems(normalized);
      if (typeof onChange === "function") onChange(normalized);
      return normalized;
    } catch (e: any) {
      console.error(e);
      if (!mounted.current) return [];
      setError(String(e?.message ?? e ?? "Ошибка"));
      setItems([]);
      if (typeof onChange === "function") onChange([]);
      return [];
    } finally {
      if (mounted.current) setLoading(false);
    }
  }

  async function openEditor(categoryId: string | null) {
    setError(null);
    setEditingId(categoryId ?? null);
    const list = await fetchList(dateRef);
    if (!categoryId) {
      setTitle("");
      setDescription("");
      setMaxValue("");
      setColor(DEFAULT_COLORS[0]);
      setIsOpen(true);
      setTimeout(() => titleRef.current?.focus(), 60);
      return;
    }
    const found = list.find((c) => String(c.id) === String(categoryId));
    if (found) {
      setTitle(found.title);
      setDescription(found.description ?? "");
      setMaxValue(found.max == null ? "" : String(found.max));
      setColor(found.color ?? DEFAULT_COLORS[0]);
      setIsOpen(true);
      setTimeout(() => titleRef.current?.focus(), 60);
      return;
    }
    setTitle("");
    setDescription("");
    setMaxValue("");
    setColor(DEFAULT_COLORS[0]);
    setError("Категория не найдена");
    setIsOpen(true);
    setTimeout(() => titleRef.current?.focus(), 60);
  }

  async function saveCategory(e?: React.FormEvent) {
    if (e) e.preventDefault();
    if (!tableId) {
      setError("Таблица не выбрана");
      return;
    }
    const t = title.trim();
    if (!t) {
      setError("Введите название цели");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const payload: any = {
        title: t,
        description: description.trim() || null,
        max: maxValue === "" ? null : Number(maxValue),
        color,
      };
      if (editingId) {
        const { error } = await supabase
          .from("tables_categories")
          .update(payload)
          .eq("id", editingId)
          .eq("table_id", tableId);
        if (error) throw new Error(error.message);
      } else {
        const { error } = await supabase.from("tables_categories").insert([{ table_id: tableId, ...payload }]);
        if (error) throw new Error(error.message);
      }
      await fetchList(dateRef);
      setIsOpen(false);
      setEditingId(null);
    } catch (ex: any) {
      console.error(ex);
      setError(String(ex?.message ?? ex ?? "Ошибка при сохранении"));
    } finally {
      if (mounted.current) setLoading(false);
    }
  }

  async function deleteCategory(id: string) {
    if (!tableId) return;
    if (!confirm("Удалить категорию? Это действие необратимо.")) return;
    setLoading(true);
    try {
      const { error } = await supabase.from("tables_categories").delete().eq("id", id).eq("table_id", tableId);
      if (error) throw new Error(error.message);
      await fetchList(dateRef);
      if (editingId === id) {
        setEditingId(null);
        setIsOpen(false);
      }
    } catch (e: any) {
      console.error(e);
      setError(String(e?.message ?? e ?? "Ошибка при удалении"));
    } finally {
      if (mounted.current) setLoading(false);
    }
  }

  async function deltaFor(categoryId: string, delta: number) {
    if (disabledMap?.[categoryId]) return;
    setLoading(true);
    try {
      if (typeof onDelta === "function") {
        await onDelta(categoryId, delta);
      } else if (tableId) {
        const { error } = await supabase.from("entries").insert([
          { table_id: tableId, category_id: categoryId, delta, value: delta, created_at: new Date().toISOString() },
        ]);
        if (error) throw error;
      } else {
        console.warn("No tableId and no onDelta provided — cannot record entry");
      }
    } catch (e) {
      console.error("deltaFor error", e);
      setError(String((e as any)?.message ?? e ?? "Ошибка"));
    } finally {
      await fetchList(dateRef);
      if (mounted.current) setLoading(false);
    }
  }

  function keyTrigger(e: React.KeyboardEvent, cb: () => void) {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      cb();
    }
  }

  // If modal is not open, render a small sentinel (keeps component mounted).
  // Note: page-level code should call window.openCategoryManager() to open create modal.
  if (!isOpen) {
    return <div style={{ display: "none" }} aria-hidden="true" />;
  }

  return (
    <div
      className="cm-overlay"
      onMouseDown={(e) => {
        // click outside closes modal
        if (e.target === e.currentTarget) {
          setIsOpen(false);
          setEditingId(null);
        }
      }}
    >
      <div className="cm-dialog" role="dialog" aria-modal="true" aria-label={editingId ? "Редактировать цель" : "Создать цель"}>
        <div className="cm-head">
          <div>
            <div className="cm-title">{editingId ? "Редактировать цель" : "Создать цель"}</div>
            <div className="cm-sub">{items.length} категорий</div>
          </div>
          <div
            role="button"
            tabIndex={0}
            className="cm-close"
            onClick={() => {
              setIsOpen(false);
              setEditingId(null);
            }}
            onKeyDown={(e) => keyTrigger(e, () => { setIsOpen(false); setEditingId(null); })}
            title="Закрыть"
          >
            ✕
          </div>
        </div>

        {/* Compact categories list with + / - and value.
            IMPORTANT: hide this list when we are editing a specific category (editingId set).
        */}
        {editingId == null && (
          <div className="cm-list">
            {items.length === 0 && <div className="cm-empty">Категорий нет</div>}
            {items.map((it) => (
              <div key={it.id} className="cm-row-item">
                <div className="cm-left">
                  <div className="cm-avatar" style={{ background: it.color ?? DEFAULT_COLORS[0] }}>{String(it.title || "").slice(0, 1).toUpperCase()}</div>
                  <div className="cm-info">
                    <div className="cm-name">{it.title}</div>
                    {it.description ? <div className="cm-desc">{it.description}</div> : null}
                  </div>
                </div>

                <div className="cm-right">
                  <div className="cm-value">{it.value ?? 0}</div>

                  <div className="cm-counter">
                    <button
                      type="button"
                      className="cm-icon cm-minus"
                      onClick={() => deltaFor(it.id, -1)}
                      disabled={loading || !!disabledMap?.[it.id]}
                      aria-label={`Уменьшить ${it.title}`}
                      title="Уменьшить"
                    >
                      −
                    </button>
                    <button
                      type="button"
                      className="cm-icon cm-plus"
                      onClick={() => deltaFor(it.id, +1)}
                      disabled={loading || !!disabledMap?.[it.id]}
                      aria-label={`Увеличить ${it.title}`}
                      title="Увеличить"
                    >
                      +
                    </button>
                  </div>

                  <div className="cm-actions">
                    <div
                      role="button"
                      tabIndex={0}
                      className="cm-text-btn"
                      onClick={() => openEditor(it.id)}
                      onKeyDown={(e) => keyTrigger(e, () => openEditor(it.id))}
                      title="Редактировать"
                    >
                      Ред.
                    </div>
                    <div
                      role="button"
                      tabIndex={0}
                      className="cm-text-btn danger"
                      onClick={() => deleteCategory(it.id)}
                      onKeyDown={(e) => keyTrigger(e, () => deleteCategory(it.id))}
                      title="Удалить"
                    >
                      Уд.
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Form */}
        <form onSubmit={saveCategory} className="cm-form" onMouseDown={(e) => e.stopPropagation()}>
          <label className="cm-label">
            Название
            <input ref={titleRef} className="cm-input" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Название цели" />
          </label>

          <label className="cm-label">
            Описание (макс 160)
            <textarea className="cm-textarea" value={description} onChange={(e) => { if (e.target.value.length <= 160) setDescription(e.target.value); }} placeholder="Короткое описание (опционально)" />
          </label>

          <div className="cm-row-form">
            <label className="cm-label cm-flex">
              Максимум
              <input className="cm-input" type="number" min="0" value={maxValue} onChange={(e) => setMaxValue(e.target.value)} placeholder="Кол-во в день" />
            </label>

            <label className="cm-label cm-color-wrap">
              Цвет
              <input className="cm-color" type="color" value={color} onChange={(e) => setColor(e.target.value)} aria-label="Цвет категории" />
            </label>
          </div>

          {error && <div className="cm-error" role="alert">{error}</div>}

          <div className="cm-actions form-actions">
            <div
              role="button"
              tabIndex={0}
              className="cm-btn cm-btn-ghost"
              onClick={() => { setIsOpen(false); setEditingId(null); }}
              onKeyDown={(e) => keyTrigger(e, () => { setIsOpen(false); setEditingId(null); })}
            >
              Отмена
            </div>

            <div
              role="button"
              tabIndex={0}
              className="cm-btn cm-btn-primary"
              onClick={(e) => { void saveCategory(); }}
              onKeyDown={(e) => keyTrigger(e, () => { void saveCategory(); })}
            >
              {editingId ? "Сохранить" : "Создать"}
            </div>
          </div>

          {editingId && (
            <div style={{ marginTop: 8 }}>
              <div
                role="button"
                tabIndex={0}
                className="cm-btn cm-btn-danger"
                onClick={() => editingId && deleteCategory(editingId)}
                onKeyDown={(e) => keyTrigger(e, () => editingId && deleteCategory(editingId))}
              >
                Удалить категорию
              </div>
            </div>
          )}
        </form>
      </div>

      <style jsx>{`
        .cm-overlay {
          position: fixed; inset: 0; display:flex; align-items:center; justify-content:center;
          z-index: 999999; background: rgba(6,8,12,0.62);
          -webkit-backdrop-filter: blur(6px); backdrop-filter: blur(6px); padding:18px;
        }
        .cm-dialog { width: min(820px,98vw); max-height: calc(100vh - 48px); overflow:auto;
          background: linear-gradient(180deg,#ffffff,#fbfdff); border-radius:12px; padding:18px;
          box-shadow: 0 18px 60px rgba(2,6,23,0.18); border:1px solid rgba(12,20,30,0.06);
        }
        .cm-head { display:flex; justify-content:space-between; align-items:center; gap:12px; margin-bottom:12px; }
        .cm-title { font-weight:700; font-size:18px; color:#0b1720; }
        .cm-sub { color:#667085; font-size:13px; margin-top:4px; }
        .cm-close { cursor:pointer; padding:8px; border-radius:8px; background:#fff; border:1px solid rgba(12,20,30,0.06); user-select:none; }
        .cm-list { display:flex; flex-direction:column; gap:10px; margin-bottom:12px; }
        .cm-row-item { display:flex; justify-content:space-between; gap:12px; align-items:center; padding:10px; border-radius:10px; background: linear-gradient(180deg,#fff,#fbfdff); border:1px solid rgba(12,20,30,0.04); }
        .cm-left { display:flex; gap:12px; align-items:center; min-width:0; }
        .cm-avatar { width:48px; height:48px; border-radius:10px; display:flex; align-items:center; justify-content:center; color:#fff; font-weight:700; flex:0 0 48px; }
        .cm-info { min-width:0; }
        .cm-name { font-weight:700; color:#0b1720; font-size:14px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
        .cm-desc { color:#667085; font-size:13px; }
        .cm-right { display:flex; align-items:center; gap:8px; flex-shrink:0; }
        .cm-value { min-width:40px; text-align:center; font-weight:800; color:#0b1720; }
        .cm-counter { display:flex; gap:6px; align-items:center; }
        .cm-icon { width:36px; height:36px; display:inline-flex; align-items:center; justify-content:center; border-radius:8px; background:#fff !important; color:#0b1720 !important; border:1px solid rgba(12,20,30,0.06); font-size:18px; font-weight:700; cursor:pointer; box-shadow: 0 6px 14px rgba(2,6,23,0.06); }
        .cm-icon:disabled { opacity:0.5; cursor:not-allowed; }
        .cm-plus { }
        .cm-minus { }
        .cm-actions { display:flex; gap:8px; align-items:center; margin-left:6px; }
        .cm-text-btn { padding:6px 8px; border-radius:8px; border:1px solid rgba(12,20,30,0.06); background:#fff !important; color:#0b1720 !important; font-size:13px; cursor:pointer; }
        .cm-text-btn.danger { border-color: rgba(220,20,60,0.12); color:#b91c1c !important; background:#fff !important; }

        .cm-form { display:flex; flex-direction:column; gap:12px; }
        .cm-label { display:flex; flex-direction:column; gap:6px; font-size:13px; color:#0b1720; }
        .cm-input, .cm-textarea { padding:10px 12px; border-radius:10px; border:1px solid rgba(12,20,30,0.08); font-size:14px; background:#fff; color:#0b1720; }
        .cm-textarea { min-height:96px; resize:vertical; }
        .cm-row-form { display:flex; gap:12px; align-items:flex-start; }
        .cm-flex { flex:1 1 auto; }
        .cm-color-wrap { width:120px; min-width:120px; }
        .cm-color { width:100%; height:44px; padding:0; border-radius:8px; border:1px solid rgba(12,20,30,0.08); background:#fff; }

        .cm-actions.form-actions { display:flex; gap:12px; justify-content:flex-end; margin-top:6px; }
        .cm-btn { display:inline-flex; align-items:center; justify-content:center; gap:10px; cursor:pointer; user-select:none; padding:10px 14px; border-radius:10px; font-weight:700; font-size:14px; border:1px solid rgba(12,20,30,0.06); background:#fff; color:#0b1720; }
        .cm-btn-primary { background:#0b1720; color:#fff; box-shadow: 0 8px 24px rgba(2,6,23,0.08); }
        .cm-btn-ghost { background:transparent; border:1px solid rgba(12,20,30,0.06); color:#0b1720; }
        .cm-btn-danger { background:#fff; color:#b91c1c; border:1px solid rgba(185,28,28,0.12); }

        .cm-error { color:crimson; font-size:13px; padding:6px 8px; background: rgba(255,240,240,0.8); border-radius:8px; }

        @media (max-width:720px) {
          .cm-overlay { align-items:flex-end; padding:0; }
          .cm-dialog { width:100%; max-height:92vh; border-radius:12px 12px 0 0; padding:14px; box-shadow: 0 -8px 30px rgba(2,6,23,0.12); }
          .cm-row-form { flex-direction:column; }
          .cm-color-wrap { width:100%; min-width:auto; }
          .cm-actions.form-actions { flex-direction:column-reverse; gap:10px; }
          .cm-btn { width:100%; padding:12px 14px; }
          .cm-name { white-space:normal; display:-webkit-box; -webkit-line-clamp:2; -webkit-box-orient:vertical; overflow:hidden; }
        }
      `}</style>
    </div>
  );
}
