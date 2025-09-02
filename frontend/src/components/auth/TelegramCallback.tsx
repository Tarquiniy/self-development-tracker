import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

const TelegramCallback: React.FC = () => {
  const navigate = useNavigate();

  useEffect(() => {
    // Парсим данные из URL hash
    const hash = window.location.hash.substring(1);
    const params = new URLSearchParams(hash);
    
    const authData: any = {};
    params.forEach((value, key) => {
      authData[key] = value;
    });

    // Проверяем, что есть необходимые данные
    if (authData.id && authData.auth_date && authData.hash) {
      // Отправляем данные обратно в родительское окно
      window.opener.postMessage({
        type: 'TELEGRAM_AUTH_DATA',
        user: authData
      }, window.location.origin);
      
      // Закрываем окно
      window.close();
    } else {
      console.error('Invalid Telegram auth data');
      navigate('/login');
    }
  }, [navigate]);

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