// API Service Layer for Authentication
class AuthService {
  constructor() {
    this.baseURL = process.env.NODE_ENV === 'production'
      ? 'https://click-platform.onrender.com/api'
      : 'http://localhost:5001/api';
  }

  async request(endpoint, options = {}) {
    const url = `${this.baseURL}${endpoint}`;
    const config = {
      headers: {
        'Content-Type': 'application/json',
        ...options.headers
      },
      ...options
    };

    // Add auth token if available
    const token = localStorage.getItem('accessToken');
    if (token && !config.headers.Authorization) {
      config.headers.Authorization = `Bearer ${token}`;
    }

    try {
      const response = await fetch(url, config);
      const data = await response.json();

      // Handle token refresh on 401
      if (response.status === 401 && this.hasRefreshToken()) {
        const newTokens = await this.refreshToken();
        if (newTokens) {
          // Retry with new token
          config.headers.Authorization = `Bearer ${newTokens.accessToken}`;
          const retryResponse = await fetch(url, config);
          return await retryResponse.json();
        }
      }

      return data;
    } catch (error) {
      throw new Error(`API request failed: ${error.message}`);
    }
  }

  hasRefreshToken() {
    return !!localStorage.getItem('refreshToken');
  }

  async refreshToken() {
    try {
      const refreshToken = localStorage.getItem('refreshToken');
      const response = await fetch(`${this.baseURL}/auth/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshToken })
      });

      const data = await response.json();

      if (data.success) {
        localStorage.setItem('accessToken', data.data.accessToken);
        localStorage.setItem('refreshToken', data.data.refreshToken);
        return data.data;
      }
    } catch (error) {
      // Clear invalid tokens
      this.clearTokens();
    }
    return null;
  }

  clearTokens() {
    localStorage.removeItem('accessToken');
    localStorage.removeItem('refreshToken');
  }

  // Authentication methods
  async login(email, password) {
    return this.request('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password })
    });
  }

  async register(email, password, firstName, lastName) {
    return this.request('/auth/register', {
      method: 'POST',
      body: JSON.stringify({ email, password, firstName, lastName })
    });
  }

  async logout() {
    return this.request('/auth/logout', { method: 'POST' });
  }

  async getProfile() {
    return this.request('/auth/me');
  }

  async updateProfile(profileData) {
    return this.request('/auth/profile', {
      method: 'PUT',
      body: JSON.stringify(profileData)
    });
  }

  async changePassword(currentPassword, newPassword) {
    return this.request('/auth/change-password', {
      method: 'POST',
      body: JSON.stringify({ currentPassword, newPassword })
    });
  }

  // Two-Factor Authentication
  async setup2FA() {
    return this.request('/auth/2fa/setup', { method: 'POST' });
  }

  async enable2FA(token) {
    return this.request('/auth/2fa/enable', {
      method: 'POST',
      body: JSON.stringify({ token })
    });
  }

  async disable2FA() {
    return this.request('/auth/2fa/disable', { method: 'POST' });
  }

  async get2FAStatus() {
    return this.request('/auth/2fa/status');
  }

  async verify2FA(token, tempToken) {
    return this.request('/auth/2fa/verify', {
      method: 'POST',
      body: JSON.stringify({ token, tempToken })
    });
  }

  // Email Verification
  async verifyEmail(token) {
    return this.request('/auth/verify-email', {
      method: 'POST',
      body: JSON.stringify({ token })
    });
  }

  async resendVerification(email) {
    return this.request('/auth/resend-verification', {
      method: 'POST',
      body: JSON.stringify({ email })
    });
  }

  // Password Reset
  async forgotPassword(email) {
    return this.request('/auth/forgot-password', {
      method: 'POST',
      body: JSON.stringify({ email })
    });
  }

  async resetPassword(token, newPassword) {
    return this.request('/auth/reset-password', {
      method: 'POST',
      body: JSON.stringify({ token, newPassword })
    });
  }

  // Security
  async getSecurityEvents() {
    return this.request('/auth/security-events');
  }

  async getSecurityStatus() {
    return this.request('/auth/security-status');
  }

  async reportSuspiciousActivity(activity, details = '') {
    return this.request('/auth/report-suspicious', {
      method: 'POST',
      body: JSON.stringify({ activity, details })
    });
  }

  async checkPasswordStrength(password) {
    return this.request('/auth/check-password-strength', {
      method: 'POST',
      body: JSON.stringify({ password })
    });
  }

  // Account Management
  async deactivateAccount(password, reason = '') {
    return this.request('/auth/deactivate', {
      method: 'POST',
      body: JSON.stringify({ password, reason })
    });
  }

  async deleteAccount(password) {
    return this.request('/auth/delete', {
      method: 'POST',
      body: JSON.stringify({ password, confirmDelete: 'DELETE_MY_ACCOUNT' })
    });
  }

  async reactivateAccount(email, password) {
    return this.request('/auth/reactivate', {
      method: 'POST',
      body: JSON.stringify({ email, password })
    });
  }

  // OAuth
  async getGoogleAuthUrl() {
    const result = await this.request('/oauth/google/authorize', { method: 'GET' });
    return result;
  }

  async completeGoogleAuth(code, state) {
    return this.request('/oauth/google/complete', {
      method: 'POST',
      body: JSON.stringify({ code, state })
    });
  }

  async disconnectGoogle() {
    return this.request('/oauth/google/disconnect', { method: 'DELETE' });
  }

  async getGoogleStatus() {
    return this.request('/oauth/google/status');
  }

  async getLinkedInStatus() {
    return this.request('/oauth/linkedin/status');
  }
}

// Export singleton instance
export default new AuthService();
