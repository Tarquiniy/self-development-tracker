import React from 'react';

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
}

const TelegramLogin: React.FC<TelegramLoginProps> = ({
  botName,
  onAuth,
  className = ''
}) => {
  React.useEffect(() => {
    // Очищаем предыдущий виджет
    const container = document.getElementById('telegram-login-container');
    if (container) {
      container.innerHTML = '';
    }

    // Создаем скрипт для Telegram Widget
    const script = document.createElement('script');
    script.src = 'https://telegram.org/js/telegram-widget.js?22';
    script.async = true;
    script.setAttribute('data-telegram-login', botName);
    script.setAttribute('data-size', 'large');
    script.setAttribute('data-request-access', 'write');
    script.setAttribute('data-userpic', 'false');
    script.setAttribute('data-lang', 'ru');
    
    // Указываем callback функцию
    const callbackName = `onTelegramAuth_${botName}`;
    (window as any)[callbackName] = (user: TelegramUser) => onAuth(user);
    script.setAttribute('data-onauth', `${callbackName}(user)`);

    const containerElement = document.getElementById('telegram-login-container');
    if (containerElement) {
      containerElement.appendChild(script);
    }

    return () => {
      // Удаляем скрипт при размонтировании компонента
      if (containerElement?.contains(script)) {
        containerElement.removeChild(script);
      }
      // Удаляем callback из глобальной области видимости
      delete (window as any)[callbackName];
    };
  }, [botName, onAuth]);

  return <div id="telegram-login-container" className={`telegram-login ${className}`} />;
};

export default TelegramLogin;