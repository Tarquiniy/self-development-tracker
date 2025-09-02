import React, { useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';

const TelegramCallback: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  useEffect(() => {
    // Парсим данные из URL hash или query параметров
    let authData: any = {};
    
    // Сначала проверяем hash (стандартный способ для Telegram OAuth)
    if (window.location.hash) {
      const hash = window.location.hash.substring(1);
      const params = new URLSearchParams(hash);
      
      params.forEach((value, key) => {
        authData[key] = value;
      });
    } 
    // Если в hash нет данных, проверяем query параметры
    else {
      searchParams.forEach((value, key) => {
        authData[key] = value;
      });
    }

    console.log('Telegram auth data received:', authData);

    // Проверяем, что есть необходимые данные
    if (authData.id && authData.auth_date && authData.hash) {
      // Отправляем данные обратно в родительское окно
      if (window.opener) {
        window.opener.postMessage({
          type: 'TELEGRAM_AUTH_DATA',
          user: authData
        }, window.location.origin);
        
        // Закрываем окно
        window.close();
      } else {
        console.error('No window opener found');
        navigate('/login', { state: { error: 'Authentication failed: no opener window' } });
      }
    } else {
      console.error('Invalid Telegram auth data:', authData);
      navigate('/login', { state: { error: 'Invalid authentication data received from Telegram' } });
    }
  }, [navigate, searchParams]);

  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="text-center">
        <h2 className="text-lg font-medium text-gray-900">Завершение аутентификации через Telegram</h2>
        <p className="mt-2 text-sm text-gray-600">Пожалуйста, подождите...</p>
      </div>
    </div>
  );
};

export default TelegramCallback;