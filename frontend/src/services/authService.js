import api from './api';

class AuthService {
  setAuthToken(token) {
    if (token) {
      api.defaults.headers.common['Authorization'] = `Bearer ${token}`;
    } else {
      delete api.defaults.headers.common['Authorization'];
    }
  }

  async login(email, password) {
    const response = await api.post('/auth/login', { email, password });
    return response.data;
  }

  async register(userData) {
    const response = await api.post('/auth/register', userData);
    return response.data;
  }

  async getProfile() {
    const response = await api.get('/users/profile');
    return response.data;
  }

  async updateProfile(updates) {
    const response = await api.put('/users/profile', updates);
    return response.data;
  }

  async changePassword(currentPassword, newPassword) {
    const response = await api.put('/users/password', {
      currentPassword,
      newPassword
    });
    return response.data;
  }

  async forgotPassword(email) {
    const response = await api.post('/auth/forgot-password', { email });
    return response.data;
  }
}

export const authService = new AuthService();
