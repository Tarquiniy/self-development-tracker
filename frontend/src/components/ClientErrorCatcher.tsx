// frontend/src/components/ClientErrorCatcher.tsx
"use client";

import React, { useEffect, useState } from "react";

export default function ClientErrorCatcher() {
  const [last, setLast] = useState<any | null>(null);

  useEffect(() => {
    // handler for window.onerror
    function onErr(msg: any, url?: string, line?: number, col?: number, err?: Error) {
      const payload = {
        type: "error",
        message: typeof msg === "string" ? msg : (msg?.toString?.() ?? String(msg)),
        url,
        line,
        column: col,
        stack: err?.stack ?? null,
        time: new Date().toISOString(),
        userAgent: navigator.userAgent,
      };
      setLast(payload);
      send(payload).catch(() => {});
      // don't call preventDefault here — let default behavior also run
    }

    // unhandled promise rejections
    function onRejection(ev: PromiseRejectionEvent) {
      const reason = ev.reason;
      const payload = {
        type: "unhandledrejection",
        message: reason?.message ?? String(reason),
        stack: reason?.stack ?? null,
        time: new Date().toISOString(),
        userAgent: navigator.userAgent,
      };
      setLast(payload);
      send(payload).catch(() => {});
    }

    // React render errors can be caught by Error Boundaries; this global listener is a safety net.
    window.addEventListener("error", (e: ErrorEvent) => {
      onErr(e.message, e.filename, e.lineno, e.colno, e.error);
    });

    window.addEventListener("unhandledrejection", onRejection);

    // optional: hook into fetch failures (useful)
    const origFetch = window.fetch;
    window.fetch = function (...args) {
      return origFetch.apply(this, args).then((res) => {
        if (!res.ok) {
          // try to clone/res text (best-effort)
          res.clone().text().then((text) => {
            const payload = {
              type: "fetch_error",
              url: (args && args[0]) || "",
              status: res.status,
              statusText: res.statusText,
              bodySnippet: text?.slice?.(0, 200),
              time: new Date().toISOString(),
              userAgent: navigator.userAgent,
            };
            send(payload).catch(() => {});
            setLast(payload);
          }).catch(()=>{});
        }
        return res;
      }).catch((err) => {
        const payload = {
          type: "fetch_exception",
          url: (args && args[0]) || "",
          message: err?.message ?? String(err),
          stack: err?.stack ?? null,
          time: new Date().toISOString(),
          userAgent: navigator.userAgent,
        };
        send(payload).catch(() => {});
        setLast(payload);
        throw err;
      });
    };

    return () => {
      window.fetch = origFetch;
      window.removeEventListener("unhandledrejection", onRejection);
      // "error" listener was anonymous wrapper — leaving it is fine for page lifecycle
    };
  }, []);

  async function send(payload: any) {
    try {
      await fetch("/api/debug/client-error", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
    } catch (e) {
      // swallow
    }
  }

  if (!last) return null;

  const pretty = JSON.stringify(last, null, 2);

  return (
    <div style={overlayStyle}>
      <div style={boxStyle}>
        <h3 style={{ margin: 0 }}>Произошла клиентская ошибка</h3>
        <p style={{ margin: "6px 0 12px 0", color: "#666" }}>
          Ошибка зафиксирована и отправлена на сервер. Откройте консоль (F12) для подробностей.
        </p>
        <pre style={{ maxHeight: 240, overflow: "auto", background: "#0f1724", color: "#dbeafe", padding: 12, borderRadius: 8 }}>
          {pretty}
        </pre>
        <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
          <button onClick={() => { navigator.clipboard?.writeText(pretty); }} style={btnStyle}>Скопировать отчёт</button>
          <button onClick={() => { window.open("/api/debug/client-error", "_blank"); }} style={btnGhostStyle}>Открыть лог (server)</button>
          <button onClick={() => location.reload()} style={btnStyle}>Перезагрузить страницу</button>
        </div>
      </div>
    </div>
  );
}

const overlayStyle: React.CSSProperties = {
  position: "fixed",
  inset: 0,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  background: "rgba(2,6,23,0.6)",
  zIndex: 99999,
};

const boxStyle: React.CSSProperties = {
  width: "min(980px, calc(100% - 40px))",
  background: "#fff",
  padding: 18,
  borderRadius: 12,
  boxShadow: "0 12px 48px rgba(2,6,23,0.4)",
};

const btnStyle: React.CSSProperties = {
  background: "#0b69ff",
  color: "#fff",
  border: "none",
  padding: "8px 12px",
  borderRadius: 8,
  cursor: "pointer",
};

const btnGhostStyle: React.CSSProperties = {
  background: "#fff",
  color: "#0b69ff",
  border: "1px solid #0b69ff",
  padding: "8px 12px",
  borderRadius: 8,
  cursor: "pointer",
};
