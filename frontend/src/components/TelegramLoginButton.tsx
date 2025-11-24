"use client";
import React, { useEffect, useRef, useState } from "react";

export default function TelegramLoginButton(): React.ReactElement {
  const containerRef = useRef<HTMLDivElement>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const BOT_USERNAME = process.env.NEXT_PUBLIC_TELEGRAM_BOT_USERNAME;
    const SITE_ORIGIN = process.env.NEXT_PUBLIC_SITE_ORIGIN;
    const REDIRECT_PATH = "/api/auth/telegram/verify";
    if (!BOT_USERNAME) {
      console.error("TelegramLoginButton: NEXT_PUBLIC_TELEGRAM_BOT_USERNAME is not defined");
      return;
    }
    if (!SITE_ORIGIN) {
      console.error("TelegramLoginButton: NEXT_PUBLIC_SITE_ORIGIN is not defined");
      return;
    }

    if (containerRef.current) {
      containerRef.current.innerHTML = "";
      const script = document.createElement("script");
      script.src = "https://telegram.org/js/telegram-widget.js?15";
      script.async = true;
      script.setAttribute("data-telegram-login", BOT_USERNAME);
      script.setAttribute("data-size", "large");
      script.setAttribute("data-userpic", "false");
      script.setAttribute("data-auth-url", `${SITE_ORIGIN}${REDIRECT_PATH}`);
      script.setAttribute("data-lang", "ru");
      script.setAttribute("data-request-access", "write"); // optional
      containerRef.current.appendChild(script);

      console.log("TelegramLoginButton: widget script added", {BOT_USERNAME, SITE_ORIGIN, REDIRECT_PATH});
    }

    return () => {
      // cleanup if needed
    };
  }, []);

  return (
    <div>
      <div ref={containerRef} />
      {loading && <div style={{ fontSize:13, color:"#666", marginTop:8 }}>Вход через Telegram…</div>}
    </div>
  );
}
