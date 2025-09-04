import React, { useEffect, useState } from "react";

interface TelegramLoginWidgetProps {
  botName: string;
  onAuth: (user: any) => void;
  buttonSize?: "large" | "medium" | "small";
  lang?: string;
}

const TelegramLoginWidget: React.FC<TelegramLoginWidgetProps> = ({
  botName,
  onAuth,
  buttonSize = "large",
  lang = "en"
}) => {
  const [isInitialized, setIsInitialized] = useState(false);

  useEffect(() => {
    // Проверяем, находится ли пользователь в Telegram Web App
    if ((window as any).Telegram?.WebApp) {
      const tg = (window as any).Telegram.WebApp;
      
      // Если пользователь уже авторизован в Telegram Web App
      if (tg.initDataUnsafe?.user) {
        const user = tg.initDataUnsafe.user;
        onAuth({
          id: user.id,
          first_name: user.first_name,
          last_name: user.last_name,
          username: user.username,
          photo_url: user.photo_url,
          auth_date: Math.floor(Date.now() / 1000),
          hash: tg.initData
        });
      }
      
      // Обработчик события получения данных
      tg.onEvent('themeChanged', () => {
        // Можно обновить тему интерфейса
      });
      
      return;
    }

    // Если не в Telegram Web App, используем стандартную кнопку
    if (isInitialized) return;

    const scriptId = 'telegram-login-script';
    let script = document.getElementById(scriptId) as HTMLScriptElement;

    if (!script) {
      script = document.createElement('script');
      script.id = scriptId;
      script.src = 'https://telegram.org/js/telegram-widget.js?21';
      script.async = true;
      document.body.appendChild(script);
    }

    script.onload = () => {
      // Глобальная функция обратного вызова
      (window as any).onTelegramAuth = (userData: any) => {
        onAuth(userData);
      };

      setIsInitialized(true);
    };

    return () => {
      // Очистка при размонтировании компонента
      if (script && script.parentNode) {
        script.parentNode.removeChild(script);
      }
      delete (window as any).onTelegramAuth;
    };
  }, [botName, onAuth, isInitialized, lang]);

  if ((window as any).Telegram?.WebApp) {
    // В Telegram Web App кнопка не нужна, данные передаются автоматически
    return null;
  }

  return (
    <div className="flex justify-center mt-4">
      <script
        async
        src="https://telegram.org/js/telegram-widget.js?21"
        data-telegram-login={botName}
        data-size={buttonSize}
        data-auth-url="/api/auth/telegram/auth/"
        data-request-access="write"
        data-lang={lang}
      ></script>
    </div>
  );
};

export default TelegramLoginWidget;