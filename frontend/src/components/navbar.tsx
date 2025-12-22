// frontend/src/components/navbar.tsx
"use client";

import React, { JSX, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { supabaseBrowser } from "@/lib/supabaseBrowser";


export default function Navbar(): JSX.Element {
  const [open, setOpen] = useState(false);
  const [user, setUser] = useState<any | null>(null);
  const [preferDarkNav, setPreferDarkNav] = useState<boolean | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);
  const headerRef = useRef<HTMLElement | null>(null);

  const stableCount = useRef(0);
  const prevWantRef = useRef<boolean | null>(null);
  const ticking = useRef(false);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const { data } = await supabaseBrowser.auth.getSession();
        if (!mounted) return;
        setUser(data?.session?.user ?? null);
      } catch (e) {}
    })();

    const { data: sub } = supabaseBrowser.auth.onAuthStateChange((_event, session) => {
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

    const mo = new MutationObserver(() => requestMeasure());
    mo.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ["style", "class"] });

    requestMeasure();

    return () => {
      mounted = false;
      try { sub?.subscription?.unsubscribe && sub.subscription.unsubscribe(); } catch (e) {}
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("click", onDocClick);
      window.removeEventListener("resize", onResize);
      window.removeEventListener("scroll", requestMeasure);
      mo.disconnect();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  // color parsing & measurement utilities (same robust version)
  function parseColor(str: string | null) {
    if (!str) return null;
    str = str.trim();
    const rgbMatch = str.match(/rgba?\(([^)]+)\)/i);
    if (rgbMatch) {
      const parts = rgbMatch[1].split(",").map((s) => s.trim());
      const r = Number(parts[0]) || 0;
      const g = Number(parts[1]) || 0;
      const b = Number(parts[2]) || 0;
      const a = parts[3] !== undefined ? Number(parts[3]) : 1;
      return { r, g, b, a };
    }
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

  function compositeOverWhite(c: { r: number; g: number; b: number; a: number } | null) {
    if (!c) return null;
    const a = c.a ?? 1;
    const r = Math.round(255 + (c.r - 255) * a);
    const g = Math.round(255 + (c.g - 255) * a);
    const b = Math.round(255 + (c.b - 255) * a);
    return { r, g, b };
  }

  function colorToLuminance(colStr: string | null) {
    const parsed = parseColor(colStr);
    if (!parsed) return null;
    const comp = parsed.a !== undefined && parsed.a < 1 ? compositeOverWhite(parsed) : parsed;
    if (!comp) return null;
    const srgb = [comp.r, comp.g, comp.b].map((v) => {
      v = v / 255;
      return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
    });
    return 0.2126 * srgb[0] + 0.7152 * srgb[1] + 0.0722 * srgb[2];
  }

  function getEffectiveBackgroundColorAtPoint(x: number, y: number): string | null {
    if (x < 0 || y < 0 || x >= window.innerWidth || y >= window.innerHeight) return null;
    let el: Element | null = document.elementFromPoint(x, y);
    const headerEl = headerRef.current ?? document.querySelector("header.pt-header");
    if (el && headerEl && headerEl.contains(el)) {
      el = document.elementFromPoint(x, Math.min(window.innerHeight - 1, y + (headerEl.getBoundingClientRect().height || 0) + 6));
    }
    while (el && el !== document.documentElement) {
      const style = window.getComputedStyle(el as Element);
      const bg = style.backgroundColor;
      if (bg && bg !== "transparent" && bg !== "rgba(0, 0, 0, 0)" && bg !== "initial") {
        return bg;
      }
      el = el.parentElement;
    }
    const bodyBg = window.getComputedStyle(document.body).backgroundColor;
    return bodyBg && bodyBg !== "transparent" ? bodyBg : null;
  }

  function measureAndSet() {
    const headerEl = headerRef.current ?? document.querySelector("header.pt-header");
    if (!headerEl) return;

    const rect = headerEl.getBoundingClientRect();
    const sampleY = Math.min(window.innerHeight - 1, Math.max(1, Math.round(rect.bottom + 4)));
    const sampleXs = [window.innerWidth * 0.25, window.innerWidth * 0.5, window.innerWidth * 0.75];

    const luminances = sampleXs.map((x) => {
      const col = getEffectiveBackgroundColorAtPoint(Math.round(x), Math.round(sampleY));
      return colorToLuminance(col);
    }).filter((v) => typeof v === "number") as number[];

    if (!luminances.length) return;

    const avg = luminances.reduce((a, b) => a + b, 0) / luminances.length;
    const threshold = 0.6;
    const wantDarkNav = avg > threshold;

    if (prevWantRef.current === wantDarkNav) {
      stableCount.current = Math.min(10, stableCount.current + 1);
    } else {
      stableCount.current = 1;
    }
    prevWantRef.current = wantDarkNav;

    if (stableCount.current >= 2) {
      if (preferDarkNav === null) {
        setPreferDarkNav(wantDarkNav);
        try {
          const h = headerRef.current ?? document.querySelector("header.pt-header");
          if (h && !h.classList.contains("nav-contrast-ready")) h.classList.add("nav-contrast-ready");
        } catch (e) {}
      } else if (wantDarkNav !== preferDarkNav) {
        setPreferDarkNav(wantDarkNav);
      }
    }
  }

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

  useEffect(() => {
    requestMeasure();
  }, [open]);

  const variantClass =
    preferDarkNav === null ? "nav-contrast-auto" : preferDarkNav ? "nav-contrast-dark" : "nav-contrast-light";

  return (
    <>
      <header
        ref={headerRef}
        className={`pt-header ${variantClass}`}
        role="banner"
      >
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
            <nav className="desktopNav" aria-label="Main navigation">
              <Link href="/" className="navItem">Главная</Link>
              <Link href="/blog" className="navItem">Блог</Link>
              <Link href="/about" className="navItem">О проекте</Link>
            </nav>

            <div className="right-actions" aria-hidden={false}>
              {user ? (
                <>
                  {/* Desktop-only actions (hidden on small screens via CSS) */}
                  <Link href="/dashboard" className="navItem actionPrimary">Dashboard</Link>
                  <Link href="/profile" className="navItem actionPrimary">Профиль</Link>
                </>
              ) : (
                <>
                  <Link href="/login" className="navItem actionPrimary">Войти</Link>
                  <Link href="/register" className="navItem actionPrimary">Регистрация</Link>
                </>
              )}
            </div>
          </div>

          <div
            ref={menuRef}
            className={`mobileMenu ${open ? "show" : ""}`}
            role="menu"
            aria-hidden={!open}
          >
            <div className="mobileInner">
              {/* Always render all links inside the burger so mobile users can access everything */}
              <a href="/" onClick={() => setOpen(false)} role="menuitem">Главная</a>
              <a href="/blog" onClick={() => setOpen(false)} role="menuitem">Блог</a>
              <a href="/about" onClick={() => setOpen(false)} role="menuitem">О проекте</a>

              <div className="mobileActions">
                {user ? (
                  <>
                    <a href="/dashboard" className="actionPrimary" onClick={() => setOpen(false)}>Dashboard</a>
                    <a href="/profile" className="actionPrimary" onClick={() => setOpen(false)}>Профиль</a>
                  </>
                ) : (
                  <>
                    <a href="/login" className="actionPrimary" onClick={() => setOpen(false)}>Войти</a>
                    <a href="/register" className="actionPrimary" onClick={() => setOpen(false)}>Регистрация</a>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>

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
            z-index: 60;
            height: var(--header-height);
            pointer-events: auto;
            transition: background-color 220ms ease, color 220ms ease, box-shadow 220ms ease;
          }

          .pt-header:not(.nav-contrast-ready) {
            transition: none !important;
          }

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

          .nav-contrast-auto .bar {
            --nav-bg: linear-gradient(90deg, var(--blue-1) 0%, var(--blue-2) 50%, var(--blue-3) 100%);
            --nav-foreground: #ffffff;
          }

          .nav-contrast-dark .bar {
            --nav-bg: rgb(6, 12, 20);
            --nav-foreground: #ffffff;
            box-shadow: 0 6px 18px rgba(2,6,23,0.28);
          }

          .nav-contrast-light .bar {
            --nav-bg: rgb(255, 255, 255);
            --nav-foreground: #0f1724;
            box-shadow: 0 6px 18px rgba(2,6,23,0.06);
            border-bottom: 1px solid rgba(15,23,36,0.06);
          }

          .left, .center, .right { display:flex; align-items:center; }

          .logoLink { display:flex; gap:10px; align-items:center; color:inherit; text-decoration:none; }
          .logoCircle { width:40px; height:40px; border-radius:999px; border:1px solid rgba(255,255,255,0.12); display:flex; align-items:center; justify-content:center; background: rgba(255,255,255,0.06); }
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
          .burger.open { background: rgba(0,0,0,0.08); color: inherit; border-color: rgba(0,0,0,0.08); box-shadow: var(--shadow); }
          .burger.closed:hover { transform: translateY(-1px); box-shadow: 0 4px 12px rgba(0,0,0,0.08); }

          .right { gap: 12px; }

          .desktopNav { display: none; gap: 18px; margin-left: 6px; }
          .desktopNav .navItem { color: inherit !important; text-decoration: none; font-weight: 600; padding: 4px 6px; }
          @media (min-width: 960px) { .desktopNav { display:flex; } .center { display: none; } }

          /* Right actions - desktop: keep at right, vertically centered.
             We'll hide them on small screens so burger contains everything. */
          .right-actions {
            display: flex;
            align-items: center; /* vertical centering */
            gap: 10px;
            margin-left: 8px;
            pointer-events: auto;
            justify-content: flex-end; /* keep at the right */
          }

          /* Base button-like styles */
          .pt-header .navItem { display: inline-flex; align-items:center; gap:8px; padding:6px 10px; border-radius:8px; text-decoration:none; }
          .pt-header .actionBtn, .pt-header .actionPrimary {
            font-weight: 600;
            padding: 8px 14px;
            border-radius: 10px;
            text-decoration: none;
            display: inline-flex;
            align-items: center;
            justify-content: center;
            gap: 8px;
          }

          /* Theme-specific explicit button colors */
          .nav-contrast-dark .actionPrimary {
            background: var(--nav-foreground);
            color: var(--nav-bg);
            border: 1px solid rgba(255,255,255,0.06);
            box-shadow: 0 4px 10px rgba(2,6,23,0.06);
          }
          .nav-contrast-dark .actionBtn {
            background: transparent;
            color: var(--nav-foreground);
            border: 1px solid rgba(255,255,255,0.18);
          }

          .nav-contrast-light .actionPrimary {
            background: var(--nav-foreground);
            color: var(--nav-bg);
            border: 1px solid rgba(15,23,36,0.06);
            box-shadow: 0 4px 10px rgba(2,6,23,0.03);
          }
          .nav-contrast-light .actionBtn {
            background: transparent;
            color: var(--nav-foreground);
            border: 1px solid rgba(15,23,36,0.08);
          }

          .nav-contrast-auto .actionPrimary {
            background: #ffffff;
            color: #061214;
            border: 1px solid rgba(0,0,0,0.06);
          }
          .nav-contrast-auto .actionBtn {
            background: transparent;
            color: #ffffff;
            border: 1px solid rgba(255,255,255,0.18);
          }

          /* MOBILE menu styles */
          .mobileMenu { display: none; }
          .mobileMenu.show {
            display: block;
            position: absolute;
            left: 0;
            right: 0;
            top: calc(var(--header-height));
            background: var(--nav-bg);
            color: var(--nav-foreground);
            z-index: 50;
          }
          .mobileInner {
            padding: 18px;
            display:flex;
            flex-direction:column;
            gap:12px;
          }
          .mobileInner > a {
            display: block;
            width: 100%;
            text-align: center;
            padding: 10px 0;
          }

          /* Mobile actions: center horizontally and vertically, buttons grouped */
          .mobileActions {
            display: flex;
            flex-direction: column;
            gap: 10px;
            align-items: center;
            justify-content: center;
            margin-top: 10px;
          }

          /* Ensure mobile buttons have reasonable min-width and look good when centered */
          .mobileActions .actionPrimary,
          .mobileActions .actionBtn {
            width: 100%;
            max-width: 240px;
            text-align: center;
          }

          /* Make sure on small screens desktop items are hidden so burger contains everything */
          @media (max-width: 960px) {
            .desktopNav { display: none !important; }
            .right-actions { display: none !important; }
          }

          @media (min-width: 960px) {
            .mobileMenu { display: none !important; }
          }
        `}</style>
      </header>
    </>
  );
}
