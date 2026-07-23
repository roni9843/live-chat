import { create } from "zustand";
import axios from "axios";

const API_URL =
  import.meta.env.VITE_API_URL ||
  "http://localhost:5000";

const useAdminAuthStore = create((set, get) => ({
  admin: JSON.parse(localStorage.getItem("ochatAdmin") || localStorage.getItem("superAdminUser")) || null,
  loading: false,
  error: "",

  login: async (email, password) => {
    set({ loading: true, error: "" });

    try {
      const { data } = await axios.post(
        `${API_URL}/api/auth/admin/login`,
        { email, password }
      );

      localStorage.setItem("ochatAdmin", JSON.stringify(data));
      set({ admin: data, loading: false });
      return true;
    } catch (error) {
      set({
        loading: false,
        error:
          error.response?.data?.message ||
          "Admin login failed",
      });
      return false;
    }
  },

  logout: () => {
    localStorage.removeItem("ochatAdmin");
    set({ admin: null });
  },

  authConfig: () => ({
    headers: {
      Authorization: `Bearer ${get().admin?.token || ""}`,
    },
  }),
}));

export default useAdminAuthStore;
