import type {
  UserProfile,
  ProgressTable,
  DailyProgress,
  Category,
  RadarChartData
} from '../types';

const WP_API_BASE = 'https://public-api.wordpress.com/wp/v2/sites/sdtracker.wordpress.com';

export type PostSummary = {
  id: number;
  title: string;
  excerpt: string;
  date: string;
  slug: string;
  featured_image_url?: string | null;
};

export type PostFull = {
  id: number;
  title: string;
  content: string;
  date: string;
  slug: string;
  featured_image_url?: string | null;
};

const WP_BASE = (import.meta.env.VITE_WP_BASE as string) || 'https://sdblog.infinityfreeapp.com';

export async function fetchPosts(page = 1, perPage = 10): Promise<PostSummary[]> {
  // Убедись, что URL корректный, не через фронтенд домен
  const url = `${WP_BASE}/wp-json/wp/v2/posts?per_page=${perPage}&page=${page}&_embed`;
  const res = await fetch(url, {
    method: 'GET',
    headers: {
      'Accept': 'application/json'
    }
  });
  if (!res.ok) {
    throw new Error(`WordPress API error: ${res.status}`);
  }
  const text = await res.text();
  // Проверка, что ответ — JSON
  let data: any;
  try {
    data = JSON.parse(text);
  } catch (err) {
    throw new Error(`Invalid JSON received: ${text}`);
  }
  return (data as any[]).map(p => ({
    id: p.id,
    title: p.title.rendered,
    excerpt: p.excerpt.rendered,
    date: p.date,
    slug: p.slug,
    featured_image_url: p._embedded?.['wp:featuredmedia']?.[0]?.source_url ?? null
  }));
}

export async function fetchPostBySlug(slug: string): Promise<PostFull> {
  const url = `${WP_BASE}/wp-json/wp/v2/posts?slug=${encodeURIComponent(slug)}&_embed`;
  const res = await fetch(url, { method: 'GET' });
  if (!res.ok) {
    throw new Error(`WordPress API error: ${res.status}`);
  }
  const arr = await res.json() as any[];
  if (!arr.length) throw new Error('Post not found');
  const p = arr[0];
  return {
    id: p.id,
    title: p.title.rendered,
    content: p.content.rendered,
    date: p.date,
    slug: p.slug,
    featured_image_url: p._embedded?.['wp:featuredmedia']?.[0]?.source_url ?? null
  };
}

class ApiService {
  private baseUrl: string;

  constructor() {
    // Всегда используем VITE_API_BASE_URL из окружения
    this.baseUrl = import.meta.env.VITE_API_BASE_URL as string;
    
    // Fallback только для разработки
    if (!this.baseUrl && window.location.hostname === 'localhost') {
      this.baseUrl = 'http://localhost:8000';
    }
    
    // Final fallback
    if (!this.baseUrl) {
      this.baseUrl = 'https://sdracker.onrender.com';
    }
  }

  async request<T>(url: string, options: RequestInit = {}): Promise<T> {
    const token = localStorage.getItem("accessToken");
    const headers: HeadersInit = {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    };

    const credentials = this.baseUrl !== window.location.origin ? 'include' : 'same-origin';

    try {
      const response = await fetch(`${this.baseUrl}${url}`, {
        headers,
        ...options,
        mode: 'cors',
        credentials,
      });

      if (response.status === 401) {
        localStorage.removeItem('accessToken');
        localStorage.removeItem('refreshToken');
        window.location.href = '/login';
        throw new Error('Authentication required');
      }

      if (!response.ok) {
        const errorText = await response.text();
        let errorData;
        try {
          errorData = JSON.parse(errorText);
        } catch {
          errorData = { error: errorText || `HTTP error! status: ${response.status}` };
        }
        throw new Error(errorData.error || errorData.message || `HTTP error! status: ${response.status}`);
      }

      if (response.status === 204) {
        return {} as T;
      }

      return response.json();
    } catch (error) {
      if (error instanceof TypeError && error.message === 'Failed to fetch') {
        throw new Error('Network error: Unable to connect to server. Please check your internet connection and try again.');
      }
      throw error;
    }
  }

  

  // ===== твои существующие методы =====

  async login(email: string, password: string) {
    const response = await this.request<any>('/api/auth/login/', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });

    if (response.tokens?.access) {
      localStorage.setItem('accessToken', response.tokens.access);
      localStorage.setItem('refreshToken', response.tokens.refresh);
    }

    return response;
  }

  async register(userData: {
    email: string;
    password: string;
    username?: string;
    first_name?: string;
    last_name?: string;
    phone?: string;
  }) {
    const response = await this.request<any>('/api/auth/register/', {
      method: 'POST',
      body: JSON.stringify({
        email: userData.email,
        password: userData.password,
        username: userData.username || userData.email.split('@')[0],
        first_name: userData.first_name,
        last_name: userData.last_name,
        phone: userData.phone
      }),
    });

    if (response.tokens?.access) {
      localStorage.setItem('accessToken', response.tokens.access);
      localStorage.setItem('refreshToken', response.tokens.refresh);
    }

    return response;
  }

  async getProfile(): Promise<UserProfile> {
    return this.request<UserProfile>('/api/auth/profile/');
  }

  async getTables(): Promise<ProgressTable[]> {
    return this.request<ProgressTable[]>('/api/tables/tables/');
  }

  async getTable(id: string): Promise<ProgressTable> {
    return this.request<ProgressTable>(`/api/tables/tables/${id}/`);
  }

  async createTable(tableData: { title: string; categories?: Category[]; }): Promise<ProgressTable> {
    return this.request<ProgressTable>('/api/tables/tables/', {
      method: 'POST',
      body: JSON.stringify(tableData),
    });
  }

  async updateTable(id: string, tableData: Partial<ProgressTable>): Promise<ProgressTable> {
    return this.request<ProgressTable>(`/api/tables/tables/${id}/`, {
      method: 'PATCH',
      body: JSON.stringify(tableData),
    });
  }

  async deleteTable(id: string): Promise<void> {
    await this.request<void>(`/api/tables/tables/${id}/`, { method: 'DELETE' });
  }

  async updateProgress(tableId: string, date: string, data: Record<string, number>): Promise<DailyProgress> {
    return this.request<DailyProgress>(`/api/tables/tables/${tableId}/update_progress/`, {
      method: 'POST',
      body: JSON.stringify({ date, data }),
    });
  }

  async getChartData(tableId: string, startDate?: string, endDate?: string): Promise<RadarChartData> {
    let url = `/api/tables/tables/${tableId}/progress_chart_data/`;
    const params = new URLSearchParams();
    if (startDate) params.append('start_date', startDate);
    if (endDate) params.append('end_date', endDate);
    if (params.toString()) url += `?${params.toString()}`;
    return this.request<RadarChartData>(url);
  }

  async addCategory(tableId: string, name: string): Promise<ProgressTable> {
    return this.request<ProgressTable>(`/api/tables/tables/${tableId}/add_category/`, {
      method: 'POST',
      body: JSON.stringify({ name }),
    });
  }

  async removeCategory(tableId: string, categoryId: string): Promise<ProgressTable> {
    return this.request<ProgressTable>(`/api/tables/tables/${tableId}/remove_category/`, {
      method: 'POST',
      body: JSON.stringify({ category_id: categoryId }),
    });
  }

  async renameCategory(tableId: string, categoryId: string, newName: string): Promise<ProgressTable> {
    return this.request<ProgressTable>(`/api/tables/tables/${tableId}/rename_category/`, {
      method: 'POST',
      body: JSON.stringify({ category_id: categoryId, new_name: newName }),
    });
  }
}

export const apiService = new ApiService();
export default apiService;
