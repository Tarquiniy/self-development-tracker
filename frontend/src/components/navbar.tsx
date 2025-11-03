// frontend/src/components/navbar.tsx
"use client";

import React, { JSX, useEffect, useRef, useState } from "react";
import Link from "next/link";

/**
 * Navbar — самодостаточный, без Tailwind.
 * - Фиксированная высота хедера
 * - Центрированный гамбургер
 * - Мобильное меню выпадает под шапкой (не ломает высоту)
 * - Поиск, "Главная", "Блог" — явно белые
 */

export default function Navbar(): JSX.Element {
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    function onDocClick(e: MouseEvent) {
      if (!menuRef.current) return;
      const target = e.target as Node;
      if (open && !menuRef.current.contains(target)) setOpen(false);
    }
    function onResize() {
      if (window.innerWidth >= 960) setOpen(false);
    }

    document.addEventListener("keydown", onKey);
    document.addEventListener("click", onDocClick);
    window.addEventListener("resize", onResize);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("click", onDocClick);
      window.removeEventListener("resize", onResize);
    };
  }, [open]);

  return (
    <>
      <header className="pt-header" role="banner">
        <div className="bar">
          <div className="left">
            <Link href="/" className="logoLink" aria-label="Home">
              <div className="logoCircle" aria-hidden>
                <span className="logoChar">Θ</span>
              </div>
              <span className="brand">Positive Theta</span>
            </Link>
          </div>

          <div className="center">
            <button
              className={`burger ${open ? "open" : "closed"}`}
              aria-expanded={open}
              aria-label={open ? "Закрыть меню" : "Открыть меню"}
              onClick={(e) => {
                e.stopPropagation();
                setOpen((s) => !s);
              }}
            >
              <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden>
                {open ? (
                  <>
                    <path d="M6 6L18 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                    <path d="M6 18L18 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                  </>
                ) : (
                  <>
                    <path d="M4 7h16" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                    <path d="M4 12h16" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                    <path d="M4 17h16" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                  </>
                )}
              </svg>
            </button>
          </div>

          <div className="right">
            {/* search icon link: stroke uses currentColor so color applies */}
            <Link href="/search" prefetch={false} className="searchBtn" aria-label="Search">
              <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden>
                <circle cx="11" cy="11" r="6" fill="none" stroke="currentColor" strokeWidth="2" />
                <path d="M21 21l-4.35-4.35" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
              </svg>
            </Link>

            <nav className="desktopNav" aria-hidden>
              <Link href="/" className="navItem">Главная</Link>
              <Link href="/blog" className="navItem">Блог</Link>
            </nav>
          </div>
        </div>

        {/* Mobile menu — absolutely positioned below header */}
        <div
          ref={menuRef}
          className={`mobileMenu ${open ? "show" : ""}`}
          role="menu"
          aria-hidden={!open}
        >
          <div className="mobileInner">
            <a href="/" onClick={() => setOpen(false)} role="menuitem">Главная</a>
            <a href="/blog" onClick={() => setOpen(false)} role="menuitem">Блог</a>
            <a href="/about" onClick={() => setOpen(false)} role="menuitem">О проекте</a>

            <div className="mobileActions">
              <a href="/login" className="actionBtn" onClick={() => setOpen(false)}>Войти</a>
              <a href="/register" className="actionPrimary" onClick={() => setOpen(false)}>Регистрация</a>
            </div>
          </div>
        </div>
      </header>

      <style jsx>{`
        :root {
          --blue-1: #26a6ff;
          --blue-2: #1fa6ff;
          --blue-3: #16a5ff;
          --header-height: 64px;
          --max-mobile-menu-height: 420px;
          --shadow: 0 6px 18px rgba(20, 40, 60, 0.12);
        }

        /* Fixed header */
        .pt-header {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          z-index: 60;
          height: var(--header-height);
          pointer-events: auto;
        }

        .bar {
          height: 100%;
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 0 16px;
          box-sizing: border-box;
          background: linear-gradient(90deg, var(--blue-1) 0%, var(--blue-2) 50%, var(--blue-3) 100%);
          border-bottom: 1px solid rgba(0,0,0,0.06);
          backdrop-filter: saturate(120%) blur(6px);
        }

        .left, .center, .right { display:flex; align-items:center; }

        /* Logo */
        .logoLink { display:flex; gap:10px; align-items:center; color:#ffffff; text-decoration:none; }
        .logoCircle { width:40px; height:40px; border-radius:999px; border:1px solid rgba(255,255,255,0.25); display:flex; align-items:center; justify-content:center; background: rgba(255,255,255,0.06); }
        .logoChar { color:#fff; font-weight:700; font-size:18px; }
        .brand { color:#fff; font-weight:700; font-size:14px; display:none; }
        @media (min-width:600px) { .brand { display:inline-block; } }

        /* Centered burger */
        .center {
          position: absolute;
          left: 50%;
          top: 50%;
          transform: translate(-50%,-50%);
          pointer-events: none;
        }
        .burger {
          pointer-events: auto;
          width: 44px;
          height: 44px;
          border-radius: 8px;
          display:flex;
          align-items:center;
          justify-content:center;
          border: 1px solid rgba(255,255,255,0.18);
          background: transparent;
          color: white; /* default icon color */
          cursor: pointer;
          transition: all 160ms ease;
          box-shadow: none;
        }
        .burger.open {
          background: #ffffff;
          color: #0f1724;
          border-color: rgba(0,0,0,0.12);
          box-shadow: var(--shadow);
        }
        .burger.closed:hover {
          transform: translateY(-1px);
          box-shadow: 0 4px 12px rgba(0,0,0,0.08);
        }

        /* Right side: search + desktop nav */
        .right { gap: 12px; }

        /* Search button: force white */
        .searchBtn {
          width:36px;
          height:36px;
          display:flex;
          align-items:center;
          justify-content:center;
          border-radius:999px;
          color:#fff !important; /* ensure white */
          text-decoration:none;
          border:1px solid rgba(255,255,255,0.12);
          background: rgba(255,255,255,0.03);
        }
        .searchBtn svg { display:block; color: inherit; stroke: currentColor; }
        .searchBtn:hover { background: rgba(255,255,255,0.06); }

        /* Desktop nav: explicitly white */
        .desktopNav {
          display: none;
          gap: 18px;
          margin-left: 6px;
        }
        .desktopNav .navItem {
          color: #ffffff !important; /* force white */
          text-decoration: none;
          font-weight: 600;
          padding: 4px 6px;
        }
        .desktopNav .navItem:hover { opacity: 0.92; }

        @media (min-width: 960px) {
          .desktopNav { display:flex; }
          .center { display: none; } /* hide centered burger on desktop */
        }

        /* Mobile menu: absolute below header so it doesn't increase header height */
        .mobileMenu {
          position: absolute;
          left: 0;
          right: 0;
          top: calc(var(--header-height));
          display: block;
          overflow: hidden;
          max-height: 0;
          transition: max-height 320ms ease, opacity 220ms ease, transform 240ms ease;
          opacity: 0;
          transform: translateY(-6px);
          pointer-events: none;
          z-index: 50;
        }
        .mobileMenu.show {
          max-height: var(--max-mobile-menu-height);
          opacity: 1;
          transform: translateY(0);
          pointer-events: auto;
        }

        .mobileInner {
          background: #fff;
          border-bottom-left-radius: 12px;
          border-bottom-right-radius: 12px;
          box-shadow: var(--shadow);
          padding: 14px 16px;
          display:flex;
          flex-direction: column;
          gap: 8px;
        }
        .mobileInner a {
          color: #0f1724;
          text-decoration: none;
          padding: 10px 6px;
          border-radius: 8px;
          font-weight: 600;
        }
        .mobileInner a:hover { background: #f7fafc; }

        .mobileActions {
          margin-top: 8px;
          display:flex;
          gap: 8px;
          flex-direction: column;
        }
        .actionBtn {
          text-align:center;
          padding: 10px;
          border-radius: 8px;
          border: 1px solid rgba(15,23,36,0.06);
          color: #0f1724;
          text-decoration:none;
          font-weight:700;
          background: #ffffff;
        }
        .actionPrimary {
          text-align:center;
          padding: 10px;
          border-radius: 8px;
          color: #ffffff;
          text-decoration:none;
          font-weight:700;
          background: linear-gradient(90deg,#0073e6,#1fa6ff);
          border: none;
        }

        /* Ensure page content is pushed down so header doesn't overlap it */
        :global(body) {
          padding-top: var(--header-height) !important;
        }

        @media (min-width: 960px) {
          .mobileMenu { display: none !important; }
        }
      `}</style>
    </>
  );
}
