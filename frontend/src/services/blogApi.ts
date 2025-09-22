// frontend/src/services/blogApi.ts

export interface Category {
  id: number;
  title: string;
  slug: string;
  description: string;
}

export interface Tag {
  id: number;
  title: string;
  slug: string;
}

export interface Post {
  id: number;
  title: string;
  slug: string;
  excerpt: string;
  content: string;
  featured_image?: string;
  categories: Category[];
  tags: Tag[];
  published_at: string;
  meta_title?: string;
  meta_description?: string;
  og_image?: string | null;
  author?: string;
  likes_count?: number;
}

export interface PostListResponse {
  results: Post[];
  count: number;
  next: string | null;
  previous: string | null;
}

const API_BASE =
  import.meta.env.VITE_API_BASE_URL?.replace(/\/$/, '') ||
  'https://sdracker.onrender.com';

// 📌 Получить список постов
export async function fetchPosts(page: number = 1): Promise<PostListResponse> {
  try {
    // ⚠️ используем правильный формат, без per_page
    const res = await fetch(`${API_BASE}/api/blog/posts/?page=${page}&format=json`);

    if (!res.ok) {
      throw new Error(`Ошибка загрузки постов: ${res.status} ${res.statusText}`);
    }

    const data = await res.json();

    return {
      results: data.results ?? [],
      count: data.count ?? 0,
      next: data.next ?? null,
      previous: data.previous ?? null,
    };
  } catch (error) {
    console.error('Error fetching posts:', error);
    return {
      results: [],
      count: 0,
      next: null,
      previous: null,
    };
  }
}

// 📌 Получить один пост
export async function fetchPost(slug: string): Promise<Post> {
  const res = await fetch(`${API_BASE}/api/blog/posts/${slug}/?format=json`);

  if (!res.ok) {
    if (res.status === 404) throw new Error('Пост не найден');
    throw new Error(`Ошибка загрузки поста: ${res.status}`);
  }

  return await res.json();
}

// Лайк/анлайк поста
export async function toggleReaction(
  slug: string
): Promise<{ post_slug: string; likes_count: number }> {
  const token = localStorage.getItem('accessToken');
  const headers: HeadersInit = { 'Content-Type': 'application/json' };

  if (token) headers['Authorization'] = `Bearer ${token}`;

  const res = await fetch(`${API_BASE}/api/blog/reactions/toggle/`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ post_slug: slug }),
  });

  if (!res.ok) throw new Error(`Ошибка реакции: ${res.status}`);

  return await res.json();
}

// Получить количество лайков
export async function fetchReaction(
  slug: string
): Promise<{ post_slug: string; likes_count: number }> {
  try {
    const res = await fetch(
      `${API_BASE}/api/blog/reactions/detail/?post_slug=${slug}`
    );

    if (!res.ok) {
      if (res.status === 404) return { post_slug: slug, likes_count: 0 };
      throw new Error(`Ошибка загрузки лайков: ${res.status}`);
    }

    return await res.json();
  } catch (error) {
    console.error('Error fetching reaction:', error);
    return { post_slug: slug, likes_count: 0 };
  }
}

// Получить комментарии для поста
export async function fetchComments(postId: number) {
  try {
    const res = await fetch(`${API_BASE}/api/blog/comments/?post=${postId}`);
    if (!res.ok) throw new Error(`Ошибка загрузки комментариев: ${res.status}`);
    return await res.json();
  } catch (error) {
    console.error('Error fetching comments:', error);
    return [];
  }
}
