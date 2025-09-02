import React from 'react';

declare global {
  interface Window {
    TelegramLoginWidget?: {
      dataOnauth: (user: any) => void;
    };
  }
}

interface TelegramUser {
  id: number;
  first_name: string;
  last_name?: string;
  username?: string;
  photo_url?: string;
  auth_date: number;
  hash: string;
}

interface TelegramLoginProps {
  botName: string;
  onAuth: (user: TelegramUser) => void;
  buttonSize?: 'large' | 'medium' | 'small';
  className?: string;
  lang?: string;
}

const TelegramLogin: React.FC<TelegramLoginProps> = ({
  botName,
  onAuth,
  buttonSize = 'large',
  className = '',
  lang = 'ru'
}) => {
  const containerId = `telegram-login-${botName}`;

  React.useEffect(() => {
    // Очищаем предыдущий виджет
    const container = document.getElementById(containerId);
    if (container) {
      container.innerHTML = '';
    }

    // Создаем скрипт для Telegram Widget
    const script = document.createElement('script');
    script.src = 'https://telegram.org/js/telegram-widget.js?22';
    script.async = true;
    script.setAttribute('data-telegram-login', botName);
    script.setAttribute('data-size', buttonSize);
    script.setAttribute('data-request-access', 'write');
    script.setAttribute('data-userpic', 'false');
    script.setAttribute('data-lang', lang);
    
    // Указываем callback функцию
    window.TelegramLoginWidget = {
      dataOnauth: (user: TelegramUser) => onAuth(user)
    };
    script.setAttribute('data-onauth', 'TelegramLoginWidget.dataOnauth(user)');

    container?.appendChild(script);

    return () => {
      // Удаляем скрипт при размонтировании компонента
      if (container?.contains(script)) {
        container.removeChild(script);
      }
    };
  }, [botName, buttonSize, onAuth, containerId, lang]);

  return <div id={containerId} className={`telegram-login ${className}`} />;
};

export default TelegramLogin;