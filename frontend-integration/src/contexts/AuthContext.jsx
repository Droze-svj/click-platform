import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';

const AuthContext = createContext({});

export const useAuth = () => useContext(AuthContext);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [accessToken, setAccessToken] = useState(null);
  const [refreshToken, setRefreshToken] = useState(null);

  // API Configuration
  const API_BASE = process.env.NODE_ENV === 'production'
    ? 'https://click-platform.onrender.com/api'
    : 'http://localhost:5001/api';

  // API Helper
  const apiRequest = useCallback(async (endpoint, options = {}) => {
    const url = `${API_BASE}${endpoint}`;
    const config = {
      headers: {
        'Content-Type': 'application/json',
        ...options.headers
      },
      ...options
    };

    if (accessToken && !config.headers.Authorization) {
      config.headers.Authorization = `Bearer ${accessToken}`;
    }

    let response;
    try {
      response = await fetch(url, config);
    } catch (fetchError) {
      // Handle network errors (CORS, connection refused, etc.)
      console.warn('Network error in apiRequest:', fetchError);
      return {
        response: { status: 0, statusText: 'Network Error' },
        data: { success: false, error: 'Network connection failed', status: 0 }
      };
    }

    // Handle token refresh on 401
    if (response.status === 401 && refreshToken) {
      const newTokens = await refreshAccessToken();
      if (newTokens) {
        return apiRequest(endpoint, options); // Retry with new token
      }
    }

    // Try to parse JSON response, but handle errors gracefully
    let data = null;
    try {
      const responseText = await response.text();
      if (responseText) {
        data = JSON.parse(responseText);
      }
    } catch (parseError) {
      // If JSON parsing fails, create a basic error response
      data = {
        success: false,
        error: response.statusText || 'Request failed',
        status: response.status
      };
    }

    return { response, data };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [accessToken, refreshToken, API_BASE]);

  const loadUserProfile = useCallback(async (token = accessToken) => {
    const { data } = await apiRequest('/auth/me');
    if (data) {
      setUser(data.user);
    }
  }, [accessToken, apiRequest]);

  // Initialize auth state
  useEffect(() => {
    const initAuth = async () => {
      const token = localStorage.getItem('accessToken');
      const refresh = localStorage.getItem('refreshToken');

      if (token) {
        setAccessToken(token);
        setRefreshToken(refresh);
        await loadUserProfile(token);
      }
      setLoading(false);
    };

    initAuth();
  }, [loadUserProfile]);

  // Authentication Methods
  const login = async (email, password) => {
    console.log('Attempting login with:', { email, password });
    const { data } = await apiRequest('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password })
    });
    console.log('Login response:', data);

    if (data.success) {
      if (data.data.requiresTwoFactor) {
        return { requires2FA: true, tempToken: data.data.tempToken };
      } else {
        setTokens(data.data.token, data.data.refreshToken);
        await loadUserProfile(data.data.token);
        return { success: true };
      }
    }

    return { success: false, error: data.error };
  };

  const verify2FA = async (code, tempToken) => {
    const { data } = await apiRequest('/auth/2fa/verify', {
      method: 'POST',
      body: JSON.stringify({ token: code, tempToken })
    });

    if (data.success) {
      setTokens(data.data.token, data.data.refreshToken);
      await loadUserProfile(data.data.token);
      return { success: true };
    }

    return { success: false, error: data.error };
  };

  const register = async (email, password, firstName, lastName) => {
    const { data } = await apiRequest('/auth/register', {
      method: 'POST',
      body: JSON.stringify({ email, password, firstName, lastName })
    });

    return { success: data.success, message: data.message, error: data.error };
  };

  const logout = async () => {
    await apiRequest('/auth/logout', { method: 'POST' });
    clearTokens();
  };

  const refreshAccessToken = async () => {
    try {
      const { data } = await fetch(`${API_BASE}/auth/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshToken })
      });

      const result = await data.json();

      if (result.success) {
        setTokens(result.data.accessToken, result.data.refreshToken);
        return result.data;
      }
    } catch (error) {
      clearTokens();
    }
    return null;
  };

  const setTokens = (access, refresh) => {
    setAccessToken(access);
    setRefreshToken(refresh);
    localStorage.setItem('accessToken', access);
    localStorage.setItem('refreshToken', refresh);
  };

  const clearTokens = () => {
    setAccessToken(null);
    setRefreshToken(null);
    setUser(null);
    localStorage.removeItem('accessToken');
    localStorage.removeItem('refreshToken');
  };

  const value = {
    user,
    loading,
    login,
    verify2FA,
    register,
    logout,
    apiRequest,
    refreshAccessToken,
    loadUserProfile
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};
