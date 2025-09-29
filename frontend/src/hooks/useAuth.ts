"use client";

import { useEffect, useState } from "react";

type User = {
  id: number;
  username: string;
  email: string;
};

export function useAuth() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadProfile() {
      try {
        const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/auth/profile/`, {
          credentials: "include",
        });
        if (res.ok) {
          const data = await res.json();
          setUser(data);
        } else {
          setUser(null);
        }
      } catch {
        setUser(null);
      } finally {
        setLoading(false);
      }
    }
    loadProfile();
  }, []);

  async function logout() {
    await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/auth/logout/`, {
      method: "POST",
      credentials: "include",
    });
    setUser(null);
  }

  return { user, loading, logout };
}
