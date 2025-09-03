import React, { useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';

const TelegramCallback: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  useEffect(() => {
    // Простая обработка callback - перенаправляем данные обратно
    const authData: Record<string, string> = {};
    
    // Собираем все параметры
    searchParams.forEach((value, key) => {
      authData[key] = value;
    });

    // Если есть hash (стандартный способ Telegram)
    if (window.location.hash) {
      const hashParams = new URLSearchParams(window.location.hash.substring(1));
      hashParams.forEach((value, key) => {
        authData[key] = value;
      });
    }

    console.log('Telegram callback data:', authData);

    // Проверяем наличие минимальных необходимых данных
    if (authData.id && authData.auth_date && authData.hash) {
      // Отправляем сообщение родительскому окну
      if (window.opener) {
        window.opener.postMessage({
          type: 'TELEGRAM_AUTH_DATA',
          user: authData
        }, window.location.origin);
      } else {
        // Сохраняем в localStorage для обработки в основном окне
        localStorage.setItem('telegramAuthData', JSON.stringify(authData));
      }
      
      // Закрываем окно
      window.close();
    } else {
      console.error('Invalid Telegram auth data');
      navigate('/login', { 
        state: { error: 'Invalid authentication data from Telegram' } 
      });
    }
  }, [navigate, searchParams]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="text-center">
        <h2 className="text-lg font-medium text-gray-900">Завершение аутентификации</h2>
        <p className="mt-2 text-sm text-gray-600">Пожалуйста, подождите...</p>
      </div>
    </div>
  );
};

export default TelegramCallback;