'use client';
import React, { JSX, useState } from 'react';
import Navbar from '@/components/navbar';
import TelegramLoginButton from '@/components/TelegramLoginButton';
import { supabase } from '@/lib/supabaseClient';
import { useRouter } from 'next/navigation';

function passwordStrength(password: string) {
  let score = 0;
  if (password.length >= 8) score++;
  if (/[A-Z]/.test(password)) score++;
  if (/[0-9]/.test(password)) score++;
  if (/[^A-Za-z0-9]/.test(password)) score++;
  return { score, max: 4 };
}

export default function RegisterPage(): JSX.Element {
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [accept, setAccept] = useState(true);
  const [useGravatar, setUseGravatar] = useState(true);
  const [birthday, setBirthday] = useState<string | null>(null);
  const [about, setAbout] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const router = useRouter();

  const validEmail = /\S+@\S+\.\S+/.test(email);
  const pwd = passwordStrength(password);
  const canSubmit = validEmail && password.length >= 8 && accept && !loading;

  async function createProfileAfterSignUp(userId: string, emailVal: string) {
    try {
      const { error } = await supabase.from('profiles').insert([{
        id: userId,
        email: emailVal,
        full_name: fullName || null,
        about: about || null,
        birthday: birthday || null,
        use_gravatar: !!useGravatar,
        consent_given: true,
        consent_at: new Date().toISOString(),
        created_at: new Date().toISOString()
      }]);
      if (error) {
        console.warn('profile insert warning:', error);
      }
    } catch (e) {
      console.warn('profile insert exception', e);
    }
  }

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setMsg(null);
    if (!canSubmit) {
      setMsg('Заполните форму корректно и подтвердите согласие на обработку данных.');
      return;
    }
    setLoading(true);

    try {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: { data: { full_name: fullName } },
      });

      if (error) {
        setMsg('Ошибка регистрации: ' + error.message);
        setLoading(false);
        return;
      }

      const userId = data?.user?.id;
      if (!userId) {
        const usr = await supabase.auth.getUser();
        if (usr?.data?.user?.id) {
          await createProfileAfterSignUp(usr.data.user.id, email);
        } else {
          console.warn('signUp succeeded but no user id returned.');
        }
      } else {
        await createProfileAfterSignUp(userId, email);
      }

      try {
        const sessionResp = await supabase.auth.getSession();
        if (sessionResp?.data?.session?.access_token) {
          try { localStorage.setItem('sb_access_token', sessionResp.data.session.access_token); } catch {}
        }
      } catch (_) {}

      setMsg('Регистрация завершена. Перенаправляем на главную...');
      setTimeout(() => router.push('/'), 600);
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
        <section className="card" aria-labelledby="reg-title">
          <h1 id="reg-title">Создать аккаунт</h1>
          <p className="lead">Регистрация быстрее с Telegram или по e-mail.</p>

          <div className="socialArea">
            <div className="tgWidgetWrap">
              <TelegramLoginButton />
            </div>
          </div>

          <div className="divider"><span>или</span></div>

          <form onSubmit={onSubmit} className="form" noValidate>
            <label className="label">
              <span>ФИО</span>
              <input value={fullName} onChange={e => setFullName(e.target.value)} placeholder="Иван Иванов" />
            </label>

            <label className="label">
              <span>Email</span>
              <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="you@example.com" required />
            </label>

            <label className="label">
              <span>Пароль</span>
              <div className="passwordRow">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="Минимум 8 символов"
                  aria-describedby="pwd-help"
                  required
                />
                <button type="button" className="toggle" onClick={() => setShowPassword(s => !s)} aria-label={showPassword ? 'Скрыть пароль' : 'Показать пароль'}>
                  {showPassword ? 'Скрыть' : 'Показать'}
                </button>
              </div>
              <div id="pwd-help" className="hint">Должен содержать буквы, цифры и желательно спецсимвол.</div>

              <div className="strength" aria-hidden>
                <div className={`bar ${pwd.score >= 1 ? 'on' : ''}`}></div>
                <div className={`bar ${pwd.score >= 2 ? 'on' : ''}`}></div>
                <div className={`bar ${pwd.score >= 3 ? 'on' : ''}`}></div>
                <div className={`bar ${pwd.score >= 4 ? 'on' : ''}`}></div>
                <div className="strengthText">{pwd.score >= 3 ? 'Надёжный' : pwd.score === 2 ? 'Средний' : 'Слабый'}</div>
              </div>
            </label>

            <label className="label">
              <span>Дата рождения (необязательно)</span>
              <input type="date" value={birthday ?? ''} onChange={e => setBirthday(e.target.value || null)} />
            </label>

            <label className="label">
              <span>О себе (необязательно)</span>
              <textarea value={about} onChange={e => { if (e.target.value.length <= 500) setAbout(e.target.value); }} rows={4} maxLength={500} />
              <div className="charCount">{about.length}/500</div>
            </label>

            <div className="rowInline">
              <label className="checkbox">
                <input type="checkbox" checked={accept} onChange={e => setAccept(e.target.checked)} />
                <span className="chkText">Я соглашаюсь на использование и обработку моих персональных данных.</span>
              </label>

              <label className="checkbox small">
                <input type="checkbox" checked={useGravatar} onChange={e => setUseGravatar(e.target.checked)} />
                <span className="chkText">Использовать Gravatar</span>
              </label>
            </div>

            <button type="submit" className="submit" disabled={!canSubmit}>
              {loading ? 'Создаю аккаунт...' : 'Создать аккаунт'}
            </button>

            {msg && <div role="status" className="serverMsg">{msg}</div>}
          </form>

          <div className="footer">
            <span>Уже есть аккаунт? </span><a href="/login">Войти</a>
            <span className="muted"> · Нажимая «Создать», вы соглашаетесь с нашей <a href="/privacy">Политикой конфиденциальности</a>.</span>
          </div>
        </section>
      </main>

      <style jsx>{`
        .page { padding-top: calc(64px + 24px); display:flex; justify-content:center; align-items:flex-start; min-height:calc(100vh - 64px); background: linear-gradient(180deg,#f6fbff 0%, #ffffff 100%); }
        .card { width:100%; max-width:640px; margin:32px; background: #fff; border-radius:12px; box-shadow: 0 10px 30px rgba(2,6,23,0.06); padding:28px; }
        h1 { margin:0 0 6px 0; font-size:22px; }
        .lead { color:#475569; margin:0 0 12px 0; font-size:14px; }
        .socialArea { display:flex; flex-direction:column; gap:10px; align-items:center; margin-bottom:10px; }
        .tgWidgetWrap { width:100%; display:flex; justify-content:center; }
        .tgFallback { display:flex; gap:10px; align-items:center; padding:10px 14px; border-radius:10px; background: linear-gradient(90deg,#0088cc,#1fa6ff); color:#fff; text-decoration:none; font-weight:700; }
        .tgFallback svg { opacity:0.95; }
        .divider { display:flex; align-items:center; justify-content:center; margin:14px 0; }
        .divider span { background:#fff; padding:0 12px; color:#64748b; }
        .divider:before { content:''; height:1px; background:#e6eef8; flex:1; margin-right:12px; }
        .divider:after { content:''; height:1px; background:#e6eef8; flex:1; margin-left:12px; }
        .form { display:flex; flex-direction:column; gap:12px; }
        .label span { display:block; font-weight:600; margin-bottom:6px; }
        input, textarea { width:100%; padding:12px; border-radius:8px; border:1px solid #e6eef8; box-sizing:border-box; }
        .passwordRow { display:flex; gap:8px; align-items:center; }
        .toggle { background:transparent; border:none; color:#0f1724; font-weight:600; cursor:pointer; padding:8px; border-radius:8px; }
        .hint { font-size:12px; color:#64748b; margin-top:6px; }
        .strength { display:flex; align-items:center; gap:8px; margin-top:8px; }
        .strength .bar { width:24px; height:8px; background:#e6eef8; border-radius:4px; }
        .strength .bar.on { background: linear-gradient(90deg,#16a34a,#60a5fa); }
        .rowInline { display:flex; gap:12px; align-items:center; justify-content:flex-start; flex-wrap:wrap; }
        .checkbox { display:flex; gap:10px; align-items:center; }
        .chkText { font-size:13px; color:#0f1724; }
        .charCount { font-size:12px; color:#64748b; margin-top:6px; }
        .submit { margin-top:6px; padding:12px; border-radius:10px; border:none; background: linear-gradient(90deg,#0073e6,#1fa6ff); color:#fff; font-weight:700; cursor:pointer; }
        .submit:disabled { opacity:0.6; cursor:not-allowed; }
        .footer { margin-top:16px; display:flex; gap:8px; align-items:center; flex-wrap:wrap; color:#64748b; font-size:13px; }
        .muted a { color: #2563eb; text-decoration:underline; }
        .serverMsg { margin-top:8px; color:#dc2626; font-weight:600; }
        @media (max-width:600px) { .card { margin:16px; padding:18px; } }
      `}</style>
    </>
  );
}
