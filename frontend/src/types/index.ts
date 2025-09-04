export interface User {
  id: string;
  email: string;
  username: string;
  first_name: string;
  last_name: string;
  phone: string;
}

export interface UserProfile {
  user: User;
  subscription_active: boolean;
  subscription_expires: string | null;
  tables_limit: number;
}

export interface Category {
  id: string;
  name: string;
}

export interface ProgressTable {
  id: string;
  user: string;
  title: string;
  categories: Category[];
  progress_entries: DailyProgress[];
  created_at: string;
  updated_at: string;
}

export interface DailyProgress {
  date: string;
  data: Record<string, number>;
  created_at: string;
  updated_at: string;
}

export interface ChartData {
  date: string;
  [key: string]: number | string;
}

export interface RadarChartData {
  categories: Category[];
  progress_data: ChartData[];
}

export interface AuthContextType {
  user: User | null;
  profile: UserProfile | null;
  login: (email: string, password: string) => Promise<void>;
  register: (userData: {
    email: string;
    username: string;
    password: string;
    first_name?: string;
    last_name?: string;
    phone?: string;
  }) => Promise<void>;
  logout: () => void;
  loading: boolean;
  setUser: (user: User) => void;
  setProfile: (profile: UserProfile) => void;
}