import type {UserProfile, ProgressTable, DailyProgress, Category, RadarChartData } from '../types';

class ApiService {
  private baseUrl: string;

  constructor(baseUrl?: string) {
    this.baseUrl = baseUrl || "https://sdtracker.onrender.com";
  }

  async request<T>(url: string, options: RequestInit = {}): Promise<T> {
    const token = localStorage.getItem("accessToken");
    const headers: HeadersInit = {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    };

    const response = await fetch(`${this.baseUrl}${url}`, {
      headers,
      ...options,
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(error || `HTTP error! status: ${response.status}`);
    }

    return response.json();
  }

  async login(email: string, password: string) {
    return this.request<any>('/api/auth/login/', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });
  }

  async register(userData: {
    email: string;
    password: string;
    username?: string;
    first_name?: string;
    last_name?: string;
    phone?: string;
  }) {
    return this.request<any>('/api/auth/register/', {
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
    await this.request(`/api/tables/tables/${id}/`, { method: 'DELETE' });
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

export const apiService = new ApiService(import.meta.env.VITE_API_BASE_URL);
export default apiService;