// frontend/src/App.tsx
import React from 'react';
import { Routes, Route, Navigate, Link } from 'react-router-dom';
import Login from './components/auth/Login';
import Register from './components/auth/Register';
import Dashboard from './components/Dashboard';
import Home from './components/Home';

const isAuthed = () => !!localStorage.getItem('accessToken');

const PrivateRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  return isAuthed() ? <>{children}</> : <Navigate to="/login" replace />;
};

// Временная заглушка для блога
const Blog: React.FC = () => (
  <div className="p-8 max-w-3xl mx-auto">
    <h1 className="text-3xl font-bold mb-4">Блог</h1>
    <p className="text-gray-700">
      Здесь будет блог о саморазвитии, привычках и прогрессе 🚀
    </p>
  </div>
);

const App: React.FC = () => {
  return (
    <div className="app">
      <header className="container header flex justify-between items-center py-4">
        <Link to="/" className="logo text-2xl font-bold text-indigo-600">
          SDT
        </Link>
        <nav className="nav flex gap-4">
          {isAuthed() ? (
            <>
              <Link to="/dashboard">Дэшборд</Link>
              <button
                className="linklike text-red-600"
                onClick={() => {
                  localStorage.removeItem('accessToken');
                  localStorage.removeItem('refreshToken');
                  window.location.href = '/login';
                }}
              >
                Выйти
              </button>
            </>
          ) : (
            <>
              <Link to="/login">Войти</Link>
              <Link to="/register">Регистрация</Link>
              <Link to="/blog">Блог</Link>
            </>
          )}
        </nav>
      </header>

      <main className="container py-6">
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route path="/blog" element={<Blog />} />
          <Route
            path="/dashboard"
            element={
              <PrivateRoute>
                <Dashboard />
              </PrivateRoute>
            }
          />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>
    </div>
  );
};

export default App;
