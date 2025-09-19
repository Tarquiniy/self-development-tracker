// frontend/src/services/wpApi.ts

export type PostSummary = {
  id: number;
  title: string;
  excerpt: string;
  date: string;
  slug: string;
  featured_image_url?: string | null;
};

const BACKEND_BASE = (import.meta.env.VITE_API_BASE_URL as string) || 'https://sdracker.onrender.com';

export async function fetchPosts(page = 1, perPage = 10): Promise<PostSummary[]> {
  const url = `${BACKEND_BASE}api/wordpress/posts/?page=${page}&perPage=${perPage}`;
  const res = await fetch(url, {
    method: 'GET',
    headers: {
      'Accept': 'application/json'
    }
  });
  if (!res.ok) {
    throw new Error(`Backend proxy error: ${res.status}`);
  }
  const text = await res.text();
  let data: any;
  try {
    data = JSON.parse(text);
  } catch (err) {
    throw new Error(`Invalid JSON received: ${text}`);
  }
  // Проверяем, что это массив
  if (!Array.isArray(data)) {
    throw new Error(`Expected array of posts but got: ${typeof data}`);
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

