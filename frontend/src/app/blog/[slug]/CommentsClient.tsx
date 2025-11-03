// frontend/src/app/blog/[slug]/CommentsClient.tsx
"use client";

import React, { useEffect, useState } from "react";

type Comment = {
  id: number;
  name: string;
  content: string;
  created_at: string;
  replies?: Comment[];
};

function getCookie(name: string) {
  if (typeof document === "undefined") return null;
  const v = document.cookie.match("(^|;)\\s*" + name + "\\s*=\\s*([^;]+)");
  return v ? decodeURIComponent(v.pop() || "") : null;
}

export default function CommentsClient({
  postId,
  initialComments = [],
}: {
  postId: number;
  initialComments?: Comment[];
}) {
  const API_BASE = (process.env.NEXT_PUBLIC_API_URL || "").replace(/\/$/, "");
  const [comments, setComments] = useState<Comment[]>(
    Array.isArray(initialComments) ? initialComments : []
  );
  const [loading, setLoading] = useState<boolean>(false);
  const [name, setName] = useState<string>("");
  const [content, setContent] = useState<string>("");
  const [error, setError] = useState<string | null>(null);
  const [sending, setSending] = useState<boolean>(false);

  useEffect(() => {
    let mounted = true;

    async function load() {
      if (!API_BASE) return;
      setLoading(true);
      try {
        const endpoints = [
          `${API_BASE}/api/blog/comments/?post=${encodeURIComponent(String(postId))}`,
          `${API_BASE}/api/blog/posts/${encodeURIComponent(String(postId))}/comments/`,
          `${API_BASE}/api/comments/?post=${encodeURIComponent(String(postId))}`,
        ];

        let found: any = null;
        for (const url of endpoints) {
          try {
            const res = await fetch(url, { cache: "no-store", credentials: "include" });
            if (!res.ok) continue;
            const data = await res.json();
            if (Array.isArray(data)) found = data;
            else if (data && typeof data === "object") {
              if (Array.isArray(data.results)) found = data.results;
              else if (Array.isArray(data.comments)) found = data.comments;
              else if (Array.isArray(data.items)) found = data.items;
              else {
                const arr = Object.values(data).find((v) => Array.isArray(v));
                if (Array.isArray(arr)) found = arr;
              }
            }
            if (found) break;
          } catch (e) {
            console.warn("comments fetch try failed", url, e);
            continue;
          }
        }

        if (mounted) {
          if (Array.isArray(found)) setComments(found);
          // если не найдено — оставляем initialComments
        }
      } catch (e) {
        console.error("Ошибка получения комментариев:", e);
      } finally {
        if (mounted) setLoading(false);
      }
    }

    if (!initialComments || initialComments.length === 0) {
      load();
    } else {
      setComments(initialComments);
    }

    return () => {
      mounted = false;
    };
  }, [postId, API_BASE, initialComments]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!name.trim() || !content.trim()) {
      setError("Заполните имя и текст комментария.");
      return;
    }

    setSending(true);

    const temp: Comment = {
      id: Date.now() * -1,
      name: name.trim(),
      content: content.trim(),
      created_at: new Date().toISOString(),
    };
    setComments((c) => [temp, ...c]);
    setName("");
    setContent("");

    try {
      if (!API_BASE) throw new Error("NEXT_PUBLIC_API_URL не задан");

      const csrftoken = getCookie("csrftoken") || getCookie("CSRF-TOKEN") || "";

      // основной endpoint
      const createUrl = `${API_BASE}/api/blog/comments/`;

      const res = await fetch(createUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(csrftoken ? { "X-CSRFToken": csrftoken } : {}),
        },
        credentials: "include",
        body: JSON.stringify({ post: postId, name: temp.name, content: temp.content }),
      });

      if (res.status === 403) {
        // возможно CSRF или permission: попробуем fallback nested endpoint
        const fbUrl = `${API_BASE}/api/blog/posts/${encodeURIComponent(String(postId))}/comments/`;
        try {
          const res2 = await fetch(fbUrl, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              ...(csrftoken ? { "X-CSRFToken": csrftoken } : {}),
            },
            credentials: "include",
            body: JSON.stringify({ name: temp.name, content: temp.content }),
          });
          if (!res2.ok) throw new Error("Ошибка создания комментария (fallback)");
          const saved2 = await res2.json();
          setComments((c) => c.map((it) => (it.id === temp.id ? saved2 : it)));
          setSending(false);
          return;
        } catch (ef) {
          // продолжим в catch ниже
          throw new Error("Ошибка создания комментария (403). Проверь CORS/CSRF/permissions на сервере.");
        }
      }

      if (!res.ok) {
        // получаем текст ошибки для логирования
        const txt = await res.text().catch(() => "");
        throw new Error(`Ошибка создания комментария: ${res.status} ${txt}`);
      }

      const saved = await res.json();
      setComments((c) =>
        c.map((it) => {
          if (it.id === temp.id) return saved;
          if (it.name === saved.name && it.content === saved.content) return saved;
          return it;
        })
      );
    } catch (err: any) {
      console.error("send comment error", err);
      setError(err?.message || "Не удалось отправить комментарий");
      setComments((c) => c.filter((it) => it.id !== temp.id));
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="comments-root">
      {loading ? <p style={{ textAlign: "center", color: "rgba(15,23,36,0.6)" }}>Загрузка комментариев...</p> : null}

      <ul className="comments-list" aria-live="polite">
        {comments.map((c) => (
          <li key={c.id} className="comment-card">
            <div className="comment-row">
              <strong className="comment-name">{c.name}</strong>
              <time className="comment-time">{new Date(c.created_at).toLocaleDateString("ru-RU")}</time>
            </div>
            <div className="comment-body">{c.content}</div>
          </li>
        ))}
      </ul>

      <form className="comment-form" onSubmit={handleSubmit} noValidate>
        <h3 style={{ margin: 0 }}>Оставить комментарий</h3>

        <input
          className="comment-input"
          aria-label="Ваше имя"
          placeholder="Ваше имя"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />

        <textarea
          className="comment-textarea"
          aria-label="Комментарий"
          placeholder="Ваш комментарий..."
          value={content}
          onChange={(e) => setContent(e.target.value)}
        />

        {error && <div className="comment-error">{error}</div>}

        <div style={{ display: "flex", gap: 8 }}>
          <button className="btn btn-primary" type="submit" disabled={sending}>
            {sending ? "Отправка..." : "Отправить"}
          </button>
          <button
            type="button"
            className="btn btn-secondary"
            onClick={() => {
              setName("");
              setContent("");
              setError(null);
            }}
          >
            Очистить
          </button>
        </div>
      </form>

      <style jsx>{`
        .comments-root { display:flex; flex-direction:column; gap:12px; margin-top:12px; }
        .comments-list { list-style:none; padding:0; margin:0; display:flex; flex-direction:column; gap:10px; }
        .comment-card { background: #fff; padding: 12px 14px; border-radius: 10px; box-shadow: 0 6px 18px rgba(2,6,23,0.06); }
        .comment-row { display:flex; justify-content:space-between; gap:12px; align-items:center; margin-bottom:8px; }
        .comment-name { color: #0f1724; font-weight:700; }
        .comment-time { color: #64748b; font-size:0.9rem; }
        .comment-body { color:#1e293b; line-height:1.45; white-space:pre-wrap; }

        .comment-form { background: #ffffff; padding: 14px; border-radius: 12px; box-shadow: 0 6px 18px rgba(2,6,23,0.06); display:flex; flex-direction:column; gap:10px; }
        .comment-input, .comment-textarea { width:100%; border-radius:8px; border:1px solid #e6edf3; padding:10px; background:#fbfdff; font-size:0.95rem; }
        .comment-input:focus, .comment-textarea:focus { outline:none; border-color:#1fa6ff; background:#fff; }
        .comment-textarea { min-height:110px; resize:vertical; }
        .comment-error { color:#ef4444; font-size:0.9rem; }
      `}</style>
    </div>
  );
}
