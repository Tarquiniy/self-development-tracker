import type { User, UserProfile, ProgressTable, DailyProgress, Category, ChartData } from '../types';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000/api';  

class ApiService {
  private async request(endpoint: string, options: RequestInit = {}) {
    const url = `${API_BASE_URL}${endpoint}`;
    const token = localStorage.getItem('accessToken');
    
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }
    
    // Добавляем переданные заголовки
    if (options.headers) {
      Object.assign(headers, options.headers);
    }
    
    const response = await fetch(url, {
      ...options,
      headers,
    });
    
    if (!response.ok) {
      const error = await response.text();
      throw new Error(error || 'Request failed');
    }
    
    return response.json();
  }
  
  
  // Auth methods
  async login(email: string, password: string) {
    const data = await this.request('/auth/login/', {
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
    const data = await this.request('/auth/register/', {
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
    return this.request('/auth/profile/');
  }
  
  // Tables methods
  async getTables(): Promise<ProgressTable[]> {
    return this.request('/tables/');
  }
  
  async getTable(id: string): Promise<ProgressTable> {
    return this.request(`/tables/${id}/`);
  }
  
  async createTable(tableData: {
    title: string;
    categories: Category[];
  }): Promise<ProgressTable> {
    return this.request('/tables/', {
      method: 'POST',
      body: JSON.stringify(tableData),
    });
  }
  
  async updateTable(id: string, tableData: Partial<ProgressTable>): Promise<ProgressTable> {
    return this.request(`/tables/${id}/`, {
      method: 'PATCH',
      body: JSON.stringify(tableData),
    });
  }
  
  async deleteTable(id: string): Promise<void> {
    await this.request(`/tables/${id}/`, {
      method: 'DELETE',
    });
  }
  
  async updateProgress(tableId: string, date: string, data: Record<string, number>): Promise<DailyProgress> {
    return this.request(`/tables/${tableId}/update_progress/`, {
      method: 'POST',
      body: JSON.stringify({ date, data }),
    });
  }
  
  async getChartData(tableId: string, startDate?: string, endDate?: string): Promise<{
    categories: Category[];
    progress_data: ChartData[];
  }> {
    let url = `/tables/${tableId}/progress_chart_data/`;
    const params = new URLSearchParams();
    
    if (startDate) params.append('start_date', startDate);
    if (endDate) params.append('end_date', endDate);
    
    if (params.toString()) {
      url += `?${params.toString()}`;
    }
    
    return this.request(url);
  }
}

export const apiService = new ApiService();