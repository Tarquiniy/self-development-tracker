import React, { useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';

const TelegramCallback: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  useEffect(() => {
    // Функция для извлечения параметров авторизации
    const extractAuthParams = () => {
      let authData: any = {};
      
      // Telegram может отправлять данные как в hash, так и в query параметрах
      if (window.location.hash) {
        const hash = window.location.hash.substring(1);
        const params = new URLSearchParams(hash);
        
        params.forEach((value, key) => {
          authData[key] = value;
        });
      } else {
        searchParams.forEach((value, key) => {
          authData[key] = value;
        });
      }
      
      return authData;
    };

    const authData = extractAuthParams();
    console.log('Telegram auth data received:', authData);

    // Проверяем обязательные поля
    const requiredFields = ['id', 'auth_date', 'hash'];
    const hasAllRequiredFields = requiredFields.every(field => field in authData);

    if (hasAllRequiredFields) {
      // Отправляем данные обратно в родительское окно
      if (window.opener) {
        try {
          window.opener.postMessage({
            type: 'TELEGRAM_AUTH_DATA',
            user: authData
          }, window.location.origin);
          
          // Даем время на обработку сообщения перед закрытием
          setTimeout(() => {
            window.close();
          }, 100);
        } catch (error) {
          console.error('Error sending message to opener:', error);
          navigate('/login', { 
            state: { error: 'Failed to communicate with parent window' } 
          });
        }
      } else {
        console.error('No window opener found');
        // Если opener недоступен, сохраняем данные в localStorage
        // и перенаправляем на главную страницу
        localStorage.setItem('telegramAuthData', JSON.stringify(authData));
        navigate('/login', { 
          state: { telegramAuthData: authData } 
        });
      }
    } else {
      console.error('Invalid Telegram auth data: missing required fields', authData);
      navigate('/login', { 
        state: { error: 'Invalid authentication data received from Telegram' } 
      });
    }
  }, [navigate, searchParams]);

  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="text-center">
        <h2 className="text-lg font-medium text-gray-900">Завершение аутентификации через Telegram</h2>
        <p className="mt-2 text-sm text-gray-600">Пожалуйста, подождите...</p>
        <p className="mt-1 text-xs text-gray-500">
          Если окно не закрывается автоматически, закройте его вручную.
        </p>
      </div>
    </div>
  );
};

export default TelegramCallback;