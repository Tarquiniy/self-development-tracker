// src/services/wpApi.ts
export type PostSummary = {
  id: number;
  title: string;
  excerpt: string;
  date: string;
  slug: string;
  featured_image_url?: string | null;
};

export type PostFull = PostSummary & { content: string };

const BACKEND_BASE = (import.meta.env.VITE_API_BASE_URL as string) || 'https://sdracker.onrender.com';

async function safeParseJson(res: Response) {
  const text = await res.text();
  try { return JSON.parse(text); }
  catch (e) {
    throw new Error(`Invalid JSON received: ${text.slice(0,200)}`);
  }
}

export async function fetchPosts(page = 1, perPage = 10): Promise<PostSummary[]> {
  const url = `${BACKEND_BASE.replace(/\/+$/,'')}/api/wordpress/posts?page=${page}&perPage=${perPage}`;
  const res = await fetch(url, { method: 'GET', headers: { 'Accept': 'application/json' } });
  if (!res.ok) throw new Error(`Backend proxy error: ${res.status}`);
  const data = await safeParseJson(res);
  if (!Array.isArray(data)) throw new Error('Expected posts array');
  return data.map((p: any) => ({
    id: p.id,
    title: p.title?.rendered ?? '',
    excerpt: p.excerpt?.rendered ?? '',
    date: p.date,
    slug: p.slug,
    featured_image_url: p._embedded?.['wp:featuredmedia']?.[0]?.source_url ?? null
  }));
}

export async function fetchPostBySlug(slug: string): Promise<PostFull> {
  const url = `${BACKEND_BASE.replace(/\/+$/,'')}/api/wordpress/posts?slug=${encodeURIComponent(slug)}&_embed`;
  const res = await fetch(url, { method: 'GET', headers: { 'Accept': 'application/json' } });
  if (!res.ok) throw new Error(`Backend proxy error: ${res.status}`);
  const data = await safeParseJson(res);
  const arr = Array.isArray(data) ? data : [];
  if (!arr.length) throw new Error('Post not found');
  const p = arr[0];
  return {
    id: p.id,
    title: p.title?.rendered ?? '',
    excerpt: p.excerpt?.rendered ?? '',
    content: p.content?.rendered ?? '',
    date: p.date,
    slug: p.slug,
    featured_image_url: p._embedded?.['wp:featuredmedia']?.[0]?.source_url ?? null
  };
}
