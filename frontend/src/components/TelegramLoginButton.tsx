// frontend/src/components/TelegramLoginButton.tsx
'use client';
import React, { JSX, useEffect, useRef } from 'react';

export default function TelegramLoginButton(): JSX.Element | null {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const botUsername = process.env.NEXT_PUBLIC_TELEGRAM_BOT_USERNAME; // без @
  const siteOrigin = typeof window !== 'undefined' ? window.location.origin : (process.env.NEXT_PUBLIC_SITE_URL || '');

  useEffect(() => {
    if (!botUsername || !containerRef.current) return;

    // Очистка контейнера чтобы не вставлять виджет дважды
    containerRef.current.innerHTML = '';

    // Глобальная callback функция, которую вызывает виджет
    (window as any).onTelegramAuth = async (user: Record<string, any>) => {
      try {
        console.log('TELEGRAM WIDGET CALLBACK: onTelegramAuth invoked', user);

        // Отправляем на сервер POST; используем абсолютный URL
        const resp = await fetch(`${siteOrigin}/api/auth/telegram`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(user),
          credentials: 'include',
        });

        console.log('telegram -> /api/auth/telegram response status', resp.status);
        const text = await resp.text();
        console.log('telegram -> /api/auth/telegram response body', text);

        // Если сервер вернул JSON с action_link — переходим по нему
        try {
          const j = JSON.parse(text);
          if (j?.action_link) {
            window.location.href = j.action_link;
            return;
          }
          if (j?.redirect) {
            window.location.href = j.redirect;
            return;
          }
        } catch (e) {
          // не JSON — просто лог
        }

        // fallback: если тело содержит ссылку прямо
        if (text && text.startsWith('http')) {
          window.location.href = text;
        } else {
          console.warn('No action link returned from /api/auth/telegram');
        }
      } catch (e) {
        console.error('onTelegramAuth handler error', e);
      }
    };

    const script = document.createElement('script');
    script.src = 'https://telegram.org/js/telegram-widget.js?7';
    script.async = true;
    script.id = 'telegram-login-widget-script';

    // Используем callback режим (data-onauth). Это надёжнее в большинстве окружений.
    script.setAttribute('data-telegram-login', botUsername);
    script.setAttribute('data-size', 'large');
    script.setAttribute('data-userpic', 'false');
    script.setAttribute('data-onauth', 'onTelegramAuth');

    containerRef.current.appendChild(script);

    return () => {
      // cleanup
      if (containerRef.current) containerRef.current.innerHTML = '';
      delete (window as any).onTelegramAuth;
      script.remove();
    };
  }, [botUsername, siteOrigin]);

  if (!process.env.NEXT_PUBLIC_TELEGRAM_BOT_USERNAME) return null;

  return (
    <div className="tgWidgetContainer" aria-hidden={false}>
      <div ref={containerRef} />
      <style jsx>{`
        .tgWidgetContainer { display:flex; flex-direction:column; align-items:center; width:100%; }
      `}</style>
    </div>
  );
}
