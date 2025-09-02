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
  const handleTelegramAuth = () => {
    // Убедитесь, что botName - это имя бота, а не URL
    if (!botName) {
      console.error('Telegram bot name is required');
      return;
    }

    // Проверяем, что botName не содержит URL-пути
    const cleanBotName = botName.replace(/https?:\/\/[^/]+\/api/, '').replace(/\//g, '');
    
    if (!cleanBotName) {
      console.error('Invalid bot name. Bot name should be something like "self_development_tracker_bot"');
      return;
    }

    // Альтернативный метод аутентификации через redirect
    const botId = cleanBotName; // Используем очищенное имя бота
    const origin = encodeURIComponent(window.location.origin);
    const returnTo = encodeURIComponent(`${window.location.origin}/telegram-callback`);
    
    // Формируем URL с правильным форматом параметров
    const authUrl = `https://oauth.telegram.org/auth?bot_id=${botId}&origin=${origin}&return_to=${returnTo}&request_access=write`;
    
    console.log('Opening Telegram auth URL:', authUrl);

    // Открываем окно аутентификации Telegram
    const authWindow = window.open(
      authUrl,
      'telegram_auth',
      'width=600,height=400'
    );

    if (!authWindow) {
      console.error('Failed to open authentication window. Please allow popups for this site.');
      return;
    }

    // Слушаем сообщения от callback страницы
    const handleMessage = (event: MessageEvent) => {
      if (event.origin !== window.location.origin) return;
      
      if (event.data && event.data.type === 'TELEGRAM_AUTH_DATA') {
        console.log('Received Telegram auth data:', event.data.user);
        onAuth(event.data.user);
        window.removeEventListener('message', handleMessage);
      }
    };

    window.addEventListener('message', handleMessage);

    // Добавляем таймаут для обработки случая, если окно не закрылось
    setTimeout(() => {
      window.removeEventListener('message', handleMessage);
    }, 300000); // 5 минут таймаут
  };

  return (
    <div className={`telegram-login ${className}`}>
      <button
        onClick={handleTelegramAuth}
        className="w-full flex items-center justify-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
      >
        <svg className="w-5 h-5 mr-2" viewBox="0 0 24 24" fill="currentColor">
          <path d="M12 0C5.373 0 0 5.373 0 12s5.373 12 12 12 12-5.373 12-12S18.627 0 12 0zm5.894 8.221l-1.97 9.28c-.145.658-.537.818-1.084.508l-3-2.21-1.447 1.394c-.16.16-.295.295-.605.295l.213-3.053 5.56-5.022c.242-.213-.054-.334-.373-.121l-6.869 4.326-2.96-.924c-.64-.203-.652-.64.136-.954l11.566-4.458c.538-.196 1.006.128.832.941z"/>
        </svg>
        Войти через Telegram
      </button>
    </div>
  );
};

export default TelegramLogin;