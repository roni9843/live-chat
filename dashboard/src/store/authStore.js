import { create } from 'zustand';
import axios from 'axios';

const API_URL = `${import.meta.env.VITE_API_URL || 'https://jh5nng6t-5000.asse.devtunnels.ms'}/api/auth/merchant`;

const useAuthStore = create((set) => ({
  user: JSON.parse(localStorage.getItem('merchantUser')) || null,
  isLoading: false,
  error: null,

  login: async (email, password) => {
    set({ isLoading: true, error: null });
    try {
      const response = await axios.post(`${API_URL}/login`, { email, password });
      localStorage.setItem('merchantUser', JSON.stringify(response.data));
      set({ user: response.data, isLoading: false });
      return true;
    } catch (error) {
      set({ error: error.response?.data?.message || 'Login failed', isLoading: false });
      return false;
    }
  },

  register: async (name, email, password) => {
    set({ isLoading: true, error: null });
    try {
      const response = await axios.post(`${API_URL}/register`, { name, email, password });
      localStorage.setItem('merchantUser', JSON.stringify(response.data));
      set({ user: response.data, isLoading: false });
      return true;
    } catch (error) {
      set({ error: error.response?.data?.message || 'Registration failed', isLoading: false });
      return false;
    }
  },

  logout: () => {
    localStorage.removeItem('merchantUser');
    set({ user: null });
  },

  fetchProfile: async () => {
    const { user } = useAuthStore.getState();
    if (!user || !user.token) return;

    try {
      const config = { headers: { Authorization: `Bearer ${user.token}` } };
      const response = await axios.get(`${API_URL}/profile`, config);
      const updatedUser = { ...user, ...response.data };
      localStorage.setItem('merchantUser', JSON.stringify(updatedUser));
      set({ user: updatedUser });
    } catch (error) {
      console.error('Error fetching profile:', error);
    }
  }
}));

export default useAuthStore;
