const API_BASE = process.env.NEXT_PUBLIC_API_BASE || "https://sdracker.onrender.com";

// ======== Типы данных ========

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
  meta_title: string;
  meta_description: string;
  og_image?: string | null;
}

// ======== API функции ========

// Список постов с пагинацией
export async function fetchPosts(page: number = 1): Promise<{ results: Post[]; count: number; next: string | null; previous: string | null }> {
  const res = await fetch(`${API_BASE}/api/blog/posts/?page=${page}`);
  if (!res.ok) throw new Error("Ошибка загрузки постов");
  return await res.json();
}

// Один пост по slug
export async function fetchPost(slug: string): Promise<Post> {
  const res = await fetch(`${API_BASE}/api/blog/posts/${slug}/`);
  if (!res.ok) throw new Error("Ошибка загрузки поста");
  return await res.json();
}

// Лайк/анлайк поста
export async function toggleReaction(slug: string): Promise<{ post_slug: string; likes_count: number }> {
  const res = await fetch(`${API_BASE}/api/blog/reactions/toggle/`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ post_slug: slug }),
  });
  if (!res.ok) throw new Error("Ошибка реакции");
  return await res.json();
}

// Получить количество лайков
export async function fetchReaction(slug: string): Promise<{ post_slug: string; likes_count: number }> {
  const res = await fetch(`${API_BASE}/api/blog/reactions/detail/?post_slug=${slug}`);
  if (!res.ok) throw new Error("Ошибка лайков");
  return await res.json();
}
