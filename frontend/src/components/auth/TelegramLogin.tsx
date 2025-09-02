import React, { useEffect, useRef } from 'react';

declare global {
  interface Window {
    Telegram?: {
      Login?: {
        auth: (
          options: {
            bot_id: string; // именно числовой ID
            request_access?: string;
            size?: 'large' | 'medium' | 'small';
          },
          callback: (user: any) => void
        ) => void;
      };
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
  onAuth: (user: TelegramUser) => void;
  buttonSize?: 'large' | 'medium' | 'small';
  className?: string;
}

const TelegramLogin: React.FC<TelegramLoginProps> = ({
  onAuth,
  buttonSize = 'large',
  className = ''
}) => {
  const widgetInitialized = useRef(false);

  // Читаем env-переменные
  const botId = import.meta.env.VITE_TELEGRAM_BOT_ID; // число

  useEffect(() => {
    if (!botId || widgetInitialized.current) return;

    const initializeWidget = () => {
      try {
        if (window.Telegram && window.Telegram.Login) {
          console.log('Initializing Telegram widget with bot ID:', botId);

          window.Telegram.Login.auth(
            {
              bot_id: botId,
              request_access: 'write',
              size: buttonSize,
            },
            (user: TelegramUser) => {
              if (user && user.id) {
                console.log('Telegram auth successful:', user);
                onAuth(user);
              } else {
                console.error('Invalid Telegram user data received');
              }
            }
          );
          widgetInitialized.current = true;
        }
      } catch (error) {
        console.error('Error initializing Telegram widget:', error);
      }
    };

    if (window.Telegram) {
      initializeWidget();
    } else {
      const scriptCheckInterval = setInterval(() => {
        if (window.Telegram) {
          clearInterval(scriptCheckInterval);
          initializeWidget();
        }
      }, 100);

      setTimeout(() => clearInterval(scriptCheckInterval), 5000);
    }

    return () => {
      widgetInitialized.current = false;
    };
  }, [botId, buttonSize, onAuth]);

  const handleManualClick = () => {
    if (window.Telegram && window.Telegram.Login) {
      try {
        window.Telegram.Login.auth(
          {
            bot_id: botId,
            request_access: 'write',
            size: buttonSize,
          },
          (user: TelegramUser) => {
            if (user && user.id) {
              onAuth(user);
            }
          }
        );
      } catch (error) {
        console.error('Error on manual Telegram auth:', error);
      }
    } else {
      console.error('Telegram widget not available, fallback to OAuth');
      // Fallback через OAuth (важно: bot_id — число!)
      window.open(
        `https://oauth.telegram.org/auth?bot_id=${botId}&origin=${encodeURIComponent(
          window.location.origin
        )}&request_access=write`,
        '_self'
      );
    }
  };

  return (
    <div className={`telegram-login ${className}`}>
      <button
        onClick={handleManualClick}
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
