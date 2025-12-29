// Click API JavaScript SDK

import axios, { AxiosInstance, AxiosRequestConfig } from 'axios';

export interface ClickClientConfig {
  apiKey: string;
  baseURL?: string;
  version?: 'v1' | 'v2';
  timeout?: number;
}

export interface Content {
  id: string;
  title: string;
  type: 'video' | 'article' | 'podcast' | 'transcript';
  status: string;
  createdAt: string;
}

export interface User {
  id: string;
  email: string;
  name: string;
  subscription: {
    status: string;
    plan: string;
  };
}

export class ClickClient {
  private client: AxiosInstance;
  private apiKey: string;
  private version: string;

  constructor(config: ClickClientConfig) {
    this.apiKey = config.apiKey;
    this.version = config.version || 'v1';
    
    this.client = axios.create({
      baseURL: config.baseURL || 'http://localhost:5001/api',
      timeout: config.timeout || 30000,
      headers: {
        'Authorization': `Bearer ${this.apiKey}`,
        'X-API-Version': this.version,
        'Content-Type': 'application/json',
      },
    });

    // Add request interceptor
    this.client.interceptors.request.use(
      (config) => {
        return config;
      },
      (error) => {
        return Promise.reject(error);
      }
    );

    // Add response interceptor
    this.client.interceptors.response.use(
      (response) => response.data,
      (error) => {
        if (error.response) {
          throw new Error(error.response.data.error || error.message);
        }
        throw error;
      }
    );
  }

  // Authentication
  async register(email: string, password: string, name: string) {
    return this.client.post(`/${this.version}/auth/register`, {
      email,
      password,
      name,
    });
  }

  async login(email: string, password: string) {
    const response = await this.client.post(`/${this.version}/auth/login`, {
      email,
      password,
    });
    // Update API key if new token is returned
    if (response.data?.token) {
      this.apiKey = response.data.token;
      this.client.defaults.headers['Authorization'] = `Bearer ${this.apiKey}`;
    }
    return response;
  }

  async getCurrentUser() {
    return this.client.get(`/${this.version}/auth/me`);
  }

  // Content
  async getContent(contentId?: string) {
    if (contentId) {
      return this.client.get(`/${this.version}/content/${contentId}`);
    }
    return this.client.get(`/${this.version}/content`);
  }

  async createContent(data: {
    title: string;
    type: string;
    description?: string;
    text?: string;
    platforms?: string[];
  }) {
    return this.client.post(`/${this.version}/content/generate`, data);
  }

  async updateContent(contentId: string, data: Partial<Content>) {
    return this.client.put(`/${this.version}/content/${contentId}`, data);
  }

  async deleteContent(contentId: string) {
    return this.client.delete(`/${this.version}/content/${contentId}`);
  }

  // Video
  async uploadVideo(file: File, options?: {
    title?: string;
    description?: string;
    musicId?: string;
  }) {
    const formData = new FormData();
    formData.append('video', file);
    if (options?.title) formData.append('title', options.title);
    if (options?.description) formData.append('description', options.description);
    if (options?.musicId) formData.append('musicId', options.musicId);

    return this.client.post(`/${this.version}/video/upload`, formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
  }

  async getVideo(videoId: string) {
    return this.client.get(`/${this.version}/video/${videoId}`);
  }

  // Analytics
  async getAnalytics(options?: {
    period?: number;
    type?: string;
  }) {
    return this.client.get(`/${this.version}/analytics/content`, {
      params: options,
    });
  }

  // Search
  async search(query: string, options?: {
    type?: string;
    limit?: number;
    offset?: number;
  }) {
    return this.client.get(`/${this.version}/search`, {
      params: { query, ...options },
    });
  }

  // Social Media
  async connectSocial(platform: string) {
    return this.client.post(`/${this.version}/social/connect`, { platform });
  }

  async postToSocial(contentId: string, platform: string, options?: any) {
    return this.client.post(`/${this.version}/social/post`, {
      contentId,
      platform,
      ...options,
    });
  }

  // Scheduler
  async schedulePost(data: {
    contentId: string;
    platform: string;
    scheduledTime: string;
    content?: any;
  }) {
    return this.client.post(`/${this.version}/scheduler`, data);
  }

  async getScheduledPosts(options?: {
    status?: string;
    platform?: string;
  }) {
    return this.client.get(`/${this.version}/scheduler`, {
      params: options,
    });
  }
}

// Export default instance creator
export function createClient(config: ClickClientConfig): ClickClient {
  return new ClickClient(config);
}

// Export default
export default ClickClient;






