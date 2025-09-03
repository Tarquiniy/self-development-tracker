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
        
        // Extract auth data from URL
        let authData: Record<string, string> = {};
        
        // Telegram OAuth can send data in hash or query parameters
        if (window.location.hash) {
          // Data in hash (standard way)
          const hash = window.location.hash.substring(1);
          const params = new URLSearchParams(hash);
          params.forEach((value, key) => {
            authData[key] = value;
          });
        } else {
          // Data in query parameters (alternative way)
          searchParams.forEach((value, key) => {
            authData[key] = value;
          });
        }

        console.log('Extracted auth data:', authData);

        // Check for required fields
        const requiredFields = ['id', 'auth_date', 'hash'];
        const missingFields = requiredFields.filter(field => !authData[field]);
        
        if (missingFields.length > 0) {
          throw new Error(`Missing required fields: ${missingFields.join(', ')}`);
        }

        // Check if data is outdated (more than 24 hours)
        const authDate = parseInt(authData.auth_date, 10);
        const currentTime = Math.floor(Date.now() / 1000);
        const isDataOutdated = currentTime - authDate > 86400; // 24 hours
        
        if (isDataOutdated) {
          throw new Error('Authentication data is outdated. Please log in again.');
        }

        // Send data back to parent window
        if (window.opener) {
          window.opener.postMessage(
            {
              type: 'TELEGRAM_AUTH_DATA',
              user: authData
            },
            window.location.origin
          );
          
          // Give time for message processing
          setTimeout(() => {
            setStatus('success');
            setTimeout(() => window.close(), 1000);
          }, 500);
        } else {
          // If no parent window, save data and redirect
          localStorage.setItem('telegramAuthData', JSON.stringify(authData));
          setStatus('success');
          setTimeout(() => navigate('/login', { 
            state: { telegramAuthData: authData } 
          }), 1000);
        }
      } catch (error) {
        console.error('Telegram auth processing error:', error);
        setStatus('error');
        setErrorMessage(error instanceof Error ? error.message : 'Unknown error');
        
        // Redirect with error
        setTimeout(() => {
          navigate('/login', { 
            state: { 
              error: 'Telegram authentication failed',
              errorDetails: error instanceof Error ? error.message : 'Unknown error'
            } 
          });
        }, 2000);
      }
    };

    processTelegramAuth();
  }, [navigate, searchParams]);

  // Function for manual window closing
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
            <h2 className="text-xl font-semibold text-gray-800 mb-2">Processing authentication</h2>
            <p className="text-gray-600">Please wait, completing Telegram login...</p>
          </>
        )}
        
        {status === 'success' && (
          <>
            <div className="flex justify-center mb-4">
              <svg className="h-12 w-12 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h2 className="text-xl font-semibold text-gray-800 mb-2">Authentication successful!</h2>
            <p className="text-gray-600 mb-4">The window will close automatically in a few seconds.</p>
            <button
              onClick={handleCloseWindow}
              className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              Close window
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
            <h2 className="text-xl font-semibold text-gray-800 mb-2">Authentication error</h2>
            <p className="text-gray-600 mb-2">{errorMessage}</p>
            <p className="text-gray-500 text-sm mb-4">You will be redirected to the login page...</p>
            <button
              onClick={() => navigate('/login')}
              className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              Go to login
            </button>
          </>
        )}
      </div>
    </div>
  );
};

export default TelegramCallback;