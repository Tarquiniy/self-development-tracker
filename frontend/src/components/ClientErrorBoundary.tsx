// frontend/src/components/ClientErrorBoundary.tsx
"use client";

import React from "react";

type State = {
  hasError: boolean;
  error?: Error | null;
  info?: React.ErrorInfo | null;
  details?: any;
};

export default class ClientErrorBoundary extends React.Component<{ children: React.ReactNode }, State> {
  constructor(props: any) {
    super(props);
    this.state = { hasError: false, error: null, info: null, details: null };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    // Собираем максимально полезный дамп: стек, react info, window state
    const details: any = {
      stack: error?.stack,
      message: error?.message,
      componentStack: info?.componentStack,
      url: (typeof window !== "undefined" && location?.href) || null,
      userAgent: (typeof navigator !== "undefined" && navigator.userAgent) || null,
      // Попробуем взять props корневого children если это React элемент
      childrenType: this.props.children && (this.props.children as any)?.type?.name || typeof this.props.children,
    };

    // Сохраним в состоянии и в window для дебага
    this.setState({ info, details });
    // вывод в консоль (и отправка на сервер — опционально, раскомментируйте и подправьте endpoint)
    // fetch('/api/debug/client-error', { method:'POST', body: JSON.stringify({message: error.message, stack:error.stack, info, details}) });

    // также поставим на window для ручного осмотра
    try { (window as any).__CLIENT_RENDER_ERROR__ = { error: String(error), stack: error.stack, info, details }; } catch {}
    // eslint-disable-next-line no-console
    console.error("ClientErrorBoundary caught error:", error, info, details);
  }

  renderFallback() {
    const { error, info, details } = this.state;
    return (
      <div style={{
        fontFamily: "Inter, system-ui, -apple-system, 'Segoe UI', Roboto, 'Helvetica Neue', Arial",
        padding: 18, background: "#fff6f6", color: "#3b0a0a", borderRadius: 8, margin: 16, boxShadow: "0 6px 28px rgba(10,10,10,0.06)"
      }}>
        <h2 style={{ marginTop: 0 }}>Ошибка в клиентской части приложения</h2>
        <p>Произошла ошибка при загрузке страницы. Консоль разработчика содержит стектрейс.</p>

        <details style={{ whiteSpace: "pre-wrap", marginTop: 8 }}>
          <summary style={{ cursor: "pointer", fontWeight: 700 }}>Показать детали ошибки</summary>
          <div style={{ marginTop: 8 }}>
            <b>message:</b> {error?.message ?? String(error)}<br/>
            <b>stack:</b><br/>
            <code style={{ fontSize: 12, display: "block", marginTop: 6, color: "#222" }}>{error?.stack ?? "—"}</code>
            <b>componentStack:</b>
            <code style={{ fontSize: 12, display: "block", marginTop: 6, color: "#222" }}>{info?.componentStack ?? "—"}</code>
            <b>diagnostic dump:</b>
            <pre style={{ fontSize: 12, marginTop: 6 }}>{JSON.stringify(details ?? {}, null, 2)}</pre>
          </div>
        </details>

        <div style={{ marginTop: 12 }}>
          <button onClick={() => location.reload()} style={{ marginRight: 8 }}>Перезагрузить страницу</button>
          <button onClick={() => {
            try { navigator.clipboard.writeText(JSON.stringify({ error: error?.message, stack: error?.stack, info, details }, null, 2)); alert("Отправлено в буфер обмена"); }
            catch { alert("Не удалось скопировать"); }
          }}>Скопировать детали</button>
        </div>

        <div style={{ marginTop: 12, color: "#5b5b5b", fontSize: 12 }}>
          <div>Подсказка: чаще всего причиной является `const [a,b] = maybeArray;` где `maybeArray` — не массив (null/объект).</div>
          <div>Откройте DevTools → Console, найдите `__CLIENT_RENDER_ERROR__` в глобальном scope для дополнительной информации.</div>
        </div>
      </div>
    );
  }

  render() {
    if (this.state.hasError) {
      return this.renderFallback();
    }
    return this.props.children as React.ReactElement;
  }
}
