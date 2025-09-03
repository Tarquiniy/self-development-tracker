import React, { useEffect } from 'react';

interface TelegramLoginWidgetProps {
  botName: string;
  onAuth: (user: any) => void;
}

const TelegramLoginWidget: React.FC<TelegramLoginWidgetProps> = ({ botName, onAuth }) => {
  useEffect(() => {
    if (!botName) {
      console.error('❌ botName (username бота) не задан');
      return;
    }

    const container = document.getElementById('telegram-button');
    if (!container) {
      console.error('❌ Контейнер для Telegram кнопки не найден');
      return;
    }

    container.innerHTML = ''; // очистим на всякий случай

    const script = document.createElement('script');
    script.src = 'https://telegram.org/js/telegram-widget.js?22';
    script.async = true;
    script.setAttribute('data-telegram-login', botName);
    script.setAttribute('data-size', 'large');
    script.setAttribute('data-request-access', 'write');
    script.setAttribute('data-userpic', 'false');
    script.setAttribute('data-onauth', 'onTelegramAuth(user)');

    container.appendChild(script);

    (window as any).onTelegramAuth = (user: any) => {
      console.log('✅ Telegram user data:', user);
      onAuth(user);
    };

    return () => {
      delete (window as any).onTelegramAuth;
    };
  }, [botName, onAuth]);

  return (
    <div className="flex justify-center">
      <div id="telegram-button"></div>
    </div>
  );
};

export default TelegramLoginWidget;
