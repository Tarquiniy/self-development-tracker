import React, { createContext, useContext, useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import type { User, UserProfile, AuthContextType } from '../types';
import { apiService } from '../services/api';

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
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const initAuth = async () => {
      const token = localStorage.getItem('accessToken');
      if (token) {
        try {
          const profileData = await apiService.getProfile();
          setUser(profileData.user);
          setProfile(profileData);
        } catch (error) {
          console.error('Failed to fetch user profile:', error);
          localStorage.removeItem('accessToken');
          localStorage.removeItem('refreshToken');
          setUser(null);
          setProfile(null);
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

    const profileData = await apiService.getProfile();
    setProfile(profileData);
  };

  const register = async (userData: {
    email: string;
    username: string;
    password: string;
    first_name?: string;
    last_name?: string;
    phone?: string;
  }) => {
    const data = await apiService.register(userData);
    setUser(data.user);

    if (data.access) {
      localStorage.setItem('accessToken', data.access);
      localStorage.setItem('refreshToken', data.refresh);
    }

    const profileData = await apiService.getProfile();
    setProfile(profileData);
  };

  const logout = () => {
    localStorage.removeItem('accessToken');
    localStorage.removeItem('refreshToken');
    setUser(null);
    setProfile(null);
  };

  // Функция для установки пользователя (для Telegram авторизации)
  const setUserData = (userData: User) => {
    setUser(userData);
  };

  // Функция для установки профиля
  const setProfileData = (profileData: UserProfile) => {
    setProfile(profileData);
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
    setProfile: setProfileData,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};