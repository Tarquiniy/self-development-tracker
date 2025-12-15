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
  tableId: string;
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

function formatDateIso(d: Date) {
  return d.toISOString().slice(0, 10);
}

export default function CategoriesManager({ tableId, selectedDate, onChange, onDelta, disabledMap }: Props) {
  const [items, setItems] = useState<Cat[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [collapsed, setCollapsed] = useState(true);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [maxValue, setMaxValue] = useState<string>("");
  const [color, setColor] = useState<string>(DEFAULT_COLORS[1]);
  const [editingId, setEditingId] = useState<string | null>(null);

  const mountedRef = useRef(true);
  const titleInputRef = useRef<HTMLInputElement | null>(null);

  const dateForQuery = selectedDate ?? new Date();

  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);

  useEffect(() => {
    if (!tableId) return;
    fetchList(dateForQuery);

    function onEdit(ev: Event) {
      try {
        const detail = (ev as CustomEvent)?.detail ?? {};
        const categoryId = detail?.categoryId ?? null;
        openEditor(categoryId);
      } catch {}
    }

    function onRefresh(ev: Event) {
      try {
        const detail = (ev as CustomEvent)?.detail ?? {};
        const dateIso = detail?.dateIso ?? null;
        if (dateIso) {
          fetchList(new Date(dateIso));
        } else {
          fetchList(dateForQuery);
        }
      } catch {
        fetchList(dateForQuery);
      }
    }

    window.addEventListener("tableEditor:editCategory", onEdit as EventListener);
    window.addEventListener("tableEditor:refreshCategories", onRefresh as EventListener);

    return () => {
      window.removeEventListener("tableEditor:editCategory", onEdit as EventListener);
      window.removeEventListener("tableEditor:refreshCategories", onRefresh as EventListener);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tableId, selectedDate]);

  function notify(next: Cat[]) {
    try { if (typeof onChange === "function") onChange(next); } catch {}
  }

  async function fetchList(date: Date) {
    setLoading(true);
    setError(null);

    const dateIso = formatDateIso(date);

    try {
      const { data: cats, error: catErr } = await supabase
        .from("tables_categories")
        .select("id, title, description, max, color")
        .eq("table_id", tableId)
        .order("position", { ascending: true });

      if (catErr) throw new Error(catErr.message);

      const { data: entries, error: entriesErr } = await supabase
        .from("entries")
        .select("category_id, delta, created_at")
        .eq("table_id", tableId)
        .gte("created_at", `${dateIso}T00:00:00`)
        .lte("created_at", `${dateIso}T23:59:59`);

      if (entriesErr) {
        console.warn("Failed to load entries for date:", entriesErr);
      }

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
        max: typeof c.max === "number" && !Number.isNaN(c.max) ? c.max : null,
        color: c.color ?? DEFAULT_COLORS[i % DEFAULT_COLORS.length],
        value: sums[String(c.id)] ?? 0,
      }));

      if (!mountedRef.current) return;
      setItems(normalized);
      notify(normalized);
    } catch (e: any) {
      if (!mountedRef.current) return;
      console.error(e);
      setError(String(e?.message ?? e ?? "Ошибка загрузки"));
      setItems([]);
      notify([]);
    } finally {
      if (!mountedRef.current) return;
      setLoading(false);
    }
  }

  async function handleAddOrUpdate(e?: React.FormEvent) {
    if (e) e.preventDefault();
    setError(null);
    const t = title.trim();
    if (!t) {
      setError("Введите название цели");
      return;
    }
    setLoading(true);
    try {
      const payload: any = {
        title: t,
        description: description.trim() || null,
        max: maxValue === "" ? null : Number(maxValue),
        color,
        table_id: tableId,
      };

      if (editingId) {
        const { error } = await supabase
          .from("tables_categories")
          .update({
            title: payload.title,
            description: payload.description,
            max: payload.max,
            color: payload.color,
          })
          .eq("id", editingId)
          .eq("table_id", tableId);
        if (error) throw new Error(error.message);
      } else {
        const { error } = await supabase
          .from("tables_categories")
          .insert([
            {
              table_id: tableId,
              title: payload.title,
              description: payload.description,
              max: payload.max,
              color: payload.color,
            },
          ]);
        if (error) throw new Error(error.message);
      }

      setTitle("");
      setDescription("");
      setMaxValue("");
      setColor(DEFAULT_COLORS[1]);
      setEditingId(null);
      setCollapsed(true);

      await fetchList(dateForQuery);
      titleInputRef.current?.focus();
    } catch (ex: any) {
      console.error(ex);
      setError(String(ex?.message ?? ex ?? "Ошибка при добавлении"));
    } finally {
      setLoading(false);
    }
  }

  function openEditor(categoryId: string | null) {
    setEditingId(categoryId ?? null);

    if (!categoryId) {
      setTitle("");
      setDescription("");
      setMaxValue("");
      setColor(DEFAULT_COLORS[1]);
      setCollapsed(false);
      setTimeout(() => titleInputRef.current?.focus(), 50);
      return;
    }

    const found = items.find((it) => String(it.id) === String(categoryId));
    if (!found) {
      fetchList(dateForQuery).then(() => {
        const f = items.find((it) => String(it.id) === String(categoryId));
        if (f) {
          setTitle(f.title);
          setDescription(f.description ?? "");
          setMaxValue(f.max == null ? "" : String(f.max));
          setColor(f.color ?? DEFAULT_COLORS[1]);
          setCollapsed(false);
          setTimeout(() => titleInputRef.current?.focus(), 50);
        }
      });
      return;
    }

    setTitle(found.title);
    setDescription(found.description ?? "");
    setMaxValue(found.max == null ? "" : String(found.max));
    setColor(found.color ?? DEFAULT_COLORS[1]);
    setCollapsed(false);
    setTimeout(() => titleInputRef.current?.focus(), 50);
  }

  async function handleDelete(id: string) {
    if (!confirm("Удалить цель? Это удалит все её записи.")) return;
    setLoading(true);
    setError(null);
    try {
      const { error } = await supabase.from("tables_categories").delete().eq("id", id).eq("table_id", tableId);
      if (error) throw new Error(error.message);

      if (editingId === id) {
        setEditingId(null);
        setCollapsed(true);
      }

      await fetchList(dateForQuery);
    } catch (e: any) {
      console.error(e);
      setError(String(e?.message ?? e ?? "Ошибка при удалении"));
    } finally {
      setLoading(false);
    }
  }

  async function deltaFor(id: string, delta: number) {
    // optimistic update locally
    setItems((prev) => {
      const next = prev.map((it) => (String(it.id) === String(id) ? { ...it, value: Math.max(0, Number(it.value ?? 0) + delta) } : it));
      notify(next);
      return next;
    });

    if (typeof onDelta === "function") {
      try {
        await onDelta(id, delta);
      } catch (e) {
        console.warn("onDelta failed", e);
        // rollback by reloading sums
        await fetchList(dateForQuery);
        return;
      }
      // reload after success
      await fetchList(dateForQuery);
    } else {
      await fetchList(dateForQuery);
    }
  }

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
        <div>
          <h3 style={{ margin: 0 }}>Цели</h3>
          <div style={{ color: "#667085", fontSize: 13 }}>{items.length} целей</div>
        </div>

        <div style={{ display: "flex", gap: 8 }}>
          <button
            onClick={() => {
              setCollapsed((s) => !s);
              if (collapsed) setTimeout(() => titleInputRef.current?.focus(), 50);
            }}
            className="btn-secondary"
            style={{ padding: "8px 12px", borderRadius: 10 }}
          >
            {collapsed ? "Добавить цель" : "Свернуть"}
          </button>
        </div>
      </div>

      {!collapsed && (
        <div style={{ marginBottom: 14 }}>
          <form onSubmit={handleAddOrUpdate} style={{ display: "grid", gap: 8 }}>
            <input id="cat-title-input" ref={titleInputRef} placeholder="Название цели" value={title} onChange={(e) => setTitle(e.target.value)} className="form-control" />
            <textarea placeholder="Описание (макс 160 символов)" value={description} onChange={(e) => { const v = e.target.value; if (v.length <= 160) setDescription(v); }} className="form-control" />
            <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
              <input placeholder="Максимум (число)" type="number" value={maxValue} onChange={(e) => setMaxValue(e.target.value)} className="form-control" style={{ flex: 1 }} />
              <input type="color" value={color} onChange={(e) => setColor(e.target.value)} style={{ width: 52, height: 40, borderRadius: 8, border: "1px solid var(--border)" }} aria-label="цвет цели" />
              <button disabled={loading} type="submit" className="btn btn-primary" style={{ padding: "8px 12px" }}>{editingId ? "Сохранить" : "Создать"}</button>
            </div>
            {error && <div style={{ color: "crimson" }}>{error}</div>}
          </form>
        </div>
      )}

      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {items.length === 0 && <div style={{ color: "#64748b" }}>Категории не найдены</div>}
        {items.map((it) => (
          <div key={it.id} className="card" style={{ padding: 12, borderRadius: 12 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
                <div style={{ width: 56, height: 56, borderRadius: 12, background: it.color ?? DEFAULT_COLORS[0], display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontWeight: 700 }}>
                  {String(it.title || "").slice(0, 1).toUpperCase()}
                </div>
                <div>
                  <div style={{ fontWeight: 700 }}>{it.title}</div>
                  {it.description && <div style={{ color: "#6b7b88", fontSize: 13 }}>{it.description}</div>}
                </div>
              </div>

              <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                <div style={{ textAlign: "right", minWidth: 80 }}>
                  <div style={{ fontWeight: 800 }}>{it.value ?? 0}</div>
                  {typeof it.max === "number" && <div style={{ color: "#94a3b8", fontSize: 12 }}>{it.max} в день</div>}
                </div>
                <div style={{ display: "flex", gap: 8 }}>
                  <button onClick={() => deltaFor(it.id, -1)} style={{ padding: 8, borderRadius: 10, border: "1px solid var(--border)", background: "#fff", cursor: "pointer", color: "hsl(var(--foreground))" }} disabled={loading || !!disabledMap?.[it.id]} aria-label={`Уменьшить ${it.title}`}>−</button>
                  <button onClick={() => deltaFor(it.id, +1)} style={{ padding: 8, borderRadius: 10, border: "1px solid var(--border)", background: "#fff", cursor: "pointer", color: "hsl(var(--foreground))" }} disabled={loading || !!disabledMap?.[it.id]} aria-label={`Увеличить ${it.title}`}>+</button>
                  <button onClick={() => openEditor(it.id)} style={{ padding: 8, borderRadius: 10, border: "1px solid var(--border)", background: "#fff", cursor: "pointer", color: "hsl(var(--foreground))" }} aria-label={`Редактировать ${it.title}`}>Ред.</button>
                  <button onClick={() => handleDelete(it.id)} style={{ padding: 8, borderRadius: 10, border: "1px solid #ffdede", background: "#fff", color: "#900", cursor: "pointer" }} aria-label={`Удалить ${it.title}`}>Уд.</button>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
