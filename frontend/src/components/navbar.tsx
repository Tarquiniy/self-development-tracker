// frontend/src/components/navbar.tsx
"use client";

import React, { JSX, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";

/**
 * Navbar с динамической темой и твёрдым непрозрачным фоном.
 */

export default function Navbar(): JSX.Element {
  const [open, setOpen] = useState(false);
  const [user, setUser] = useState<any | null>(null);
  const [theme, setTheme] = useState<"light" | "dark">("light");
  const menuRef = useRef<HTMLDivElement | null>(null);
  const headerRef = useRef<HTMLElement | null>(null);
  const rafRef = useRef<number | null>(null);
  const router = useRouter();

  const LUMINANCE_THRESHOLD = 0.6;

  useEffect(() => {
    let mounted = true;

    (async () => {
      try {
        const { data } = await supabase.auth.getUser();
        if (!mounted) return;
        setUser(data?.user ?? null);
      } catch (e) {}
    })();

    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!mounted) return;
      setUser(session?.user ?? null);
    });

    function parseRgbString(s: string | null) {
      if (!s) return null;
      s = s.trim();
      const rgbMatch = s.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*([0-9.]+))?\)/i);
      if (rgbMatch) {
        return {
          r: Number(rgbMatch[1]),
          g: Number(rgbMatch[2]),
          b: Number(rgbMatch[3]),
          a: rgbMatch[4] !== undefined ? Number(rgbMatch[4]) : 1,
        };
      }
      const hexMatch = s.match(/^#([0-9a-f]{3}|[0-9a-f]{6})$/i);
      if (hexMatch) {
        let hex = hexMatch[1];
        if (hex.length === 3) hex = hex.split("").map((c) => c + c).join("");
        const int = parseInt(hex, 16);
        return {
          r: (int >> 16) & 255,
          g: (int >> 8) & 255,
          b: int & 255,
          a: 1,
        };
      }
      return null;
    }

    function getEffectiveBackgroundColor(el: Element | null) {
      let cur: Element | null = el;
      const doc = document;
      while (cur && cur !== doc.documentElement) {
        try {
          const style = getComputedStyle(cur);
          const bg = style.backgroundColor || style.background || null;
          const parsed = parseRgbString(bg);
          if (parsed && parsed.a > 0) return parsed;
        } catch (e) {}
        cur = cur.parentElement;
      }
      try {
        const bodyStyle = getComputedStyle(document.body);
        const parsedBody = parseRgbString(bodyStyle.backgroundColor || bodyStyle.background || null);
        if (parsedBody) return parsedBody;
      } catch (e) {}
      return { r: 255, g: 255, b: 255, a: 1 };
    }

    function luminanceFromRgb({ r, g, b }: { r: number; g: number; b: number }) {
      const srgb = [r, g, b].map((v) => v / 255).map((c) => (c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4)));
      return 0.2126 * srgb[0] + 0.7152 * srgb[1] + 0.0722 * srgb[2];
    }

    function sampleUnderHeaderAndSetTheme() {
      const headerEl = headerRef.current;
      const headerHeight = headerEl ? headerEl.getBoundingClientRect().height : 64;
      const y = Math.min(headerHeight + 8, window.innerHeight - 4);
      const xs = [window.innerWidth * 0.1, window.innerWidth * 0.5, window.innerWidth * 0.9];
      const lumVals: number[] = [];

      for (const x of xs) {
        const el = document.elementFromPoint(Math.round(x), Math.round(y)) as Element | null;
        const bg = getEffectiveBackgroundColor(el);
        if (bg) {
          const lum = luminanceFromRgb(bg);
          lumVals.push(lum);
        }
      }

      if (lumVals.length === 0) {
        setTheme("light");
        return;
      }
      const avg = lumVals.reduce((a, b) => a + b, 0) / lumVals.length;
      const chosen = avg > LUMINANCE_THRESHOLD ? "dark" : "light";
      setTheme(chosen);
    }

    function scheduleSample() {
      if (rafRef.current) return;
      rafRef.current = requestAnimationFrame(() => {
        rafRef.current = null;
        sampleUnderHeaderAndSetTheme();
      });
    }

    scheduleSample();
    window.addEventListener("scroll", scheduleSample, { passive: true });
    window.addEventListener("resize", scheduleSample);

    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    function onDocClick(e: MouseEvent) {
      if (!menuRef.current) return;
      const target = e.target as Node;
      if (open && !menuRef.current.contains(target)) setOpen(false);
    }

    document.addEventListener("keydown", onKey);
    document.addEventListener("click", onDocClick);

    return () => {
      mounted = false;
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("click", onDocClick);
      window.removeEventListener("scroll", scheduleSample);
      window.removeEventListener("resize", scheduleSample);
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      try {
        listener?.subscription?.unsubscribe?.();
      } catch (e) {}
    };
  }, [open]);

  useEffect(() => {
    // debug: покажет в консоли какую тему выбрал компонент
    // убери в production если нужно
    console.log("Navbar theme:", theme);
  }, [theme]);

  const handleSignOut = async () => {
    try {
      await supabase.auth.signOut();
    } catch (e: any) {
      // Supabase иногда возвращает 403 при logout если сессии нет.
      console.warn('signOut warning:', e?.message ?? e);
    } finally {
      try { localStorage.removeItem("sb_access_token"); } catch {}
      setUser(null);
      router.push("/");
    }
  };

  const isLight = theme === "light";

  return (
    <>
      <header ref={headerRef} className={`pt-header ${isLight ? "theme-light" : "theme-dark"}`} role="banner">
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
            <Link href="/search" prefetch={false} className="searchBtn" aria-label="Search">
              <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden>
                <circle cx="11" cy="11" r="6" fill="none" stroke="currentColor" strokeWidth="2" />
                <path d="M21 21l-4.35-4.35" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
              </svg>
            </Link>

            <nav className="desktopNav" aria-hidden={false}>
              <Link href="/" className="navItem">Главная</Link>
              <Link href="/blog" className="navItem">Блог</Link>

              {user ? (
                <>
                  <Link href="/profile" className="navItem profileBtn">Профиль</Link>
                  <button onClick={handleSignOut} className="navItem signoutBtn">Выйти</button>
                </>
              ) : (
                <>
                  <Link href="/login" className="navItem loginBtn">Войти</Link>
                  <Link href="/register" className="navItem registerBtn">Регистрация</Link>
                </>
              )}
            </nav>
          </div>
        </div>

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
              {user ? (
                <>
                  <a href="/profile" className="actionBtn" onClick={() => setOpen(false)}>Профиль</a>
                  <button className="actionBtn" onClick={() => { setOpen(false); handleSignOut(); }}>Выйти</button>
                </>
              ) : (
                <>
                  <a href="/login" className="actionBtn" onClick={() => setOpen(false)}>Войти</a>
                  <a href="/register" className="actionPrimary" onClick={() => setOpen(false)}>Регистрация</a>
                </>
              )}
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

        .pt-header {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          z-index: 9999; /* поднял выше всего */
          height: var(--header-height);
          pointer-events: auto;
          transition: background 260ms ease, color 160ms ease, box-shadow 260ms ease;
        }

        /* LIGHT THEME: solid white background, opaque */
        .pt-header.theme-light .bar {
          background: #ffffff !important;
          color: #0f1724 !important;
          border-bottom: 1px solid rgba(15,23,36,0.06) !important;
          box-shadow: 0 6px 20px rgba(12,20,30,0.08) !important;
        }
        .pt-header.theme-light .logoChar,
        .pt-header.theme-light .brand,
        .pt-header.theme-light .navItem,
        .pt-header.theme-light .burger {
          color: #0f1724 !important;
        }
        .pt-header.theme-light .searchBtn {
          color: #0f1724 !important;
          background: rgba(15,23,36,0.04) !important;
          border:1px solid rgba(15,23,36,0.06) !important;
        }
        .pt-header.theme-light .logoCircle {
          background: #f7f8fa !important;
          border: 1px solid rgba(15,23,36,0.06) !important;
        }

        /* DARK THEME: solid colored gradient, opaque */
        .pt-header.theme-dark .bar {
          background: linear-gradient(90deg, var(--blue-1) 0%, var(--blue-2) 50%, var(--blue-3) 100%) !important;
          color: #ffffff !important;
          border-bottom: 1px solid rgba(0,0,0,0.06) !important;
          box-shadow: 0 6px 20px rgba(2,6,23,0.18) !important;
        }
        .pt-header.theme-dark .logoChar,
        .pt-header.theme-dark .brand,
        .pt-header.theme-dark .navItem,
        .pt-header.theme-dark .burger {
          color: #fff !important;
        }
        .pt-header.theme-dark .searchBtn {
          color: #fff !important;
          background: rgba(255,255,255,0.03) !important;
          border:1px solid rgba(255,255,255,0.12) !important;
        }
        .pt-header.theme-dark .logoCircle {
          background: rgba(255,255,255,0.06) !important;
          border: 1px solid rgba(255,255,255,0.12) !important;
        }

        .bar {
          height: 100%;
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 0 16px;
          box-sizing: border-box;
        }

        .left, .center, .right { display:flex; align-items:center; }

        .logoLink { display:flex; gap:10px; align-items:center; text-decoration:none; }
        .logoChar { color:inherit; font-weight:700; font-size:18px; }
        .brand { color:inherit; font-weight:700; font-size:14px; display:none; }
        @media (min-width:600px) { .brand { display:inline-block; } }

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
          color: inherit;
          cursor: pointer;
          transition: all 160ms ease;
          box-shadow: none;
        }
        .burger.open {
          border-color: rgba(0,0,0,0.12);
        }
        .burger.closed:hover {
          transform: translateY(-1px);
          box-shadow: 0 4px 12px rgba(0,0,0,0.08);
        }

        .right { gap: 12px; }

        .searchBtn {
          width:36px;
          height:36px;
          display:flex;
          align-items:center;
          justify-content:center;
          border-radius:999px;
          color:inherit !important;
          text-decoration:none;
          border:1px solid rgba(255,255,255,0.12);
          background: transparent;
        }
        .searchBtn svg { display:block; color: inherit; stroke: currentColor; }
        .searchBtn:hover { opacity: 0.94; }

        .desktopNav {
          display: none;
          gap: 18px;
          margin-left: 6px;
          align-items:center;
        }
        .desktopNav .navItem {
          color: inherit !important;
          text-decoration: none;
          font-weight: 600;
          padding: 4px 6px;
        }
        .desktopNav .navItem:hover { opacity: 0.92; }

        @media (min-width: 960px) {
          .desktopNav { display:flex; }
          .center { display: none; }
        }

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
          box-shadow: 0 6px 18px rgba(20,40,60,0.08);
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
