// frontend/src/components/TableEditor.tsx
'use client';

import React, { useEffect, useState } from 'react';
import supabase from '@/lib/supabaseClient';
import Link from 'next/link';

type Category = { id: string; table_id: string; title: string; value: number; target?: number | null; unit?: string | null; created_at?: string };
type Entry = { id: string; table_id: string; category_id: string; value: number; note?: string | null; created_at?: string };

export default function TableEditor({ tableId }: { tableId: string }) {
  const [userId, setUserId] = useState<string | null>(null);
  const [table, setTable] = useState<any | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  const [entries, setEntries] = useState<Entry[]>([]);
  const [newCategoryTitle, setNewCategoryTitle] = useState('');
  const [newEntryCategoryId, setNewEntryCategoryId] = useState<string | null>(null);
  const [newEntryValue, setNewEntryValue] = useState<number | ''>('');
  const [newEntryNote, setNewEntryNote] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    async function init() {
      setLoading(true);
      const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
      if (sessionError) {
        setError(String(sessionError));
        setLoading(false);
        return;
      }
      const user = sessionData?.session?.user ?? null;
      if (!user) {
        setUserId(null);
        setLoading(false);
        return;
      }
      if (!mounted) return;
      setUserId(user.id);
      await loadTable();
      await loadCategories();
      await loadEntries();
      setLoading(false);
    }
    init();
    return () => { mounted = false; };
  }, [tableId]);

  async function loadTable() {
    try {
      const r = await fetch(`/api/tables?owner=${encodeURIComponent(userId ?? '')}`);
      // This returns all tables for owner; filter by id
      if (!r.ok) {
        // try server-side fetch single
        const r2 = await fetch(`/api/tables/${tableId}`).catch(() => null);
        if (r2 && r2.ok) {
          const j = await r2.json();
          setTable(j.table ?? null);
          return;
        }
        return;
      }
      const j = await r.json();
      const t = Array.isArray(j.data) ? j.data.find((x: any) => String(x.id) === String(tableId)) : null;
      setTable(t ?? null);
    } catch (e: any) {
      setError(String(e));
    }
  }

  async function loadCategories() {
    try {
      const r = await fetch(`/api/tables/${tableId}/categories`);
      const j = await r.json();
      if (!r.ok) {
        setError(j?.error ?? 'Ошибка загрузки категорий');
        setCategories([]);
        return;
      }
      setCategories(j.data ?? []);
      if ((j.data ?? []).length > 0) setNewEntryCategoryId((j.data ?? [])[0].id);
    } catch (e: any) {
      setError(String(e));
    }
  }

  async function loadEntries() {
    try {
      const r = await fetch(`/api/tables/${tableId}/entries`);
      const j = await r.json();
      if (!r.ok) {
        setEntries([]);
        return;
      }
      setEntries(j.data ?? []);
    } catch (e: any) {
      setError(String(e));
    }
  }

  async function handleAddCategory(e?: React.FormEvent) {
    e?.preventDefault();
    if (!userId) return setError('Требуется авторизация');
    if (!newCategoryTitle.trim()) return setError('Введите название категории');
    setLoading(true);
    try {
      const r = await fetch(`/api/tables/${tableId}/categories`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ owner: userId, title: newCategoryTitle.trim() }),
      });
      const j = await r.json();
      if (!r.ok) {
        setError(j?.error?.message ?? JSON.stringify(j));
      } else {
        setNewCategoryTitle('');
        await loadCategories();
      }
    } catch (ex: any) {
      setError(String(ex));
    } finally {
      setLoading(false);
    }
  }

  async function handleAddEntry(e?: React.FormEvent) {
    e?.preventDefault();
    if (!userId) return setError('Требуется авторизация');
    if (!newEntryCategoryId) return setError('Выберите категорию');
    if (newEntryValue === '') return setError('Введите значение');
    setLoading(true);
    try {
      const r = await fetch(`/api/tables/${tableId}/entries`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          owner: userId,
          category_id: newEntryCategoryId,
          value: Number(newEntryValue),
          note: newEntryNote || null,
        }),
      });
      const j = await r.json();
      if (!r.ok) setError(j?.error?.message ?? JSON.stringify(j));
      else {
        setNewEntryValue('');
        setNewEntryNote('');
        await loadEntries();
        await loadCategories(); // refresh aggregated values if any
      }
    } catch (ex: any) {
      setError(String(ex));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{ display: 'flex', gap: 24 }}>
      <div style={{ flex: 1 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <h2 style={{ margin: 0 }}>{table?.title ?? 'Таблица'}</h2>
            <div style={{ color: '#64748b' }}>{table?.description ?? ''}</div>
          </div>
          <div>
            <Link href="/dashboard"><button style={btn}>← Назад</button></Link>
          </div>
        </div>

        <section style={{ marginTop: 20 }}>
          <h3>Категории</h3>
          <form onSubmit={handleAddCategory} style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
            <input value={newCategoryTitle} onChange={e => setNewCategoryTitle(e.target.value)} placeholder="Название категории" style={input} />
            <button type="submit" style={btnPrimary}>Добавить</button>
          </form>

          <div style={{ display: 'grid', gap: 8 }}>
            {categories.length === 0 && <div style={{ color: '#64748b' }}>Категорий пока нет.</div>}
            {categories.map(c => (
              <div key={c.id} style={{ padding: 12, borderRadius: 10, background: '#fff', boxShadow: '0 6px 18px rgba(16,24,40,0.04)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <div style={{ fontWeight: 700 }}>{c.title}</div>
                  <div style={{ color: '#64748b', fontSize: 13 }}>{c.value} / {c.target ?? '-' } {c.unit ?? ''}</div>
                </div>
                <div>
                  <button onClick={() => { navigator.clipboard?.writeText(c.id); }} style={tinyBtn}>ID</button>
                </div>
              </div>
            ))}
          </div>
        </section>

        <section style={{ marginTop: 28 }}>
          <h3>Добавить запись</h3>
          <form onSubmit={handleAddEntry} style={{ display: 'grid', gap: 8 }}>
            <label style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <div style={{ width: 120 }}>Категория</div>
              <select value={newEntryCategoryId ?? ''} onChange={e => setNewEntryCategoryId(e.target.value)} style={input}>
                <option value="">— выбрать —</option>
                {categories.map(c => <option key={c.id} value={c.id}>{c.title}</option>)}
              </select>
            </label>

            <label style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <div style={{ width: 120 }}>Значение</div>
              <input type="number" value={newEntryValue} onChange={e => setNewEntryValue(e.target.value === '' ? '' : Number(e.target.value))} style={input} />
            </label>

            <label style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <div style={{ width: 120 }}>Заметка</div>
              <input value={newEntryNote} onChange={e => setNewEntryNote(e.target.value)} style={input} />
            </label>

            <div>
              <button type="submit" style={btnPrimary}>Добавить запись</button>
            </div>
          </form>
        </section>
      </div>

      <aside style={{ width: 380 }}>
        <div style={{ padding: 16, borderRadius: 12, background: '#fff', boxShadow: '0 10px 30px rgba(16,24,40,0.04)' }}>
          <h4 style={{ marginTop: 0 }}>Лента записей</h4>
          <div style={{ display: 'grid', gap: 8 }}>
            {entries.length === 0 && <div style={{ color: '#64748b' }}>Записей ещё нет.</div>}
            {entries.map(en => {
              const cat = categories.find(c => c.id === en.category_id);
              return (
                <div key={en.id} style={{ padding: 10, borderRadius: 8, background: '#f9fafb' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <strong>{cat?.title ?? '—'}</strong>
                    <span>{en.value}</span>
                  </div>
                  <div style={{ color: '#64748b', fontSize: 13 }}>{new Date(en.created_at ?? '').toLocaleString()}</div>
                  {en.note && <div style={{ marginTop: 6 }}>{en.note}</div>}
                </div>
              );
            })}
          </div>
        </div>
      </aside>

      {error && <div style={{ position: 'fixed', bottom: 12, left: 12, color: 'red' }}>{error}</div>}
    </div>
  );
}

/* Простые стили */
const input: React.CSSProperties = { padding: '10px 12px', borderRadius: 8, border: '1px solid #e6edf3', flex: 1, minWidth: 0 };
const btn: React.CSSProperties = { padding: '8px 12px', borderRadius: 8, border: '1px solid #e6edf3', background: '#fff', cursor: 'pointer' };
const tinyBtn: React.CSSProperties = { padding: '6px 8px', borderRadius: 6, border: '1px solid #eef2f6', background: '#fff', cursor: 'pointer' };
const btnPrimary: React.CSSProperties = { padding: '10px 14px', borderRadius: 10, border: 'none', background: 'linear-gradient(90deg,#0073e6,#1fa6ff)', color: '#fff', cursor: 'pointer' };
