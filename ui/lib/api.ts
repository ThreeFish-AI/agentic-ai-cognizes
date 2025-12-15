import axios, { AxiosInstance, AxiosResponse } from 'axios';

// Types for API responses
export interface PaperUploadResponse {
  paper_id: string;
  filename: string;
  category: string;
  size: number;
  upload_time: string;
}

export interface PaperInfo {
  paper_id: string;
  title: string;
  authors: string[];
  year: number;
  venue: string;
  abstract: string;
  doi?: string;
  keywords?: string[];
  status: string;
  created_at: string;
  updated_at: string;
}

export interface PaperListResponse {
  papers: PaperInfo[];
  total: number;
  page: number;
  per_page: number;
  total_pages: number;
}

export interface TaskResponse {
  task_id: string;
  task_type: string;
  status: string;
  progress: number;
  message: string;
  created_at: string;
  updated_at: string;
  started_at?: string;
  completed_at?: string;
  error?: string;
  result?: any;
}

export interface TaskListResponse {
  tasks: TaskResponse[];
  total: number;
  page: number;
  per_page: number;
  total_pages: number;
}

// Create axios instance
const apiClient: AxiosInstance = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000',
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor
apiClient.interceptors.request.use(
  (config) => {
    // Add any auth headers here in the future
    // if (token) {
    //   config.headers.Authorization = `Bearer ${token}`;
    // }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response interceptor
apiClient.interceptors.response.use(
  (response: AxiosResponse) => {
    return response;
  },
  (error) => {
    // Handle common errors
    if (error.response?.status === 401) {
      // Handle unauthorized
      console.error('Unauthorized access');
    } else if (error.response?.status === 403) {
      // Handle forbidden
      console.error('Forbidden access');
    } else if (error.response?.status >= 500) {
      // Handle server errors
      console.error('Server error:', error.response.data);
    }

    return Promise.reject(error);
  }
);

// API methods
export const papersApi = {
  // Upload a paper
  upload: async (file: File, category?: string): Promise<PaperUploadResponse> => {
    const formData = new FormData();
    formData.append('file', file);
    if (category) {
      formData.append('category', category);
    }

    const response = await apiClient.post('/api/papers/upload', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
    return response.data;
  },

  // Get papers list
  list: async (params?: {
    page?: number;
    per_page?: number;
    category?: string;
    status?: string;
    search?: string;
  }): Promise<PaperListResponse> => {
    const response = await apiClient.get('/api/papers', { params });
    return response.data;
  },

  // Get paper details
  get: async (paperId: string): Promise<PaperInfo> => {
    const response = await apiClient.get(`/api/papers/${paperId}`);
    return response.data;
  },

  // Get paper content
  getContent: async (paperId: string, type: 'source' | 'translation' | 'heartfelt' = 'source'): Promise<any> => {
    const response = await apiClient.get(`/api/papers/${paperId}/content`, {
      params: { type },
    });
    return response.data;
  },

  // Process paper
  process: async (paperId: string, workflow: 'extract' | 'translate' | 'analyze'): Promise<TaskResponse> => {
    const response = await apiClient.post(`/api/papers/${paperId}/process`, {
      workflow,
    });
    return response.data;
  },

  // Delete paper
  delete: async (paperId: string): Promise<void> => {
    await apiClient.delete(`/api/papers/${paperId}`);
  },

  // Batch process
  batchProcess: async (paperIds: string[], workflow: 'extract' | 'translate' | 'analyze'): Promise<TaskResponse> => {
    const response = await apiClient.post('/api/papers/batch', {
      paper_ids: paperIds,
      workflow,
    });
    return response.data;
  },

  // Get report
  getReport: async (paperId: string): Promise<any> => {
    const response = await apiClient.get(`/api/papers/${paperId}/report`);
    return response.data;
  },

  // Translate paper
  translate: async (paperId: string): Promise<TaskResponse> => {
    const response = await apiClient.post(`/api/papers/${paperId}/translate`);
    return response.data;
  },

  // Analyze paper
  analyze: async (paperId: string): Promise<TaskResponse> => {
    const response = await apiClient.post(`/api/papers/${paperId}/analyze`);
    return response.data;
  },
};

export const tasksApi = {
  // Get tasks list
  list: async (params?: {
    page?: number;
    per_page?: number;
    status?: string;
    task_type?: string;
  }): Promise<TaskListResponse> => {
    const response = await apiClient.get('/api/tasks', { params });
    return response.data;
  },

  // Get task details
  get: async (taskId: string): Promise<TaskResponse> => {
    const response = await apiClient.get(`/api/tasks/${taskId}`);
    return response.data;
  },

  // Cancel task
  cancel: async (taskId: string): Promise<void> => {
    await apiClient.delete(`/api/tasks/${taskId}`);
  },

  // Get task logs
  getLogs: async (taskId: string): Promise<any> => {
    const response = await apiClient.get(`/api/tasks/${taskId}/logs`);
    return response.data;
  },

  // Clean up completed tasks
  cleanup: async (): Promise<void> => {
    await apiClient.delete('/api/tasks/cleanup');
  },
};

export const api = {
  // Health check
  health: async (): Promise<any> => {
    const response = await apiClient.get('/health');
    return response.data;
  },

  // Get API info
  info: async (): Promise<any> => {
    const response = await apiClient.get('/');
    return response.data;
  },
};

export default apiClient;