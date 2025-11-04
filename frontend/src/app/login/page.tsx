'use client';
import React, { useState } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { useRouter } from 'next/navigation';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [msg, setMsg] = useState<string | null>(null);
  const router = useRouter();
  

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setMsg(null);

    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      setMsg(error.message);
      return;
    }

    const accessToken = data?.session?.access_token;
    if (!accessToken) {
      setMsg('Не удалось получить access_token');
      return;
    }

    // Сохраните токен на клиенте (например, в memory или localStorage)
    localStorage.setItem('sb_access_token', accessToken);

    // Пример запроса к защищённому Django endpoint:
    const res = await fetch('/api/protected-test', {
      headers: { 'Authorization': `Bearer ${accessToken}` }
    });
    if (res.ok) {
      router.push('/dashboard');
    } else {
      setMsg('Вход успешен, но проверка на бекенде вернула ошибку');
    }
  }

  return (
    <form onSubmit={onSubmit}>
      <input value={email} onChange={e=>setEmail(e.target.value)} placeholder="Email" />
      <input type="password" value={password} onChange={e=>setPassword(e.target.value)} placeholder="Пароль" />
      <button type="submit">Войти</button>
      {msg && <div>{msg}</div>}
    </form>
  );
}
