"use client";

import React, { JSX, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { supabaseBrowser } from "@/lib/supabaseBrowser";

/**
 * Navbar with dynamic contrast:
 * - Samples DOM just under the header to compute the effective background luminance.
 * - Switches the navbar between "light" (light background / dark text)
 *   and "dark" (dark background / light text) variants so the navbar always
 *   contrasts with the content beneath.
 *
 * Notes:
 * - Sampling uses document.elementFromPoint and climbs parents to find a non-transparent
 *   background. If background is semi-transparent it is alpha-composited over white.
 * - Sampling is throttled with rAF for scroll/resize events.
 * - Reactivity triggered on mount, scroll, resize and when mobile menu toggles.
 */

export default function Navbar(): JSX.Element {
  const [open, setOpen] = useState(false);
  const [user, setUser] = useState<any | null>(null);
  const [preferDarkNav, setPreferDarkNav] = useState<boolean | null>(null); // null = not yet measured
  const menuRef = useRef<HTMLDivElement | null>(null);
  const headerRef = useRef<HTMLElement | null>(null);
  const ticking = useRef(false);

  useEffect(() => {
    // initial session fetch
    let mounted = true;
    (async () => {
      try {
        const { data } = await supabaseBrowser.auth.getSession();
        if (!mounted) return;
        setUser(data?.session?.user ?? null);
      } catch (e) {
        // ignore
      }
    })();

    // listen to auth changes
    const { data: sub } = supabaseBrowser.auth.onAuthStateChange((event, session) => {
      setUser(session?.user ?? null);
    });

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
      requestMeasure();
    }

    document.addEventListener("keydown", onKey);
    document.addEventListener("click", onDocClick);
    window.addEventListener("resize", onResize);
    window.addEventListener("scroll", requestMeasure, { passive: true });

    // Mutation observer to catch DOM changes that may change background under header
    const mo = new MutationObserver(() => requestMeasure());
    mo.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ["style", "class"] });

    // initial measure after mount
    requestMeasure();

    return () => {
      mounted = false;
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("click", onDocClick);
      window.removeEventListener("resize", onResize);
      window.removeEventListener("scroll", requestMeasure as any);
      mo.disconnect();
      sub?.subscription?.unsubscribe?.();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  // requestMeasure throttled by rAF
  function requestMeasure() {
    if (ticking.current) return;
    ticking.current = true;
    window.requestAnimationFrame(() => {
      try {
        measureAndSet();
      } finally {
        ticking.current = false;
      }
    });
  }

  function measureAndSet() {
    const headerEl = headerRef.current ?? document.querySelector("header.pt-header");
    if (!headerEl) return;

    const rect = headerEl.getBoundingClientRect();
    // sample just below header to capture content background (y = header bottom + 4px)
    const sampleY = Math.min(window.innerHeight - 1, Math.max(1, Math.round(rect.bottom + 4)));
    const sampleXs = [window.innerWidth * 0.25, window.innerWidth * 0.5, window.innerWidth * 0.75];

    const luminances = sampleXs.map((x) => {
      const col = getEffectiveBackgroundColorAtPoint(Math.round(x), Math.round(sampleY));
      return colorToLuminance(col);
    }).filter((v) => typeof v === "number") as number[];

    if (!luminances.length) return;

    const avg = luminances.reduce((a, b) => a + b, 0) / luminances.length;
    // avg in 0..1. Heuristic:
    // if average luminance is high (light content) => use dark navbar (text dark? actually dark navbar = dark bg with light text)
    // we want dark navbar if background is light to contrast (so preferDarkNav = true when avg > threshold)
    const threshold = 0.6;
    const wantDarkNav = avg > threshold;
    setPreferDarkNav(wantDarkNav);
  }

  // returns CSS rgb(a) string or null
  function getEffectiveBackgroundColorAtPoint(x: number, y: number): string | null {
    // clamp points inside viewport
    if (x < 0 || y < 0 || x >= window.innerWidth || y >= window.innerHeight) return null;
    let el: Element | null = document.elementFromPoint(x, y);
    // If the point is inside the navbar itself, move slightly further down
    const headerEl = headerRef.current ?? document.querySelector("header.pt-header");
    if (el && headerEl && headerEl.contains(el)) {
      el = document.elementFromPoint(x, Math.min(window.innerHeight - 1, y + headerEl.getBoundingClientRect().height + 6));
    }
    while (el && el !== document.documentElement) {
      const style = window.getComputedStyle(el as Element);
      const bg = style.backgroundColor;
      if (bg && bg !== "transparent" && bg !== "rgba(0, 0, 0, 0)" && bg !== "initial") {
        // return the first non-transparent background
        return bg;
      }
      el = el.parentElement;
    }
    // fallback to body background
    const bodyBg = window.getComputedStyle(document.body).backgroundColor;
    return bodyBg && bodyBg !== "transparent" ? bodyBg : null;
  }

  // parse color like "rgb(r,g,b)" or "rgba(r,g,b,a)" or hex #rrggbb
  function parseColor(str: string | null): { r: number; g: number; b: number; a: number } | null {
    if (!str) return null;
    str = str.trim();
    // rgb/rgba
    const rgbMatch = str.match(/rgba?\(([^)]+)\)/i);
    if (rgbMatch) {
      const parts = rgbMatch[1].split(",").map((s) => s.trim());
      const r = Number(parts[0]) || 0;
      const g = Number(parts[1]) || 0;
      const b = Number(parts[2]) || 0;
      const a = parts[3] !== undefined ? Number(parts[3]) : 1;
      return { r, g, b, a };
    }
    // hex #rrggbb or #rgb
    const hexMatch = str.match(/^#([0-9a-f]{3}|[0-9a-f]{6})$/i);
    if (hexMatch) {
      const hex = hexMatch[1];
      if (hex.length === 3) {
        const r = parseInt(hex[0] + hex[0], 16);
        const g = parseInt(hex[1] + hex[1], 16);
        const b = parseInt(hex[2] + hex[2], 16);
        return { r, g, b, a: 1 };
      } else {
        const r = parseInt(hex.slice(0, 2), 16);
        const g = parseInt(hex.slice(2, 4), 16);
        const b = parseInt(hex.slice(4, 6), 16);
        return { r, g, b, a: 1 };
      }
    }
    return null;
  }

  // composite semi-transparent color over white (simple) and compute relative luminance
  function colorToLuminance(cssColor: string | null): number {
    const parsed = parseColor(cssColor);
    if (!parsed) return 1; // default to light if unknown
    // composite over white if alpha < 1
    const a = typeof parsed.a === "number" ? parsed.a : 1;
    const r = Math.round(parsed.r * a + 255 * (1 - a));
    const g = Math.round(parsed.g * a + 255 * (1 - a));
    const b = Math.round(parsed.b * a + 255 * (1 - a));

    // convert sRGB to linear
    const srgb = [r, g, b].map((v) => {
      const s = v / 255;
      return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
    });
    // relative luminance
    const L = 0.2126 * srgb[0] + 0.7152 * srgb[1] + 0.0722 * srgb[2];
    return L; // 0..1
  }

  // compute class name for header: preferDarkNav === true -> dark bg (dark overlay) else light bg
  const contrastClass = preferDarkNav === null ? "nav-contrast-auto" : preferDarkNav ? "nav-contrast-dark" : "nav-contrast-light";

  return (
    <>
      <header ref={headerRef} className={`pt-header ${contrastClass}`} role="banner" aria-hidden={false}>
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
                // re-measure after opening mobile menu (since it changes layout)
                setTimeout(() => requestMeasure(), 120);
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

            <nav className="desktopNav" aria-hidden>
              <Link href="/" className="navItem">Главная</Link>
              <Link href="/blog" className="navItem">Блог</Link>

              {user ? (
                <>
                  <Link href="/tables" className="navItem">Dashboard</Link>
                  <Link href="/profile" className="navItem">Профиль</Link>
                </>
              ) : (
                <>
                  <Link href="/login" className="navItem">Войти</Link>
                  <Link href="/register" className="navItem">Регистрация</Link>
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
                  <a href="/dashboard" className="actionBtn" onClick={() => setOpen(false)}>Dashboard</a>
                  <a href="/profile" className="actionPrimary" onClick={() => setOpen(false)}>Профиль</a>
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

        /* base header layout (keeps height and positioning) */
        .pt-header {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          z-index: 60;
          height: var(--header-height);
          pointer-events: auto;
          transition: background-color 220ms ease, color 220ms ease, box-shadow 220ms ease;
        }

        /* default bar uses CSS variables for bg/text so variants can override them */
        .bar {
          height: 100%;
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 0 16px;
          box-sizing: border-box;
          background: var(--nav-bg, linear-gradient(90deg, var(--blue-1) 0%, var(--blue-2) 50%, var(--blue-3) 100%));
          color: var(--nav-foreground, white);
          border-bottom: 1px solid rgba(0,0,0,0.06);
          backdrop-filter: saturate(120%) blur(6px);
        }

        /* NAVBAR VARIANTS:
           - .nav-contrast-dark  -> darker overlay (for light content beneath) with light text
           - .nav-contrast-light -> light overlay (for dark content beneath) with dark text
           - .nav-contrast-auto  -> initial state: semi-transparent neutral
        */
        .nav-contrast-auto .bar {
          --nav-bg: linear-gradient(90deg, var(--blue-1) 0%, var(--blue-2) 50%, var(--blue-3) 100%);
          --nav-foreground: white;
        }
        .nav-contrast-dark .bar {
          --nav-bg: rgba(6, 12, 20, 0.86); /* dark translucent background */
          --nav-foreground: #fff;
          box-shadow: 0 6px 18px rgba(2,6,23,0.28);
        }
        .nav-contrast-light .bar {
          --nav-bg: rgba(255,255,255,0.92); /* light translucent background */
          --nav-foreground: #0f1724;
          box-shadow: 0 6px 18px rgba(2,6,23,0.06);
          border-bottom: 1px solid rgba(15,23,36,0.06);
        }

        .left, .center, .right { display:flex; align-items:center; }

        .logoLink { display:flex; gap:10px; align-items:center; color:inherit; text-decoration:none; }
        .logoCircle { width:40px; height:40px; border-radius:999px; border:1px solid rgba(255,255,255,0.12); display:flex; align-items:center; justify-content:center; background: rgba(255,255,255,0.06); }
        /* ensure logo colors adapt to nav foreground */
        .nav-contrast-light .logoCircle { background: rgba(15,23,36,0.04); border-color: rgba(15,23,36,0.06); }
        .logoChar { color: var(--nav-foreground); font-weight:700; font-size:18px; }
        .brand { color: var(--nav-foreground); font-weight:700; font-size:14px; display:none; }
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
          background: rgba(0,0,0,0.08);
          color: inherit;
          border-color: rgba(0,0,0,0.08);
          box-shadow: var(--shadow);
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
          color: inherit !important;
          text-decoration:none;
          border:1px solid rgba(255,255,255,0.08);
          background: transparent;
        }
        .searchBtn svg { display:block; color: inherit; stroke: currentColor; }
        .searchBtn:hover { background: rgba(255,255,255,0.04); }

        .desktopNav {
          display: none;
          gap: 18px;
          margin-left: 6px;
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
          background: var(--mobile-bg, #fff);
          border-bottom-left-radius: 12px;
          border-bottom-right-radius: 12px;
          box-shadow: var(--shadow);
          padding: 14px 16px;
          display:flex;
          flex-direction: column;
          gap: 8px;
        }
        /* ensure mobile menu colors follow variant */
        .nav-contrast-dark .mobileInner { --mobile-bg: rgba(15,20,25,0.98); color: #fff; }
        .nav-contrast-light .mobileInner { --mobile-bg: #fff; color: #0f1724; }

        .mobileInner a {
          color: inherit;
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
          color: inherit;
          text-decoration:none;
          font-weight:700;
          background: transparent;
        }
        .actionPrimary {
          text-align:center;
          padding: 10px;
          border-radius: 8px;
          color: var(--nav-foreground);
          text-decoration:none;
          font-weight:700;
          background: linear-gradient(90deg,#0073e6,#1fa6ff);
          border: none;
        }

        @media (min-width: 960px) {
          .mobileMenu { display: none !important; }
        }
      `}</style>
    </>
  );
}
