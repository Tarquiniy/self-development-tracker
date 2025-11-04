'use client';
import React, { useState } from 'react';
import { supabase } from '@/lib/supabaseClient';

export default function RegisterPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [msg, setMsg] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setMsg(null);

    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { full_name: fullName }
      }
    });

    if (error) {
      setMsg(error.message);
      return;
    }

    // data.user exists. Access token will be issued after confirmation/login.
    setMsg('Пользователь создан. Возможно требуется подтверждение email. Войдите в систему.');
  }

  return (
    <form onSubmit={onSubmit}>
      <input value={fullName} onChange={e=>setFullName(e.target.value)} placeholder="ФИО" />
      <input value={email} onChange={e=>setEmail(e.target.value)} placeholder="Email" />
      <input type="password" value={password} onChange={e=>setPassword(e.target.value)} placeholder="Пароль" />
      <button type="submit">Зарегистрироваться</button>
      {msg && <div>{msg}</div>}
    </form>
  );
}
