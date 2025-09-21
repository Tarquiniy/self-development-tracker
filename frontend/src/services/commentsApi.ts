// frontend/src/services/commentsApi.ts

export type WPComment = {
  id: number;
  post: number;
  author_name?: string;
  author_email?: string;
  content: { rendered: string } | { raw?: string };
  date: string;
  parent: number;
  author_avatar_urls?: Record<string, string>;
};

const WP_BASE = (import.meta.env.VITE_WP_BASE as string || '').replace(/\/+$/, '');

async function ensureJson(res: Response) {
  const text = await res.text();
  try {
    return JSON.parse(text);
  } catch (err) {
    throw new Error(`Invalid JSON received from WP: ${text.slice(0, 200)}`);
  }
}

/**
 * Получить ID поста по slug
 */
export async function getPostIdBySlug(slug: string): Promise<number> {
  if (!WP_BASE) throw new Error('VITE_WP_BASE is not set');
  const url = `${WP_BASE}/wp-json/wp/v2/posts?slug=${encodeURIComponent(slug)}`;
  const r = await fetch(url, {
    method: 'GET',
    headers: {
      'Accept': 'application/json'
    }
  });
  if (!r.ok) {
    const body = await r.text();
    throw new Error(`Can't fetch post by slug: ${r.status} / ${body}`);
  }
  const arr = await r.json() as any[];
  if (!Array.isArray(arr) || arr.length === 0) throw new Error('Post not found');
  return arr[0].id;
}

/**
 * Получить комментарии для поста по ID
 */
export async function fetchCommentsForPostId(postId: number, page = 1, perPage = 50): Promise<WPComment[]> {
  if (!WP_BASE) throw new Error('VITE_WP_BASE is not set');
  const url = `${WP_BASE}/wp-json/wp/v2/comments?post=${postId}&per_page=${perPage}&page=${page}&orderby=date&order=asc&_embed`;
  const res = await fetch(url, {
    method: 'GET',
    headers: { 'Accept': 'application/json' }
  });
  if (!res.ok) {
    const txt = await res.text();
    throw new Error(`WP fetchComments error: ${res.status} / ${txt}`);
  }
  const data = await ensureJson(res);
  if (!Array.isArray(data)) return [];
  return data as WPComment[];
}

/**
 * Получить комментарии по slug (удобство для фронтенда)
 */
export async function fetchCommentsForPost(slug: string): Promise<WPComment[]> {
  const postId = await getPostIdBySlug(slug);
  return fetchCommentsForPostId(postId);
}

/**
 * Отправить комментарий к посту (анонимный или авторизованный)
 * params: content - текст, author_name/email для неавторизованных
 */
export async function postCommentForPostSlug(params: {
  postSlug: string;
  content: string;
  parent?: number | null;
  author_name?: string;
  author_email?: string;
}): Promise<WPComment> {
  if (!WP_BASE) throw new Error('VITE_WP_BASE is not set');
  const postId = await getPostIdBySlug(params.postSlug);

  const bodyData: Record<string, any> = {
    post: postId,
    content: params.content,
    parent: params.parent ?? 0,
  };

  if (params.author_name) {
    bodyData.author_name = params.author_name;
  }
  if (params.author_email) {
    bodyData.author_email = params.author_email;
  }

  const res = await fetch(`${WP_BASE}/wp-json/wp/v2/comments`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'application/json'
    },
    body: JSON.stringify(bodyData),
    credentials: 'include' // если WP требует куки / авторизацию по кукам
  });

  if (!res.ok) {
    const maybe = await res.text();
    let errText = maybe;
    try {
      const parsed = JSON.parse(maybe);
      if (parsed.message) {
        errText = parsed.message;
      } else {
        errText = JSON.stringify(parsed);
      }
    } catch {
      // use raw text
    }
    throw new Error(`Can't post comment: ${res.status} / ${errText}`);
  }

  const json = await ensureJson(res);
  return json as WPComment;
}
