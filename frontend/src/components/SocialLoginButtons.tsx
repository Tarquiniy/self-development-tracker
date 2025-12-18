"use client";

import React from "react";

/**
 * Social login buttons
 * Yandex OAuth (Web, Authorization Code)
 *
 * Backend callback:
 *   https://positive-theta.onrender.com/api/auth/yandex/callback
 *
 * Required scope (Yandex, 2025):
 *   login:email
 */

const YANDEX_CLIENT_ID =
  process.env.NEXT_PUBLIC_YANDEX_CLIENT_ID ?? "";

const REDIRECT_URI =
  "https://positive-theta.onrender.com/api/auth/yandex/callback";

export default function SocialLoginButtons(): React.ReactElement {
  function loginWithYandex() {
    if (!YANDEX_CLIENT_ID) {
      alert("YANDEX_CLIENT_ID не задан");
      return;
    }

    const params = new URLSearchParams({
      response_type: "code",
      client_id: YANDEX_CLIENT_ID,
      redirect_uri: REDIRECT_URI,
      scope: "login:email",
    });

    const url = `https://oauth.yandex.com/authorize?${params.toString()}`;

    /**
     * Popup-flow:
     *  - backend вернёт HTML
     *  - postMessage -> window.opener
     *  - затем popup закроется
     */
    window.open(
      url,
      "yandex_oauth",
      "width=520,height=640,noopener,noreferrer"
    );
  }

  return (
    <div className="socialRow">
      <button
        type="button"
        onClick={loginWithYandex}
        className="yandex-btn"
        aria-label="Войти через Яндекс"
      >
        <span className="icon">Я</span>
        <span>Войти через Яндекс</span>

        <style jsx>{`
          .yandex-btn {
            display: flex;
            align-items: center;
            gap: 10px;
            padding: 10px 14px;
            border-radius: 10px;
            border: none;
            cursor: pointer;
            background: #ffcc00;
            color: #000;
            font-weight: 700;
            font-size: 14px;
          }
          .yandex-btn:hover {
            background: #ffdb4d;
          }
          .icon {
            width: 24px;
            height: 24px;
            border-radius: 50%;
            background: #000;
            color: #ffcc00;
            display: flex;
            align-items: center;
            justify-content: center;
            font-weight: 900;
            font-size: 14px;
          }
        `}</style>
      </button>
    </div>
  );
}
