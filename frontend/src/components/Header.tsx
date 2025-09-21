// src/components/Header.tsx
import React from 'react';
import { Link } from 'react-router-dom';
import './Header.css';

const Header: React.FC = () => {
  const isAuthed = !!localStorage.getItem('accessToken');
  return (
    <header className="app-header">
      <div className="container" style={{display:'flex',alignItems:'center',justifyContent:'space-between'}}>
        <Link to="/" className="logo">Positive Theta</Link>
        <nav className="nav">
          <Link to="/blog">Блог</Link>
          {isAuthed ? (
            <>
              <Link to="/dashboard">Дэшборд</Link>
              <button className="btn ghost" onClick={() => { localStorage.removeItem('accessToken'); localStorage.removeItem('refreshToken'); window.location.href='/login'; }}>
                Выйти
              </button>
            </>
          ) : (
            <>
              <Link to="/login">Войти</Link>
              <Link to="/register">Регистрация</Link>
            </>
          )}
        </nav>
      </div>
    </header>
  );
}
export default Header;
