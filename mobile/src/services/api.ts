// API Service for Mobile App

import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';

const API_URL = process.env.API_URL || 'http://localhost:5001/api';

const api = axios.create({
  baseURL: API_URL,
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor to add auth token
api.interceptors.request.use(
  async (config) => {
    const token = await AsyncStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response interceptor for error handling
api.interceptors.response.use(
  (response) => response.data,
  async (error) => {
    if (error.response?.status === 401) {
      // Token expired, clear storage and redirect to login
      await AsyncStorage.removeItem('token');
      await AsyncStorage.removeItem('user');
    }
    return Promise.reject(error);
  }
);

// Auth endpoints
export const authAPI = {
  login: (email: string, password: string) =>
    api.post('/v1/auth/login', { email, password }),
  register: (email: string, password: string, name: string) =>
    api.post('/v1/auth/register', { email, password, name }),
  getCurrentUser: () => api.get('/v1/auth/me'),
};

// Content endpoints
export const contentAPI = {
  getContent: (contentId?: string) =>
    contentId ? api.get(`/v1/content/${contentId}`) : api.get('/v1/content'),
  createContent: (data: any) => api.post('/v1/content/generate', data),
  updateContent: (contentId: string, data: any) =>
    api.put(`/v1/content/${contentId}`, data),
  deleteContent: (contentId: string) =>
    api.delete(`/v1/content/${contentId}`),
};

// Video endpoints
export const videoAPI = {
  uploadVideo: (formData: FormData) =>
    api.post('/v1/video/upload', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    }),
  getVideo: (videoId: string) => api.get(`/v1/video/${videoId}`),
};

// Analytics endpoints
export const analyticsAPI = {
  getAnalytics: (period?: number) =>
    api.get('/v1/analytics/content', { params: { period } }),
};

// Social media endpoints
export const socialAPI = {
  connectSocial: (platform: string) =>
    api.post('/v1/social/connect', { platform }),
  postToSocial: (contentId: string, platform: string) =>
    api.post('/v1/social/post', { contentId, platform }),
};

export default api;






