// services/wpApi.ts

import { PostSummary } from "./api";

const BACKEND_BASE = import.meta.env.VITE_API_BASE_URL as string || 'https://sdracker.onrender.com';

export async function fetchPosts(page = 1, perPage = 10): Promise<PostSummary[]> {
  const url = `${BACKEND_BASE}/api/wordpress/posts/?page=${page}&perPage=${perPage}`;
  const res = await fetch(url, {
    method: 'GET'
  });
  if (!res.ok) {
    throw new Error(`Backend proxy error: ${res.status}`);
  }
  const data = await res.json() as any[];
  return data.map(p => ({
    id: p.id,
    title: p.title.rendered,
    excerpt: p.excerpt.rendered,
    date: p.date,
    slug: p.slug,
    featured_image_url: p._embedded?.['wp:featuredmedia']?.[0]?.source_url ?? null
  }));
}
