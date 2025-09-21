// frontend/src/App.tsx

import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import Header from './components/Header';
import BlogList from './components/BlogList';
// Заменяем старый BlogPost на BlogPostWithComments
import BlogPostWithComments from './components/BlogPostWithComments';
import Login from './components/auth/Login';
import Register from './components/auth/Register';
import Dashboard from './components/Dashboard';
import BlogPostPage from 'components/BlogPostPage';

const isAuthed = () => !!localStorage.getItem('accessToken');

const PrivateRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  return isAuthed() ? <>{children}</> : <Navigate to="/login" replace />;
};

const App: React.FC = () => {
  return (
    <div className="app">
      <Header />
      <main>
        <Routes>
          <Route path="/" element={<Navigate to="/blog" replace />} />
          <Route path="/blog" element={<BlogList />} />
          {/* Маршрут к посту по slug, теперь с комментариями и лайками */}
          <Route path="/blog/:slug" element={<BlogPostWithComments slug={/** получим slug из URL */ ''} />} />
          <Route path="/blog/:slug" element={<BlogPostPage />} />
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route
            path="/dashboard"
            element={
              <PrivateRoute>
                <Dashboard />
              </PrivateRoute>
            }
          />
          <Route path="*" element={<Navigate to="/blog" replace />} />
        </Routes>
      </main>
    </div>
  );
};

export default App;
