// frontend/src/services/reactionsApi.ts
// Этот модуль общается с твоим Django backend (Render).
// Endpoints:
// GET  /api/blog/reactions/?post_id=<postId_or_slug>
// POST /api/blog/reactions/toggle/    body: { post_identifier: string } (slug или id)
// Передаём Authorization если пользователь залогинен (accessToken)

const API_BASE = (import.meta.env.VITE_API_BASE_URL as string) || 'https://sdracker.onrender.com';

export type ReactionInfo = {
  post_identifier: string;
  likes_count: number;
  liked_by_current_user: boolean;
};

async function reqJson(url: string, options: RequestInit = {}) {
  const token = localStorage.getItem('accessToken');
  const headers: HeadersInit = {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...((options.headers || {}) as HeadersInit),
  };
  const res = await fetch(url, { ...options, headers });
  const text = await res.text();
  try {
    const json = text ? JSON.parse(text) : null;
    if (!res.ok) throw new Error(JSON.stringify(json) || `HTTP ${res.status}`);
    return json;
  } catch (e) {
    // если не JSON — бросаем оригинальный текст
    if (!res.ok) throw new Error(text || String(e));
    throw e;
  }
}

/**
 * Получить stats по посту
 * query: /api/blog/reactions/?post_identifier=<slug_or_id>
 */
export async function getReactions(post_identifier: string): Promise<ReactionInfo> {
  const url = `${API_BASE}/api/blog/reactions/?post_identifier=${encodeURIComponent(post_identifier)}`;
  return reqJson(url, { method: 'GET' });
}

/**
 * Переключить лайк для текущего пользователя (toggle)
 * Возвращает актуальную сущность ReactionInfo
 */
export async function toggleReaction(post_identifier: string): Promise<ReactionInfo> {
  const url = `${API_BASE}/api/blog/reactions/toggle/`;
  return reqJson(url, {
    method: 'POST',
    body: JSON.stringify({ post_identifier }),
  });
}
