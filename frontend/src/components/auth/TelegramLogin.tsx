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
    if (!botName) {
      console.error('Telegram bot name is required');
      return;
    }

    // Open Telegram auth in a new window
    const authUrl = `https://oauth.telegram.org/auth?bot_id=${botName}&origin=${encodeURIComponent(window.location.origin)}&embed=1&request_access=write`;
    
    const width = 550;
    const height = 450;
    const left = (window.screen.width - width) / 2;
    const top = (window.screen.height - height) / 2;

    const authWindow = window.open(
      authUrl,
      'telegram_auth',
      `width=${width},height=${height},left=${left},top=${top},resizable=yes,scrollbars=yes`
    );

    if (!authWindow) {
      console.error('Failed to open authentication window. Please allow popups for this site.');
      return;
    }

    // Listen for messages from the auth window
    const handleMessage = (event: MessageEvent) => {
      if (event.origin !== 'https://oauth.telegram.org') return;

      try {
        const data = JSON.parse(event.data);
        
        if (data.event === 'auth_result') {
          const authData = data.result;
          
          if (authData && authData.id) {
            authWindow.close();
            onAuth(authData);
          }
        }
      } catch (error) {
        console.error('Error parsing Telegram message:', error);
      }
    };

    window.addEventListener('message', handleMessage);

    // Cleanup after 5 minutes
    setTimeout(() => {
      window.removeEventListener('message', handleMessage);
      if (!authWindow.closed) {
        authWindow.close();
      }
    }, 300000);
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