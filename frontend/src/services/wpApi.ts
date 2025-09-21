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
const WP_BASE = (import.meta.env.VITE_WP_BASE as string) || 'https://cs88500-wordpress-o0a99.tw1.ru';

async function safeParseJson(res: Response) {
  const text = await res.text();
  try {
    return JSON.parse(text);
  } catch (e) {
    throw new Error(`Invalid JSON received from WP: ${text.slice(0,200)}`);
  }
}

export async function fetchPosts(page = 1, perPage = 10): Promise<PostSummary[]> {
  const url = `${WP_BASE.replace(/\/+$/,'')}/wp-json/wp/v2/posts?per_page=${perPage}&page=${page}&_embed`;
  const res = await fetch(url, { method: 'GET', headers: { 'Accept': 'application/json' } });
  if (!res.ok) {
    throw new Error(`WP fetchPosts error: ${res.status}`);
  }
  const data = await safeParseJson(res);
  if (!Array.isArray(data)) {
    throw new Error(`Expected posts array but got ${typeof data}`);
  }
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
  const url = `${WP_BASE.replace(/\/+$/,'')}/wp-json/wp/v2/posts?slug=${encodeURIComponent(slug)}&_embed`;
  const res = await fetch(url, { method: 'GET', headers: { 'Accept': 'application/json' } });
  if (!res.ok) {
    throw new Error(`WP fetchPostBySlug error: ${res.status}`);
  }
  const data = await safeParseJson(res);
  const arr = Array.isArray(data) ? data : [];
  if (!arr.length) {
    throw new Error('Post not found');
  }
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
