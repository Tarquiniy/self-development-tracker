"use client";

import React, { useEffect, useRef, useState } from "react";

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
  onChange?: (items: Cat[]) => void;
  onDelta?: (categoryId: string, delta: number) => Promise<void> | void;
  disabledMap?: Record<string, boolean>;
};

const DEFAULT_COLORS = ["#FF6EC7", "#5A9CFF", "#7CE389", "#FFD59A", "#FF8A6B", "#9A7CFF", "#6AD3FF", "#FFB4E6"];

export default function CategoriesManager({ tableId, onChange, onDelta, disabledMap }: Props) {
  const [items, setItems] = useState<Cat[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [collapsed, setCollapsed] = useState(true);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [maxValue, setMaxValue] = useState<string>("");
  const [color, setColor] = useState<string>(DEFAULT_COLORS[1]);

  const mountedRef = useRef(true);
  const titleInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    if (!tableId) return;
    fetchList();
    function onEdit(ev: Event) {
      try {
        const detail = (ev as CustomEvent)?.detail ?? {};
        const categoryId = detail?.categoryId ?? null;
        openEditor(categoryId);
      } catch {}
    }
    window.addEventListener("tableEditor:editCategory", onEdit as EventListener);
    return () => window.removeEventListener("tableEditor:editCategory", onEdit as EventListener);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tableId]);

  function notify(next: Cat[]) {
    try {
      if (typeof onChange === "function") onChange(next);
    } catch {}
  }

  async function fetchList() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/tables/${encodeURIComponent(tableId)}/categories`);
      if (!res.ok) {
        const t = await res.text().catch(() => "");
        throw new Error(`Сервер ${res.status} ${t}`);
      }
      const json = await res.json().catch(() => ({}));
      const arr = Array.isArray(json?.data) ? json.data : Array.isArray(json?.categories) ? json.categories : [];
      const normalized = arr.map((r: any, i: number) => ({
        id: String(r?.id ?? r?.cid ?? `cat_${i}`),
        title: String(r?.title ?? r?.name ?? `Цель ${i + 1}`),
        description: r?.description ?? null,
        max: typeof r?.max === "number" && !Number.isNaN(r.max) ? r.max : null,
        color: r?.color ?? DEFAULT_COLORS[i % DEFAULT_COLORS.length],
        value: typeof r?.value === "number" ? r.value : 0,
      }));
      if (!mountedRef.current) return;
      setItems(normalized);
      notify(normalized);
    } catch (e: any) {
      if (!mountedRef.current) return;
      setError(String(e?.message ?? e ?? "Ошибка загрузки"));
      console.error(e);
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
      const payload = {
        title: t,
        description: description.trim() || null,
        max: maxValue === "" ? null : Number(maxValue),
        color,
      };
      const r = await fetch(`/api/tables/${encodeURIComponent(tableId)}/categories`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(j?.error?.message ?? JSON.stringify(j));
      setTitle("");
      setDescription("");
      setMaxValue("");
      setColor(DEFAULT_COLORS[1]);
      await fetchList();
      titleInputRef.current?.focus();
    } catch (ex: any) {
      setError(String(ex?.message ?? ex ?? "Ошибка при добавлении"));
      console.error(ex);
    } finally {
      setLoading(false);
    }
  }

  function openEditor(categoryId: string | null) {
    if (!categoryId) {
      setCollapsed(false);
      setTimeout(() => titleInputRef.current?.focus(), 50);
      return;
    }
    const found = items.find((it) => String(it.id) === String(categoryId));
    if (!found) {
      fetchList().then(() => {
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
    } else {
      setTitle(found.title);
      setDescription(found.description ?? "");
      setMaxValue(found.max == null ? "" : String(found.max));
      setColor(found.color ?? DEFAULT_COLORS[1]);
      setCollapsed(false);
      setTimeout(() => titleInputRef.current?.focus(), 50);
    }
  }

  async function handleDelete(id: string) {
    if (!confirm("Удалить цель? Это удалит все её записи.")) return;
    setLoading(true);
    setError(null);
    try {
      const r = await fetch(`/api/tables/${encodeURIComponent(tableId)}/categories/${encodeURIComponent(id)}`, { method: "DELETE" });
      if (!r.ok) {
        const body = await r.text().catch(() => "");
        throw new Error(`Удаление не удалось: ${body}`);
      }
      await fetchList();
    } catch (e: any) {
      setError(String(e?.message ?? e ?? "Ошибка при удалении"));
    } finally {
      setLoading(false);
    }
  }

  async function deltaFor(id: string, delta: number) {
    if (typeof onDelta === "function") {
      try {
        await onDelta(id, delta);
      } catch (e) {
        console.warn("onDelta failed", e);
      }
      setItems((prev) => {
        const next = prev.map((it) => (String(it.id) === String(id) ? { ...it, value: Math.max(0, Number(it.value ?? 0) + delta) } : it));
        notify(next);
        return next;
      });
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
            style={{ padding: "8px 12px", borderRadius: 10, border: "1px solid #e6eef9", background: collapsed ? "#0b84ff" : "#fff", color: collapsed ? "#fff" : "#0b2336", cursor: "pointer" }}
          >
            {collapsed ? "Добавить цель" : "Свернуть"}
          </button>
        </div>
      </div>

      {!collapsed && (
        <div style={{ marginBottom: 14 }}>
          <form onSubmit={handleAddOrUpdate} style={{ display: "grid", gap: 8 }}>
            <input id="cat-title-input" ref={titleInputRef} placeholder="Название цели" value={title} onChange={(e) => setTitle(e.target.value)} style={{ padding: 10, borderRadius: 8, border: "1px solid #e6eef3" }} autoComplete="off" />
            <textarea placeholder="Описание (макс 160 символов)" value={description} onChange={(e) => { const v = e.target.value; if (v.length <= 160) setDescription(v); }} style={{ padding: 10, borderRadius: 8, border: "1px solid #e6eef3", minHeight: 64 }} />
            <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
              <input placeholder="Максимум (число)" type="number" value={maxValue} onChange={(e) => setMaxValue(e.target.value)} style={{ padding: 10, borderRadius: 8, border: "1px solid #e6eef3", flex: 1 }} />
              <input type="color" value={color} onChange={(e) => setColor(e.target.value)} style={{ width: 52, height: 40, borderRadius: 8, border: "1px solid #eee", padding: 0 }} aria-label="цвет цели" />
              <button disabled={loading} type="submit" style={{ padding: "8px 12px", borderRadius: 8, border: "none", background: "#0b84ff", color: "#fff", cursor: "pointer" }}>
                Сохранить
              </button>
            </div>
            {error && <div style={{ color: "crimson" }}>{error}</div>}
          </form>
        </div>
      )}

      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {items.length === 0 && <div style={{ color: "#64748b" }}>Категории не найдены</div>}
        {items.map((it) => (
          <div key={it.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: 12, background: "#fff", borderRadius: 12, boxShadow: "0 8px 18px rgba(10,20,30,0.04)" }}>
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
                <button
                  onClick={() => deltaFor(it.id, -1)}
                  style={{ padding: 8, borderRadius: 10, border: "1px solid #e6eef9", background: "#fff", cursor: "pointer" }}
                  disabled={loading || !!disabledMap?.[it.id]}
                >
                  −
                </button>
                <button
                  onClick={() => deltaFor(it.id, +1)}
                  style={{ padding: 8, borderRadius: 10, border: "1px solid #e6eef9", background: "#fff", cursor: "pointer" }}
                  disabled={loading || !!disabledMap?.[it.id]}
                >
                  +
                </button>
                <button onClick={() => openEditor(it.id)} style={{ padding: 8, borderRadius: 10, border: "1px solid #e6eef9", background: "#fff", cursor: "pointer" }}>Ред.</button>
                <button onClick={() => handleDelete(it.id)} style={{ padding: 8, borderRadius: 10, border: "1px solid #ffdede", background: "#fff", color: "#900", cursor: "pointer" }}>Уд.</button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
