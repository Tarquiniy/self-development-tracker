import React, { useEffect } from "react";

interface TelegramLoginWidgetProps {
  botName: string;
  onAuth: (user: any) => void;
}

const TelegramLoginWidget: React.FC<TelegramLoginWidgetProps> = ({ botName, onAuth }) => {
  useEffect(() => {
    if (!botName) {
      console.error("❌ botName (username бота) не задан");
      return;
    }

    // Очищаем предыдущий виджет
    const container = document.getElementById("telegram-login-container");
    if (container) {
      container.innerHTML = "";
    }

    // Создаем новый контейнер если не существует
    let widgetContainer = document.getElementById("telegram-login-container");
    if (!widgetContainer) {
      widgetContainer = document.createElement("div");
      widgetContainer.id = "telegram-login-container";
      document.body.appendChild(widgetContainer);
    }

    // Убедимся, что скрипт загружен только один раз
    if (!window.TelegramLoginWidget) {
      const script = document.createElement("script");
      script.src = "https://telegram.org/js/telegram-widget.js?22";
      script.async = true;
      script.onload = () => {
        initTelegramWidget();
      };
      document.body.appendChild(script);
      
      window.TelegramLoginWidget = {
        init: initTelegramWidget
      };
    } else {
      initTelegramWidget();
    }

    function initTelegramWidget() {
      // @ts-ignore
      window.TelegramLoginWidget = {
        dataOnauth: (user: any) => {
          console.log("Telegram user data:", user);
          onAuth(user);
        }
      };

      // Создаем кнопку Telegram
      const telegramButton = document.createElement("script");
      telegramButton.async = true;
      telegramButton.src = `https://telegram.org/js/telegram-widget.js?22`;
      telegramButton.setAttribute("data-telegram-login", botName);
      telegramButton.setAttribute("data-size", "large");
      telegramButton.setAttribute("data-request-access", "write");
      telegramButton.setAttribute("data-userpic", "false");
      telegramButton.setAttribute("data-onauth", "TelegramLoginWidget.dataOnauth(user)");
      
      widgetContainer!.innerHTML = "";
      widgetContainer!.appendChild(telegramButton);
    }

    return () => {
      // Очистка при размонтировании компонента
      const container = document.getElementById("telegram-login-container");
      if (container) {
        container.innerHTML = "";
      }
    };
  }, [botName, onAuth]);

  return (
    <div className="flex justify-center mt-4">
      <div id="telegram-login-container"></div>
    </div>
  );
};

// Добавляем глобальный интерфейс для TypeScript
declare global {
  interface Window {
    TelegramLoginWidget: any;
  }
}

export default TelegramLoginWidget;