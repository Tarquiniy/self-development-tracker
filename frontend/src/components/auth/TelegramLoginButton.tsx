import React, { useEffect } from "react";

interface TelegramLoginButtonProps {
  botName: string;
  onAuth: (user: any) => void;
  buttonSize?: "large" | "medium" | "small";
  lang?: string;
}

const TelegramLoginButton: React.FC<TelegramLoginButtonProps> = ({
  botName,
  onAuth,
  buttonSize = "large",
  lang = "ru"
}) => {
  useEffect(() => {
    // Очищаем предыдущий виджет
    const container = document.getElementById("telegram-login-button");
    if (container) {
      container.innerHTML = "";
    }

    // Создаем скрипт для Telegram Widget
    const script = document.createElement("script");
    script.src = "https://telegram.org/js/telegram-widget.js?21";
    script.async = true;
    script.setAttribute("data-telegram-login", botName);
    script.setAttribute("data-size", buttonSize);
    script.setAttribute("data-auth-url", "/api/auth/telegram/auth/");
    script.setAttribute("data-request-access", "write");
    script.setAttribute("data-lang", lang);

    // Глобальная функция обратного вызова
    (window as any).onTelegramAuth = (userData: any) => {
      onAuth(userData);
    };

    const widgetContainer = document.createElement("div");
    widgetContainer.id = "telegram-login-button";
    document.body.appendChild(widgetContainer);
    widgetContainer.appendChild(script);

    return () => {
      // Очистка при размонтировании компонента
      if (widgetContainer && widgetContainer.parentNode) {
        widgetContainer.parentNode.removeChild(widgetContainer);
      }
      delete (window as any).onTelegramAuth;
    };
  }, [botName, onAuth, buttonSize, lang]);

  return (
    <div className="flex justify-center mt-4">
      <div id="telegram-login-button"></div>
    </div>
  );
};

export default TelegramLoginButton;