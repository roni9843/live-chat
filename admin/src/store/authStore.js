import { create } from 'zustand';
import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';

const useAuthStore = create((set) => ({
  user: JSON.parse(localStorage.getItem('superAdminUser')) || null,
  isLoading: false,
  error: null,

  login: async (email, password) => {
    set({ isLoading: true, error: null });
    try {
      const response = await axios.post(`${API_URL}/api/auth/merchant/login`, { email, password });
      
      if (response.data.role !== 'super_admin') {
        set({ error: 'Access denied. Super Admin only.', isLoading: false });
        return false;
      }
      
      localStorage.setItem('superAdminUser', JSON.stringify(response.data));
      set({ user: response.data, isLoading: false });
      return true;
    } catch (error) {
      set({ error: error.response?.data?.message || 'Login failed', isLoading: false });
      return false;
    }
  },

  logout: () => {
    localStorage.removeItem('superAdminUser');
    set({ user: null });
  },
}));

export default useAuthStore;
