'use client';
import React, { useEffect, useState } from 'react';
import Navbar from '@/components/navbar';
import { supabase } from '@/lib/supabaseClient';

type Profile = {
  id: string;
  email?: string;
  full_name?: string | null;
  created_at?: string | null;
  birthday?: string | null;
  about?: string | null;
  use_gravatar?: boolean | null;
  consent_given?: boolean | null;
  consent_at?: string | null;
};

export default function ProfilePage() {
  const ABOUT_MAX = 500;
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [editing, setEditing] = useState(false);
  const [nameDraft, setNameDraft] = useState('');
  const [birthdayDraft, setBirthdayDraft] = useState<string | null>(null);
  const [aboutDraft, setAboutDraft] = useState('');
  const [msg, setMsg] = useState<string | null>(null);
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [installVisible, setInstallVisible] = useState(false);

  useEffect(() => {
    let mounted = true;
    (async () => {
      setLoading(true);
      const { data: userData } = await supabase.auth.getUser();
      const user = userData?.user;
      if (!user) {
        setLoading(false);
        setMsg('Пользователь не аутентифицирован.');
        return;
      }

      const { data: prof, error } = await supabase.from('profiles').select('*').eq('id', user.id).single();
      if (error) {
        console.warn('profile read:', error);
        setMsg('Не удалось загрузить профиль.');
      } else if (mounted) {
        setProfile(prof as Profile);
        setNameDraft((prof as any)?.full_name ?? '');
        setBirthdayDraft((prof as any)?.birthday ?? null);
        setAboutDraft((prof as any)?.about ?? '');
      }
      setLoading(false);
    })();

    function onBeforeInstall(e: any) {
      e.preventDefault();
      setDeferredPrompt(e);
      setInstallVisible(true);
    }
    window.addEventListener('beforeinstallprompt', onBeforeInstall as any);

    return () => {
      mounted = false;
      window.removeEventListener('beforeinstallprompt', onBeforeInstall as any);
    };
  }, []);

  async function saveProfile() {
    if (!profile) return;
    setMsg(null);
    if (aboutDraft.length > ABOUT_MAX) {
      setMsg(`Поле "О себе" ограничено ${ABOUT_MAX} символами.`);
      return;
    }

    const updates = {
      full_name: nameDraft || null,
      birthday: birthdayDraft || null,
      about: aboutDraft || null,
    };

    try {
      const { error } = await supabase.from('profiles').update(updates).eq('id', profile.id);
      if (error) {
        setMsg('Ошибка сохранения: ' + error.message);
        return;
      }
      setProfile({ ...profile, ...updates });
      setEditing(false);
      setMsg('Изменения сохранены.');
    } catch (e: any) {
      setMsg('Ошибка: ' + (e?.message ?? String(e)));
    }
  }

  const cancelEdit = () => {
    // откатить драфты к значениям профиля
    setNameDraft(profile?.full_name ?? '');
    setBirthdayDraft(profile?.birthday ?? null);
    setAboutDraft(profile?.about ?? '');
    setEditing(false);
    setMsg(null);
  };

  const signOut = async () => {
    try {
      await supabase.auth.signOut();
    } catch (e) {
      console.warn('signOut:', e);
    } finally {
      try { localStorage.removeItem('sb_access_token'); } catch {}
      window.location.href = '/';
    }
  };

  const promptInstall = async () => {
    if (!deferredPrompt) {
      alert('Нажмите "Установить приложение" в меню браузера, чтобы добавить PWA.');
      return;
    }
    deferredPrompt.prompt();
    const choice = await deferredPrompt.userChoice;
    setDeferredPrompt(null);
    setInstallVisible(false);
    console.log('PWA install choice', choice);
  };

  return (
    <>
      <Navbar />
      <main className="page">
        <section className="card" role="region" aria-labelledby="profile-title">
          <div className="headerRow">
            <div>
              <h1 id="profile-title">Мой профиль</h1>
              <p className="lead">Управляйте личными данными и настройками аккаунта.</p>
            </div>

            <div className="avatarBlock" aria-hidden>
              <div className="avatar">{profile?.full_name ? profile.full_name.charAt(0).toUpperCase() : (profile?.email?.charAt(0).toUpperCase() ?? 'U')}</div>
            </div>
          </div>

          {loading ? (
            <div>Загрузка...</div>
          ) : (
            <>
              <div className="field">
                <label>Электронная почта</label>
                <div className="value">{profile?.email ?? '—'}</div>
              </div>

              <div className="field">
                <label>ФИО</label>
                <div className="value">{editing ? (
                  <input value={nameDraft} onChange={e => setNameDraft(e.target.value)} />
                ) : (
                  profile?.full_name ?? '—'
                )}</div>
              </div>

              <div className="field">
                <label>Дата рождения</label>
                <div className="value">{editing ? (
                  <input type="date" value={birthdayDraft ?? ''} onChange={e => setBirthdayDraft(e.target.value || null)} />
                ) : (
                  profile?.birthday ? new Date(profile.birthday).toLocaleDateString() : '—'
                )}</div>
              </div>

              <div className="field">
                <label>О себе</label>
                <div className="value about">{editing ? (
                  <div className="aboutEditWrap">
                    <textarea
                      value={aboutDraft}
                      onChange={e => { if (e.target.value.length <= ABOUT_MAX) setAboutDraft(e.target.value); }}
                      rows={6}
                      maxLength={ABOUT_MAX}
                    />
                    <div className="charCount">{aboutDraft.length}/{ABOUT_MAX}</div>
                  </div>
                ) : (
                  profile?.about ?? '—'
                )}</div>
              </div>

              <div className="field">
                <label>Создан аккаунт</label>
                <div className="value">{profile?.created_at ? new Date(profile.created_at).toLocaleString() : '—'}</div>
              </div>

              <div className="controls">
                {editing ? (
                  <>
                    <button className="btn primary" onClick={saveProfile}>Сохранить</button>
                    <button className="btn cancel" onClick={cancelEdit}>Отмена</button>
                  </>
                ) : (
                  <>
                    <button className="btn editBlack" onClick={() => setEditing(true)}>Редактировать профиль</button>
                  </>
                )}

                {installVisible && <button className="btn primary" onClick={promptInstall}>Установить PWA</button>}
                <button className="btn danger" onClick={signOut}>Выйти</button>
              </div>

              {msg && <div className="serverMsg" role="status">{msg}</div>}
            </>
          )}
        </section>
      </main>

      <style jsx>{`
        .page { padding-top: calc(64px + 24px); display:flex; justify-content:center; align-items:flex-start; min-height:calc(100vh - 64px); background: linear-gradient(180deg,#ffffff 0%, #f7fbff 100%); padding-bottom:48px; }
        .card { width:100%; max-width:900px; margin:32px; background: #fff; border-radius:12px; box-shadow: 0 12px 36px rgba(2,6,23,0.06); padding:28px; }
        .headerRow { display:flex; align-items:center; justify-content:space-between; gap:16px; }
        h1 { margin:0 0 6px 0; font-size:20px; }
        .lead { color:#475569; margin:0 0 14px 0; font-size:13px; }
        .avatarBlock { display:flex; align-items:center; justify-content:center; }
        .avatar { width:64px; height:64px; border-radius:12px; display:flex; align-items:center; justify-content:center; background: linear-gradient(90deg,#16a34a,#60a5fa); color:#fff; font-weight:700; font-size:22px; box-shadow: 0 6px 18px rgba(16,24,40,0.08); }

        .field { margin-top:18px; display:flex; flex-direction:column; gap:6px; }
        .field label { font-weight:700; font-size:13px; color:#0f1724; }
        .value { padding:10px 12px; background:#f8fafc; border-radius:8px; border:1px solid #eef3fb; color:#0f1724; min-height:40px; display:flex; align-items:center; }
        .about { white-space:pre-wrap; }

        input, textarea { padding:10px 12px; border-radius:8px; border:1px solid #e6eef8; min-width:220px; width:100%; box-sizing:border-box; }
        textarea { resize:vertical; min-height:80px; max-height:240px; }

        .aboutEditWrap { display:flex; flex-direction:column; gap:8px; width:100%; }
        .charCount { color:#64748b; font-size:13px; align-self:flex-end; }

        .controls { margin-top:20px; display:flex; gap:12px; flex-wrap:wrap; align-items:center; }
        .btn { padding:10px 14px; border-radius:10px; border:1px solid rgba(2,6,23,0.06); background:#fff; cursor:pointer; font-weight:600; }
        .btn.primary { background: linear-gradient(90deg,#0073e6,#1fa6ff); color:#fff; border:none; }
        .btn.danger { background:#fff; border:1px solid rgba(220,38,38,0.12); color:#dc2626; }
        .btn.editBlack { background: transparent; border: 1px solid rgba(2,6,23,0.06); color: #0f1724; font-weight:700; padding:8px 10px; border-radius:8px; }

        /* Отмена: чёрный текст */
        .btn.cancel { background: transparent; border: 1px solid rgba(2,6,23,0.06); color: #0f1724; font-weight:700; padding:8px 10px; border-radius:8px; }

        .serverMsg { margin-top:12px; color:#0f1724; font-weight:600; }
        @media (max-width:800px) {
          .headerRow { flex-direction:column; align-items:flex-start; gap:12px; }
          .avatar { width:56px; height:56px; font-size:18px; }
          .card { margin:16px; padding:18px; }
        }
      `}</style>
    </>
  );
}
