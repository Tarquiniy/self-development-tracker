"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { LoginModal } from "./LoginModal";
import { RegisterModal } from "./RegisterModal";

export function AuthButtons() {
  const [showLogin, setShowLogin] = useState(false);
  const [showRegister, setShowRegister] = useState(false);

  return (
    <div className="flex gap-3">
      <Button
        variant="secondary"
        onClick={() => setShowLogin(true)}
        className="px-6"
      >
        Войти
      </Button>
      <Button
        variant="primary"
        onClick={() => setShowRegister(true)}
        className="px-6"
      >
        Регистрация
      </Button>

      {showLogin && <LoginModal onClose={() => setShowLogin(false)} />}
      {showRegister && <RegisterModal onClose={() => setShowRegister(false)} />}
    </div>
  );
}
