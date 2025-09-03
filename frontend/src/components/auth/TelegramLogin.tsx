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

    // Создаем iframe для Telegram Login Widget
    const iframe = document.createElement('iframe');
    iframe.src = `https://oauth.telegram.org/auth?bot_id=${botName}&origin=${encodeURIComponent(window.location.origin)}&embed=1&request_access=write`;
    iframe.style.width = '100%';
    iframe.style.height = '100%';
    iframe.style.border = 'none';
    iframe.style.borderRadius = '8px';
    
    // Создаем контейнер для iframe
    const container = document.createElement('div');
    container.style.position = 'fixed';
    container.style.top = '50%';
    container.style.left = '50%';
    container.style.transform = 'translate(-50%, -50%)';
    container.style.width = '400px';
    container.style.height = '500px';
    container.style.backgroundColor = 'white';
    container.style.borderRadius = '12px';
    container.style.boxShadow = '0 10px 25px rgba(0, 0, 0, 0.2)';
    container.style.zIndex = '1000';
    container.appendChild(iframe);
    
    // Создаем overlay
    const overlay = document.createElement('div');
    overlay.style.position = 'fixed';
    overlay.style.top = '0';
    overlay.style.left = '0';
    overlay.style.width = '100%';
    overlay.style.height = '100%';
    overlay.style.backgroundColor = 'rgba(0, 0, 0, 0.5)';
    overlay.style.zIndex = '999';
    
    // Добавляем кнопку закрытия
    const closeButton = document.createElement('button');
    closeButton.innerHTML = '×';
    closeButton.style.position = 'absolute';
    closeButton.style.top = '10px';
    closeButton.style.right = '10px';
    closeButton.style.background = 'none';
    closeButton.style.border = 'none';
    closeButton.style.fontSize = '24px';
    closeButton.style.color = '#666';
    closeButton.style.cursor = 'pointer';
    closeButton.style.zIndex = '1001';
    
    closeButton.onclick = () => {
      document.body.removeChild(overlay);
      document.body.removeChild(container);
    };
    
    container.appendChild(closeButton);
    
    // Обработчик сообщений от Telegram
    const handleMessage = (event: MessageEvent) => {
      if (event.origin !== 'https://oauth.telegram.org') return;
      
      try {
        const data = JSON.parse(event.data);
        
        if (data.event === 'auth_result') {
          const authData = data.result;
          
          if (authData && authData.id) {
            // Закрываем popup
            document.body.removeChild(overlay);
            document.body.removeChild(container);
            
            // Отправляем данные на бэкенд
            fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:8000'}/api/auth/telegram/callback/`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
              },
              body: JSON.stringify(authData),
            })
            .then(response => response.json())
            .then(data => {
              if (data.status === 'success') {
                // Сохраняем токены
                localStorage.setItem('accessToken', data.tokens.access);
                localStorage.setItem('refreshToken', data.tokens.refresh);
                
                // Вызываем callback
                onAuth(authData);
              } else {
                console.error('Telegram auth failed:', data.message);
              }
            })
            .catch(error => {
              console.error('Telegram auth error:', error);
            });
          }
        }
      } catch (error) {
        console.error('Error parsing Telegram message:', error);
      }
    };
    
    // Добавляем обработчик сообщений
    window.addEventListener('message', handleMessage);
    
    // Удаляем обработчик при закрытии
    const cleanup = () => {
      window.removeEventListener('message', handleMessage);
      if (document.body.contains(overlay)) {
        document.body.removeChild(overlay);
      }
      if (document.body.contains(container)) {
        document.body.removeChild(container);
      }
    };
    
    overlay.onclick = cleanup;
    closeButton.onclick = cleanup;
    
    // Добавляем элементы на страницу
    document.body.appendChild(overlay);
    document.body.appendChild(container);
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