import type { UserProfile, ProgressTable, DailyProgress, Category, RadarChartData } from '../types';

class ApiService {
  private baseUrl: string;

  constructor(baseUrl: string) {
    this.baseUrl = baseUrl;
  }

  private async request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
    const url = `${this.baseUrl}${endpoint}`;
    const token = localStorage.getItem('accessToken');

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };

    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    const config: RequestInit = {
      ...options,
      headers: { ...headers, ...options.headers } as HeadersInit,
    };

    const response = await fetch(url, config);

    if (!response.ok) {
      let errorMessage = 'Request failed';

      try {
        const errorData = await response.json();
        errorMessage = errorData.error || errorData.detail || errorMessage;
      } catch {
        errorMessage = (await response.text()) || errorMessage;
      }

      throw new Error(errorMessage);
    }

    try {
      return await response.json();
    } catch {
      return null as T;
    }
  }

  // Auth methods
  async login(email: string, password: string) {
    const data = await this.request<any>('/auth/login/', {
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
    const data = await this.request<any>('/auth/register/', {
      method: 'POST',
      body: JSON.stringify(userData),
    });

    if (data.access) {
      localStorage.setItem('accessToken', data.access);
      localStorage.setItem('refreshToken', data.refresh);
    }

    return data;
  }

  async getProfile(): Promise<UserProfile> {
    return this.request<UserProfile>('/auth/profile/');
  }

  // Tables methods
  async getTables(): Promise<ProgressTable[]> {
    try {
      const response = await this.request<any>('/tables/tables/');

      if (Array.isArray(response)) {
        return response;
      } else if (response && Array.isArray(response.results)) {
        return response.results;
      } else if (response && Array.isArray(response.data)) {
        return response.data;
      }

      console.warn('Unexpected API response format:', response);
      return [];
    } catch (error) {
      console.error('Failed to fetch tables:', error);
      return [];
    }
  }

  async getTable(id: string): Promise<ProgressTable | null> {
    try {
      return await this.request<ProgressTable>(`/tables/tables/${id}/`);
    } catch (error) {
      console.error('Failed to fetch table:', error);
      return null;
    }
  }

  async createTable(tableData: {
    title: string;
    categories?: Category[];
  }): Promise<ProgressTable | null> {
    try {
      return await this.request<ProgressTable>('/tables/tables/', {
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
      return await this.request<ProgressTable>(`/tables/tables/${id}/`, {
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
      await this.request(`/tables/tables/${id}/`, {
        method: 'DELETE',
      });
      return true;
    } catch (error) {
      console.error('Failed to delete table:', error);
      return false;
    }
  }

  async updateProgress(tableId: string, date: string, data: Record<string, number>): Promise<DailyProgress | null> {
    try {
      return await this.request<DailyProgress>(`/tables/tables/${tableId}/update_progress/`, {
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
      let url = `/tables/tables/${tableId}/progress_chart_data/`;
      const params = new URLSearchParams();

      if (startDate) params.append('start_date', startDate);
      if (endDate) params.append('end_date', endDate);

      if (params.toString()) {
        url += `?${params.toString()}`;
      }

      return await this.request<RadarChartData>(url);
    } catch (error) {
      console.error('Failed to fetch chart data:', error);
      return { categories: [], progress_data: [] };
    }
  }

  async addCategory(tableId: string, name: string): Promise<ProgressTable | null> {
    try {
      return await this.request<ProgressTable>(`/tables/tables/${tableId}/add_category/`, {
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
      return await this.request<ProgressTable>(`/tables/tables/${tableId}/remove_category/`, {
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
      return await this.request<ProgressTable>(`/tables/tables/${tableId}/rename_category/`, {
        method: 'POST',
        body: JSON.stringify({ category_id: categoryId, new_name: newName }),
      });
    } catch (error) {
      console.error('Failed to rename category:', error);
      return null;
    }
  }
}

const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL || 'https://self-development-tracker.onrender.com/api';

export const apiService = new ApiService(API_BASE_URL);
