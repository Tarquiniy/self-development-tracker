import React, { useEffect } from 'react';

interface TelegramLoginWidgetProps {
  botName: string;
  onAuth: (user: any) => void;
}

const TelegramLoginWidget: React.FC<TelegramLoginWidgetProps> = ({ botName, onAuth }) => {
  useEffect(() => {
    const initTelegramAuth = () => {
      if (!botName) {
        console.error('❌ botName (username бота) не задан');
        return;
      }

      const container = document.getElementById('telegram-button');
      if (!container) {
        console.error('❌ Контейнер для Telegram кнопки не найден');
        return;
      }

      container.innerHTML = '';

      const iframe = document.createElement('iframe');
      iframe.src = `https://oauth.telegram.org/auth?bot_id=${botName}&origin=${encodeURIComponent(
        window.location.origin
      )}&embed=1&request_access=write`;
      iframe.width = '250';
      iframe.height = '60';
      iframe.frameBorder = '0';
      iframe.style.border = 'none';
      iframe.style.borderRadius = '8px';

      container.appendChild(iframe);

      // Handle messages from Telegram
      const handleMessage = (event: MessageEvent) => {
        if (event.origin !== 'https://oauth.telegram.org') return;

        try {
          const data = JSON.parse(event.data);
          
          if (data.event === 'auth_result') {
            const authData = data.result;
            console.log('✅ Telegram user data:', authData);
            onAuth(authData);
          }
        } catch (error) {
          console.error('Error parsing Telegram message:', error);
        }
      };

      window.addEventListener('message', handleMessage);

      return () => {
        window.removeEventListener('message', handleMessage);
      };
    };

    initTelegramAuth();
  }, [botName, onAuth]);

  return (
    <div className="flex justify-center mt-4">
      <div
        id="telegram-button"
        style={{ minHeight: '60px', minWidth: '250px' }}
      ></div>
    </div>
  );
};

export default TelegramLoginWidget;