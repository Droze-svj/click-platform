/**
 * Authentication Service for Mobile App
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { apiClient } from './api';

class AuthService {
  async login(email: string, password: string): Promise<any> {
    const response = await apiClient.post('/auth/login', { email, password });
    if (response.token) {
      await AsyncStorage.setItem('authToken', response.token);
      await AsyncStorage.setItem('user', JSON.stringify(response.user));
    }
    return response;
  }

  async logout(): Promise<void> {
    await AsyncStorage.removeItem('authToken');
    await AsyncStorage.removeItem('user');
  }

  async getCurrentUser(): Promise<any> {
    try {
      const userStr = await AsyncStorage.getItem('user');
      if (userStr) {
        return JSON.parse(userStr);
      }
      // Fetch from API if not in storage
      return await apiClient.get('/auth/me');
    } catch (error) {
      console.error('Error getting current user:', error);
      return null;
    }
  }

  async isAuthenticated(): Promise<boolean> {
    const token = await AsyncStorage.getItem('authToken');
    return !!token;
  }
}

export const authService = new AuthService();
