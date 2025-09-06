// frontend/src/services/api.ts
import type {UserProfile, ProgressTable, DailyProgress, Category, RadarChartData } from '../types';

class ApiService {
  private baseUrl: string;

  constructor(baseUrl: string) {
    // нормализуем базовый URL сразу при создании
    this.baseUrl = (baseUrl || '').toString();
  }

  // Собирает URL из base + endpoint без двойных слэшей,
  // и поправляет случайные /api/api -> /api
  private buildUrl(endpoint: string) {
    const base = this.baseUrl.replace(/\s+$/, '');
    const ep = (endpoint || '').toString();

    // если базовый пустой, берем из env (без изменений если уже установлен)
    const rawBase =
      base ||
      (import.meta.env.VITE_API_BASE_URL ? String(import.meta.env.VITE_API_BASE_URL) : 'https://self-development-tracker.onrender.com');

    // Уберём пробелы
    const b = rawBase.replace(/\s+/g, '');

    // Собираем с одним слэшем между частями
    const joined = `${b.replace(/\/+$/, '')}/${ep.replace(/^\/+/, '')}`;

    // Уберём лишние двойные слэши после протокола (https://)
    const collapsed = joined.replace(/([^:]\/)\/+/g, '$1');

    // Если вдруг получилось /api/api, сводим к /api
    const fixedApiDup = collapsed.replace(/\/api\/api(\/|$)/g, '/api$1');

    return fixedApiDup;
  }

  private async request<T>(url: string, options: RequestInit = {}): Promise<T> {
  const response = await fetch(`${this.baseUrl}${url}`, {
    headers: {
      'Content-Type': 'application/json',
      Authorization: localStorage.getItem('accessToken')
        ? `Bearer ${localStorage.getItem('accessToken')}`
        : '',
    },
    ...options,
  });

  if (!response.ok) {
    let errorDetail: any;
    try {
      errorDetail = await response.json();
    } catch {
      errorDetail = await response.text();
    }
    console.error("API error:", errorDetail);
    throw new Error(
      typeof errorDetail === "string"
        ? errorDetail
        : JSON.stringify(errorDetail)
    );
  }

  return response.json();
}


  // Auth methods (endpoint строки — без опасений: buildUrl исправит лишние слэши)
  async login(email: string, password: string) {
  const data = await this.request<any>('/api/auth/login/', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  });

  if (data.access) {
    localStorage.setItem('accessToken', data.access);
    localStorage.setItem('refreshToken', data.refresh);
  }

  return data;
}


  async register(userData: {
    email: string;
    username: string;
    password: string;
    first_name?: string;
    last_name?: string;
    phone?: string;
  }) {
    const data = await this.request<any>('api/auth/register/', {
      method: 'POST',
      body: JSON.stringify(userData),
    });

    if (data?.access) {
      localStorage.setItem('accessToken', data.access);
      if (data.refresh) localStorage.setItem('refreshToken', data.refresh);
    }

    return data;
  }

  async getProfile(): Promise<UserProfile> {
    return this.request<UserProfile>('api/auth/profile/');
  }

  // Tables methods — оставлены с префиксом api/
  async getTables(): Promise<ProgressTable[]> {
    try {
      const response = await this.request<any>('api/tables/tables/');

      if (Array.isArray(response)) return response;
      if (response && Array.isArray(response.results)) return response.results;
      if (response && Array.isArray(response.data)) return response.data;

      console.warn('Unexpected API response format:', response);
      return [];
    } catch (error) {
      console.error('Failed to fetch tables:', error);
      return [];
    }
  }

  async getTable(id: string): Promise<ProgressTable | null> {
    try {
      return await this.request<ProgressTable>(`api/tables/tables/${id}/`);
    } catch (error) {
      console.error('Failed to fetch table:', error);
      return null;
    }
  }

  async createTable(tableData: { title: string; categories?: Category[]; }): Promise<ProgressTable | null> {
    try {
      return await this.request<ProgressTable>('api/tables/tables/', {
        method: 'POST',
        body: JSON.stringify(tableData),
      });
    } catch (error) {
      console.error('Failed to create table:', error);
      return null;
    }
  }

  async updateTable(id: string, tableData: Partial<ProgressTable>): Promise<ProgressTable | null> {
    try {
      return await this.request<ProgressTable>(`api/tables/tables/${id}/`, {
        method: 'PATCH',
        body: JSON.stringify(tableData),
      });
    } catch (error) {
      console.error('Failed to update table:', error);
      return null;
    }
  }

  async deleteTable(id: string): Promise<boolean> {
    try {
      await this.request(`api/tables/tables/${id}/`, { method: 'DELETE' });
      return true;
    } catch (error) {
      console.error('Failed to delete table:', error);
      return false;
    }
  }

  async updateProgress(tableId: string, date: string, data: Record<string, number>): Promise<DailyProgress | null> {
    try {
      return await this.request<DailyProgress>(`api/tables/tables/${tableId}/update_progress/`, {
        method: 'POST',
        body: JSON.stringify({ date, data }),
      });
    } catch (error) {
      console.error('Failed to update progress:', error);
      return null;
    }
  }

  async getChartData(tableId: string, startDate?: string, endDate?: string): Promise<RadarChartData> {
    try {
      let url = `api/tables/tables/${tableId}/progress_chart_data/`;
      const params = new URLSearchParams();
      if (startDate) params.append('start_date', startDate);
      if (endDate) params.append('end_date', endDate);
      if (params.toString()) url += `?${params.toString()}`;
      return await this.request<RadarChartData>(url);
    } catch (error) {
      console.error('Failed to fetch chart data:', error);
      return { categories: [], progress_data: [] };
    }
  }

  async addCategory(tableId: string, name: string): Promise<ProgressTable | null> {
    try {
      return await this.request<ProgressTable>(`api/tables/tables/${tableId}/add_category/`, {
        method: 'POST',
        body: JSON.stringify({ name }),
      });
    } catch (error) {
      console.error('Failed to add category:', error);
      return null;
    }
  }

  async removeCategory(tableId: string, categoryId: string): Promise<ProgressTable | null> {
    try {
      return await this.request<ProgressTable>(`api/tables/tables/${tableId}/remove_category/`, {
        method: 'POST',
        body: JSON.stringify({ category_id: categoryId }),
      });
    } catch (error) {
      console.error('Failed to remove category:', error);
      return null;
    }
  }

  async renameCategory(tableId: string, categoryId: string, newName: string): Promise<ProgressTable | null> {
    try {
      return await this.request<ProgressTable>(`api/tables/tables/${tableId}/rename_category/`, {
        method: 'POST',
        body: JSON.stringify({ category_id: categoryId, new_name: newName }),
      });
    } catch (error) {
      console.error('Failed to rename category:', error);
      return null;
    }
  }
}

// Создаём сервис: VITE_API_BASE_URL можно установить как:
// - https://self-development-tracker.onrender.com  OR
// - https://self-development-tracker.onrender.com/api
// buildUrl() будет корректировать двойные слэши.
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL?.toString() || 'https://self-development-tracker.onrender.com';

export const apiService = new ApiService(API_BASE_URL);
export default apiService;
