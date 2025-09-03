import React, { useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';

const TelegramCallback: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  useEffect(() => {
    const handleCallback = async () => {
      try {
        // Get data from URL parameters
        const authData: any = {};
        searchParams.forEach((value, key) => {
          authData[key] = value;
        });

        console.log('Telegram auth data received:', authData);

        // Validate required fields
        if (authData.id && authData.auth_date && authData.hash) {
          // Send data to backend
          const response = await fetch(
            `${
              import.meta.env.VITE_API_URL || 'http://localhost:8000'
            }/api/auth/telegram/callback/`,
            {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
              },
              body: JSON.stringify(authData),
            }
          );

          if (response.ok) {
            const data = await response.json();
            
            // Store tokens
            localStorage.setItem('accessToken', data.tokens.access);
            localStorage.setItem('refreshToken', data.tokens.refresh);
            
            // Redirect to dashboard
            navigate('/dashboard');
          } else {
            throw new Error('Authentication failed');
          }
        } else {
          throw new Error('Invalid authentication data');
        }
      } catch (error) {
        console.error('Telegram callback error:', error);
        navigate('/login', { state: { error: 'Authentication failed' } });
      }
    };

    handleCallback();
  }, [navigate, searchParams]);

  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="text-center">
        <h2 className="text-lg font-medium text-gray-900">
          Завершение аутентификации через Telegram
        </h2>
        <p className="mt-2 text-sm text-gray-600">Пожалуйста, подождите...</p>
      </div>
    </div>
  );
};

export default TelegramCallback;