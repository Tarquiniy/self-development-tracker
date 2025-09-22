import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import Header from './components/Header';
import BlogList from './components/BlogList';
import BlogPostWithComments from './components/BlogPost';
import Login from './components/auth/Login';
import Register from './components/auth/Register';
import Dashboard from './components/Dashboard';

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
          {/* slug теперь автоматически берётся из URL в BlogPostWithComments */}
          <Route path="/blog/:slug" element={<BlogPostWithComments />} />
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
