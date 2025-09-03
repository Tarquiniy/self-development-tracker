import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';

const TelegramCallback: React.FC = () => {
  const [status, setStatus] = useState('Обработка авторизации...');
  const navigate = useNavigate();

  useEffect(() => {
    try {
      // В Telegram OAuth данные приходят в hash (#tgAuthResult=...)
      const hashParams = new URLSearchParams(window.location.hash.slice(1));
      const authDataRaw = hashParams.get('tgAuthResult');

      if (!authDataRaw) {
        setStatus('❌ Ошибка: данные авторизации не получены');
        return;
      }

      // Декодируем JSON
      const authData = JSON.parse(decodeURIComponent(authDataRaw));
      console.log('Telegram OAuth данные:', authData);

      // Отправляем данные в родительское окно
      if (window.opener) {
        window.opener.postMessage(
          { type: 'TELEGRAM_AUTH_DATA', user: authData },
          window.location.origin
        );
        setStatus('✅ Авторизация прошла успешно, окно закроется...');
        setTimeout(() => window.close(), 2000);
      } else {
        setStatus('❌ Ошибка: не удалось связаться с приложением');
      }
    } catch (error) {
      console.error('Ошибка в TelegramCallback:', error);
      setStatus('❌ Ошибка при обработке авторизации');
    }
  }, [navigate]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="p-6 bg-white rounded shadow text-center">
        <h2 className="text-lg font-bold mb-4">Telegram Авторизация</h2>
        <p>{status}</p>
      </div>
    </div>
  );
};

export default TelegramCallback;
