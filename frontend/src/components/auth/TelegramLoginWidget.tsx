import React, { useEffect } from 'react';

interface TelegramLoginWidgetProps {
  botName: string; // username бота, например "self_development_tracker_bot"
  onAuth: (user: any) => void;
}

const TelegramLoginWidget: React.FC<TelegramLoginWidgetProps> = ({ botName, onAuth }) => {
  useEffect(() => {
    // Удаляем старый виджет (если был)
    const container = document.getElementById('telegram-button');
    if (container) {
      container.innerHTML = '';
    }

    // Подключаем Telegram JS SDK
    const script = document.createElement('script');
    script.src = 'https://telegram.org/js/telegram-widget.js?22';
    script.async = true;
    script.setAttribute('data-telegram-login', botName); // username бота
    script.setAttribute('data-size', 'large');
    script.setAttribute('data-request-access', 'write');
    script.setAttribute('data-userpic', 'false');
    script.setAttribute('data-onauth', 'onTelegramAuth(user)');
    document.getElementById('telegram-button')?.appendChild(script);

    // Глобальная функция для callback
    (window as any).onTelegramAuth = (user: any) => {
      console.log('Telegram user data:', user);
      onAuth(user);
    };

    return () => {
      delete (window as any).onTelegramAuth;
    };
  }, [botName, onAuth]);

  return <div id="telegram-button" className="flex justify-center"></div>;
};

export default TelegramLoginWidget;
