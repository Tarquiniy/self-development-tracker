import React, { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';

const TelegramCallback: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [status, setStatus] = useState<'processing' | 'success' | 'error'>('processing');
  const [errorMessage, setErrorMessage] = useState<string>('');

  useEffect(() => {
    const processTelegramAuth = async () => {
      try {
        console.log('Processing Telegram callback...');
        
        // Извлекаем данные авторизации из URL
        let authData: Record<string, string> = {};
        
        // Telegram OAuth может передавать данные в hash или query параметрах
        if (window.location.hash) {
          // Данные в hash (стандартный способ)
          const hash = window.location.hash.substring(1);
          const params = new URLSearchParams(hash);
          params.forEach((value, key) => {
            authData[key] = value;
          });
        } else {
          // Данные в query параметрах (альтернативный способ)
          searchParams.forEach((value, key) => {
            authData[key] = value;
          });
        }

        console.log('Extracted auth data:', authData);

        // Проверяем наличие обязательных полей
        const requiredFields = ['id', 'auth_date', 'hash'];
        const missingFields = requiredFields.filter(field => !authData[field]);
        
        if (missingFields.length > 0) {
          throw new Error(`Отсутствуют обязательные поля: ${missingFields.join(', ')}`);
        }

        // Проверяем, не устарели ли данные (больше 24 часов)
        const authDate = parseInt(authData.auth_date, 10);
        const currentTime = Math.floor(Date.now() / 1000);
        const isDataOutdated = currentTime - authDate > 86400; // 24 часа
        
        if (isDataOutdated) {
          throw new Error('Данные аутентификации устарели. Пожалуйста, войдите снова.');
        }

        // Отправляем данные в родительское окно
        if (window.opener) {
          window.opener.postMessage(
            {
              type: 'TELEGRAM_AUTH_DATA',
              user: authData
            },
            window.location.origin
          );
          
          // Даем время на обработку сообщения
          setTimeout(() => {
            setStatus('success');
            setTimeout(() => window.close(), 1000);
          }, 500);
        } else {
          // Если нет родительского окна, сохраняем данные и перенаправляем
          localStorage.setItem('telegramAuthData', JSON.stringify(authData));
          setStatus('success');
          setTimeout(() => navigate('/login', { 
            state: { telegramAuthData: authData } 
          }), 1000);
        }
      } catch (error) {
        console.error('Telegram auth processing error:', error);
        setStatus('error');
        setErrorMessage(error instanceof Error ? error.message : 'Неизвестная ошибка');
        
        // Перенаправляем с ошибкой
        setTimeout(() => {
          navigate('/login', { 
            state: { 
              error: 'Ошибка аутентификации через Telegram',
              errorDetails: error instanceof Error ? error.message : 'Неизвестная ошибка'
            } 
          });
        }, 2000);
      }
    };

    processTelegramAuth();
  }, [navigate, searchParams]);

  // Функция для ручного закрытия окна
  const handleCloseWindow = () => {
    window.close();
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="max-w-md w-full bg-white p-8 rounded-lg shadow-md text-center">
        {status === 'processing' && (
          <>
            <div className="flex justify-center mb-4">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
            </div>
            <h2 className="text-xl font-semibold text-gray-800 mb-2">Обработка авторизации</h2>
            <p className="text-gray-600">Подождите, завершаем вход через Telegram...</p>
          </>
        )}
        
        {status === 'success' && (
          <>
            <div className="flex justify-center mb-4">
              <svg className="h-12 w-12 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h2 className="text-xl font-semibold text-gray-800 mb-2">Успешная авторизация!</h2>
            <p className="text-gray-600 mb-4">Окно закроется автоматически через несколько секунд.</p>
            <button
              onClick={handleCloseWindow}
              className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              Закрыть окно
            </button>
          </>
        )}
        
        {status === 'error' && (
          <>
            <div className="flex justify-center mb-4">
              <svg className="h-12 w-12 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </div>
            <h2 className="text-xl font-semibold text-gray-800 mb-2">Ошибка авторизации</h2>
            <p className="text-gray-600 mb-2">{errorMessage}</p>
            <p className="text-gray-500 text-sm mb-4">Вы будете перенаправлены на страницу входа...</p>
            <button
              onClick={() => navigate('/login')}
              className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              Перейти к входу
            </button>
          </>
        )}
      </div>
    </div>
  );
};

export default TelegramCallback;