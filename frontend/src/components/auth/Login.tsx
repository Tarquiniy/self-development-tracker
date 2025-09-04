import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../../contexts/AuthContext";
import TelegramLoginWidget from "./TelegramLoginWidget";

const Login: React.FC = () => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      await login(email, password);
      navigate("/dashboard");
    } catch (err: any) {
      setError(err.message || "Не удалось войти");
    } finally {
      setLoading(false);
    }
  };

  const handleTelegramAuth = async (telegramUser: any) => {
    try {
      setLoading(true);
      setError("");

      const response = await fetch(
        `${
          import.meta.env.VITE_API_URL || "https://self-development-tracker.onrender.com"
        }/api/auth/telegram/auth/`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(telegramUser),
          credentials: "include", // Важно для cookies
        }
      );

      if (response.ok) {
        const data = await response.json();
        
        // Сохраняем токены
        if (data.tokens) {
          localStorage.setItem("accessToken", data.tokens.access);
          localStorage.setItem("refreshToken", data.tokens.refresh);
        }
        
        // Обновляем контекст аутентификации
        if (data.user) {
          // Здесь нужно обновить контекст аутентификации
          // В реальном приложении это должно быть сделано через вызов метода контекста
          console.log("User authenticated:", data.user);
        }
        
        navigate("/dashboard");
      } else {
        const errorText = await response.text();
        console.error("Auth error:", errorText);
        
        let errorData;
        try {
          errorData = JSON.parse(errorText);
        } catch {
          errorData = { error: "Неизвестная ошибка сервера" };
        }
        
        setError(errorData.error || "Ошибка входа через Telegram");
      }
    } catch (error) {
      console.error("Telegram auth error:", error);
      setError("Сетевая ошибка при входе через Telegram");
    } finally {
      setLoading(false);
    }
  };

  // Проверяем, находится ли пользователь в Telegram Web App
  const isTelegramWebApp = !!(window as any).Telegram?.WebApp;

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8">
        <div>
          <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900">
            Вход в аккаунт
          </h2>
          {isTelegramWebApp && (
            <p className="mt-2 text-center text-sm text-gray-600">
              Вы используете Telegram Web App
            </p>
          )}
        </div>

        {/* 👇 Telegram Login Widget */}
        <TelegramLoginWidget
          botName="self_development_tracker_bot"
          onAuth={handleTelegramAuth}
          buttonSize="large"
          lang="ru"
        />

        {!isTelegramWebApp && (
          <>
            <div className="relative mt-6">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-gray-300" />
              </div>
              <div className="relative flex justify-center text-sm">
                <span className="px-2 bg-gray-50 text-gray-500">Или</span>
              </div>
            </div>

            {/* 👇 обычный логин */}
            <form className="mt-8 space-y-6" onSubmit={handleSubmit}>
              {error && (
                <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded">
                  {error}
                </div>
              )}

              <div className="rounded-md shadow-sm -space-y-px">
                <div>
                  <input
                    type="email"
                    required
                    className="input-field rounded-t-md"
                    placeholder="Email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    disabled={loading}
                  />
                </div>
                <div>
                  <input
                    type="password"
                    required
                    className="input-field rounded-b-md"
                    placeholder="Пароль"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    disabled={loading}
                  />
                </div>
              </div>

              <div>
                <button type="submit" disabled={loading} className="btn-primary">
                  {loading ? "Вход..." : "Войти"}
                </button>
              </div>

              <div className="text-center">
                <Link to="/register" className="link-primary">
                  Нет аккаунта? Зарегистрироваться
                </Link>
              </div>
            </form>
          </>
        )}
      </div>
    </div>
  );
};

export default Login;