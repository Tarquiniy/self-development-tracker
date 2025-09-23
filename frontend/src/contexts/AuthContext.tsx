// frontend/src/contexts/AuthContext.tsx
import React, { createContext, useContext, useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import type { User, UserProfile, AuthContextType } from '../types';
import { apiService } from '../services/api';
import { supabase } from '../services/supabaseClient';

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

interface AuthProviderProps {
  children: ReactNode;
}

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfileState] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const initAuth = async () => {
      const token = localStorage.getItem('accessToken');
      if (token) {
        try {
          const profileData = await apiService.getProfile();
          setUser(profileData.user);
          setProfileState(profileData);
        } catch (error) {
          console.error('Failed to fetch user profile:', error);
          localStorage.removeItem('accessToken');
          localStorage.removeItem('refreshToken');
          setUser(null);
          setProfileState(null);
        }
      }
      setLoading(false);
    };

    initAuth();
  }, []);

  const login = async (email: string, password: string) => {
  const data = await apiService.login(email, password);
  setUser(data.user);

  if (data.access) {
    localStorage.setItem('accessToken', data.access);
    localStorage.setItem('refreshToken', data.refresh);
  }

  // грузим профиль из Supabase
  const { data: userFromSupabase } = await supabase
    .from('users')
    .select('*')
    .eq('email', email)
    .single();

  if (userFromSupabase) {
    setProfileState(userFromSupabase);
  }
};

  const register = async (userData: {
  email: string;
  username: string;
  password: string;
}) => {
  const data = await apiService.register(userData);
  setUser(data.user);

  if (data.access) {
    localStorage.setItem('accessToken', data.access);
    localStorage.setItem('refreshToken', data.refresh);
  }

  // сохраняем пользователя в Supabase
  await supabase.from('users').insert([
    {
      email: userData.email,
      username: userData.username,
    },
  ]);

  setProfileState({
    email: userData.email,
    username: userData.username,
  } as any);
};

  const logout = () => {
    localStorage.removeItem('accessToken');
    localStorage.removeItem('refreshToken');
    setUser(null);
    setProfileState(null);
  };

  const setUserData = (userData: User) => {
    setUser(userData);
  };

  const setProfile = (profileData: UserProfile) => {
    setProfileState(profileData);
    setUser(profileData.user);
  };

  const value: AuthContextType = {
    user,
    profile,
    login,
    register,
    logout,
    loading,
    setUser: setUserData,
    setProfile,
  };

  return (
    <AuthContext.Provider value={value}>
      {loading ? <div>Загрузка...</div> : children}
    </AuthContext.Provider>
  );
};
