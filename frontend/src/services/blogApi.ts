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
  meta_title: string;
  meta_description: string;
  og_image?: string | null;
  author?: string;
  likes_count?: number;
}

// Базовый URL для API
const API_BASE = import.meta.env.VITE_API_BASE_URL || 'https://sdracker.onrender.com';

// Список постов с пагинацией
export async function fetchPosts(page: number = 1): Promise<{
  results: Post[];
  count: number;
  next: string | null;
  previous: string | null;
}> {
  try {
    const res = await fetch(`${API_BASE}/api/blog/posts/?page=${page}&per_page=10`);

    if (!res.ok) {
      // Если API возвращает 404, проверяем структуру ответа
      if (res.status === 404) {
        console.warn('API endpoint not found, checking alternative structure');
        // Попробуем прямой endpoint без пагинации
        const altRes = await fetch(`${API_BASE}/api/blog/posts/`);
        if (altRes.ok) {
          const data = await altRes.json();
          return {
            results: Array.isArray(data) ? data : data.results || [],
            count: Array.isArray(data) ? data.length : data.count || 0,
            next: null,
            previous: null
          };
        }
      }
      throw new Error(`Ошибка загрузки постов: ${res.status} ${res.statusText}`);
    }

    const data = await res.json();

    // Если ответ - массив (для совместимости с разными форматами)
    if (Array.isArray(data)) {
      return {
        results: data,
        count: data.length,
        next: null,
        previous: null
      };
    }

    // Если ответ уже в правильном формате
    return data;
  } catch (error) {
    console.error('Error fetching posts:', error);
    // Fallback для разработки
    return {
      results: [],
      count: 0,
      next: null,
      previous: null
    };
  }
}

// Один пост по slug
export async function fetchPost(slug: string): Promise<Post> {
  try {
    const res = await fetch(`${API_BASE}/api/blog/posts/${slug}/`);
    
    if (!res.ok) {
      if (res.status === 404) {
        throw new Error('Пост не найден');
      }
      throw new Error(`Ошибка загрузки поста: ${res.status}`);
    }
    
    return await res.json();
  } catch (error) {
    console.error('Error fetching post:', error);
    throw error;
  }
}

// Лайк/анлайк поста
export async function toggleReaction(slug: string): Promise<{ post_slug: string; likes_count: number }> {
  try {
    const token = localStorage.getItem('accessToken');
    const headers: HeadersInit = {
      'Content-Type': 'application/json',
    };
    
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }
    
    const res = await fetch(`${API_BASE}/api/blog/reactions/toggle/`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ post_slug: slug }),
    });
    
    if (!res.ok) {
      throw new Error(`Ошибка реакции: ${res.status}`);
    }
    
    return await res.json();
  } catch (error) {
    console.error('Error toggling reaction:', error);
    throw error;
  }
}

// Получить количество лайков
export async function fetchReaction(slug: string): Promise<{ post_slug: string; likes_count: number }> {
  try {
    const res = await fetch(`${API_BASE}/api/blog/reactions/detail/?post_slug=${slug}`);
    
    if (!res.ok) {
      // Если endpoint не существует, возвращаем 0 лайков
      if (res.status === 404) {
        return { post_slug: slug, likes_count: 0 };
      }
      throw new Error(`Ошибка загрузки лайков: ${res.status}`);
    }
    
    return await res.json();
  } catch (error) {
    console.error('Error fetching reaction:', error);
    // В случае ошибки возвращаем 0 лайков
    return { post_slug: slug, likes_count: 0 };
  }
}

// Получить комментарии для поста
export async function fetchComments(postId: number) {
  try {
    const res = await fetch(`${API_BASE}/api/blog/comments/?post=${postId}`);
    
    if (!res.ok) {
      throw new Error(`Ошибка загрузки комментариев: ${res.status}`);
    }
    
    return await res.json();
  } catch (error) {
    console.error('Error fetching comments:', error);
    return [];
  }
}