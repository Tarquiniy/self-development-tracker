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

return (
  <div>
    <div id="telegram-login-container" className={`telegram-login ${className}`} />
    {/* Резервная кнопка на случай проблем с виджетом */}
    <button
      onClick={() => {
        const botName = import.meta.env.VITE_TELEGRAM_BOT_NAME;
        window.open(`https://oauth.telegram.org/auth?bot_id=${botName}&origin=${window.location.origin}&return_to=${window.location.origin}/telegram-callback&request_access=write`, '_blank');
      }}
      className="w-full flex items-center justify-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 mt-2"
    >
      <svg className="w-5 h-5 mr-2" viewBox="0 0 24 24" fill="currentColor">
        <path d="M12 0C5.373 0 0 5.373 0 12s5.373 12 12 12 12-5.373 12-12S18.627 0 12 0zm5.894 8.221l-1.97 9.28c-.145.658-.537.818-1.084.508l-3-2.21-1.447 1.394c-.16.16-.295.295-.605.295l.213-3.053 5.56-5.022c.242-.213-.054-.334-.373-.121l-6.869 4.326-2.96-.924c-.64-.203-.652-.64.136-.954l11.566-4.458c.538-.196 1.006.128.832.941z"/>
      </svg>
      Войти через Telegram (альтернативный способ)
    </button>
  </div>
);  
};

export default TelegramLogin;