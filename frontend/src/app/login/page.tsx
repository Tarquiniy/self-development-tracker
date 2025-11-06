'use client';
import React, { JSX, useState } from 'react';
import Navbar from '@/components/navbar';
import TelegramLoginButton from '@/components/TelegramLoginButton';
import { supabase } from '@/lib/supabaseClient';
import { useRouter } from 'next/navigation';

export default function LoginPage(): JSX.Element {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const router = useRouter();

  const canSubmit = email.length > 0 && password.length > 0 && !loading;

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setMsg(null);
    if (!canSubmit) {
      setMsg('Введите email и пароль.');
      return;
    }
    setLoading(true);
    try {
      const { data, error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) {
        setMsg('Ошибка входа: ' + error.message);
        setLoading(false);
        return;
      }
      try { localStorage.setItem('sb_access_token', (data?.session?.access_token) ?? ''); } catch {}
      setMsg('Вход выполнен. Перенаправляем...');
      setTimeout(() => router.push('/'), 400);
    } catch (err: any) {
      setMsg(err?.message ?? String(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <Navbar />
      <main className="page">
        <section className="card" aria-labelledby="login-title">
          <h1 id="login-title">Войти</h1>
          <p className="lead">Войдите через Telegram или используйте email и пароль.</p>

          <div className="socialArea">
            <div className="tgWidgetWrap">
              <TelegramLoginButton />
            </div>
          </div>

          <div className="divider"><span>или</span></div>

          <form onSubmit={onSubmit} className="form" noValidate>
            <label className="label">
              <span>Email</span>
              <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="you@example.com" required />
            </label>

            <label className="label">
              <span>Пароль</span>
              <input type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="Ваш пароль" required />
            </label>

            <button type="submit" className="submit" disabled={!canSubmit}>
              {loading ? 'Вхожу...' : 'Войти'}
            </button>

            {msg && <div role="status" className="serverMsg">{msg}</div>}

            <div className="aux">
              <a href="/register">Нет аккаунта? Зарегистрироваться</a>
            </div>
          </form>
        </section>
      </main>

      <style jsx>{`
        /* стили из твоего UI, не менял визуал — оставлены для краткости */
        .page { padding-top: calc(64px + 24px); display:flex; justify-content:center; align-items:flex-start; min-height:calc(100vh - 64px); background: linear-gradient(180deg,#ffffff 0%, #f7fbff 100%); }
        .card { width:100%; max-width:520px; margin:32px; background: #fff; border-radius:12px; padding:28px; box-shadow: 0 10px 30px rgba(2,6,23,0.06); }
        .socialArea { display:flex; flex-direction:column; gap:10px; align-items:center; margin-bottom:10px; }
        .divider { display:flex; align-items:center; justify-content:center; margin:14px 0; }
        .divider span { background:#fff; padding:0 12px; color:#64748b; }
      `}</style>
    </>
  );
}
