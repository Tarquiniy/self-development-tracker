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
  className = '',
}) => {
  React.useEffect(() => {
    // Initialize Telegram Login Widget
    const script = document.createElement('script');
    script.src = 'https://telegram.org/js/telegram-widget.js?22';
    script.async = true;
    script.setAttribute('data-telegram-login', botName);
    script.setAttribute('data-size', 'large');
    script.setAttribute('data-request-access', 'write');
    script.setAttribute('data-auth-url', `${window.location.origin}/telegram-callback`);
    script.setAttribute('data-onauth', 'onTelegramAuth(user)');
    
    // Add global callback function
    (window as any).onTelegramAuth = (user: TelegramUser) => {
      console.log('Telegram auth data received:', user);
      onAuth(user);
    };

    const container = document.getElementById('telegram-login-container');
    if (container) {
      container.appendChild(script);
    }

    return () => {
      // Cleanup
      if (container && container.contains(script)) {
        container.removeChild(script);
      }
      delete (window as any).onTelegramAuth;
    };
  }, [botName, onAuth]);

  return (
    <div id="telegram-login-container" className={`telegram-login ${className}`}>
      {/* Fallback button for cases when widget doesn't load */}
      <button
        onClick={() => {
          const authUrl = `https://oauth.telegram.org/auth?bot_id=${botName}&origin=${encodeURIComponent(window.location.origin)}&return_to=${encodeURIComponent(`${window.location.origin}/telegram-callback`)}&request_access=write`;
          window.open(authUrl, 'telegram_auth', 'width=600,height=400');
        }}
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