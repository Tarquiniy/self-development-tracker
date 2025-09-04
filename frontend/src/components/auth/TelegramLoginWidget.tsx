import React, { useEffect } from "react";

interface TelegramLoginWidgetProps {
  botName: string; // username бота (например, "self_development_tracker_bot")
  onAuth: (user: any) => void;
}

const TelegramLoginWidget: React.FC<TelegramLoginWidgetProps> = ({
  botName,
  onAuth,
}) => {
  useEffect(() => {
    if (!botName) {
      console.error("❌ botName (username бота) не задан");
      return;
    }

    const container = document.getElementById("telegram-button");
    if (!container) {
      console.error("❌ Контейнер для Telegram кнопки не найден");
      return;
    }

    container.innerHTML = "";

    // загружаем виджет только один раз
    if (!document.getElementById("telegram-widget-script")) {
      const script = document.createElement("script");
      script.id = "telegram-widget-script";
      script.src = "https://telegram.org/js/telegram-widget.js?22";
      script.async = true;
      script.setAttribute("data-telegram-login", botName);
      script.setAttribute("data-size", "large");
      script.setAttribute("data-request-access", "write");
      script.setAttribute("data-userpic", "false");
      script.setAttribute("data-onauth", "onTelegramAuth(user)");
      container.appendChild(script);
    }

    (window as any).onTelegramAuth = (user: any) => {
      console.log("✅ Telegram user data:", user);
      onAuth(user);
    };
  }, [botName, onAuth]);

  return (
    <div className="flex justify-center mt-4">
      <div
        id="telegram-button"
        style={{ minHeight: "60px", minWidth: "220px" }}
      ></div>
    </div>
  );
};

export default TelegramLoginWidget;
