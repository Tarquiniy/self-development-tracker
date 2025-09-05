import { useEffect, useState } from "react";

export default function Dashboard() {
  const [user, setUser] = useState<any>(null);

  useEffect(() => {
    const token = localStorage.getItem("access_token");
    if (!token) {
      window.location.href = "/";
    } else {
      // В реальном проекте — запросить данные профиля у Supabase
      setUser({ email: "demo@example.com" });
    }
  }, []);

  return (
    <div>
      <h1>Добро пожаловать в Dashboard!</h1>
      {user && <p>Вы вошли как {user.email}</p>}
    </div>
  );
}
