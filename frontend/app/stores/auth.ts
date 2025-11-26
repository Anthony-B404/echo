import { defineStore } from "pinia";
import type { User, AuthState } from "~/types/auth";

const TOKEN_KEY = "auth_token";

export const useAuthStore = defineStore("auth", {
  state: (): AuthState => ({
    token: null,
    user: null,
    isAuthenticated: false,
    loading: false,
  }),

  getters: {
    getUser: (state) => state.user,
    getToken: (state) => state.token,
    isLoggedIn: (state) => state.isAuthenticated,
    isLoading: (state) => state.loading,
  },

  actions: {
    /**
     * Set authentication token and persist to localStorage
     */
    setToken(token: string | null) {
      this.token = token;
      this.isAuthenticated = !!token;

      if (token) {
        localStorage.setItem(TOKEN_KEY, token);
      } else {
        localStorage.removeItem(TOKEN_KEY);
      }
    },

    /**
     * Set user data
     */
    setUser(user: User | null) {
      this.user = user;
    },

    /**
     * Restore token from localStorage
     */
    restoreToken() {
      const token = localStorage.getItem(TOKEN_KEY);
      if (token) {
        this.token = token;
        this.isAuthenticated = true;
      }
    },

    /**
     * Fetch current user data from API
     */
    async fetchUser() {
      if (!this.token) {
        return;
      }

      this.loading = true;

      try {
        const config = useRuntimeConfig();
        const response = await $fetch<User>(`${config.public.apiUrl}/me`, {
          headers: {
            Authorization: `Bearer ${this.token}`,
          },
        });

        this.setUser(response);
      } catch (error) {
        console.error("Failed to fetch user:", error);
        // Token might be invalid, clear auth state
        this.logout();
      } finally {
        this.loading = false;
      }
    },

    /**
     * Check if token is valid
     */
    async checkAuth() {
      if (!this.token) {
        return false;
      }

      try {
        const config = useRuntimeConfig();
        await $fetch(`${config.public.apiUrl}/check-token`, {
          headers: {
            Authorization: `Bearer ${this.token}`,
          },
        });
        return true;
      } catch (error) {
        console.error("Token validation failed:", error);
        this.logout();
        return false;
      }
    },

    /**
     * Login with token (after magic link or OAuth)
     */
    async login(token: string) {
      this.setToken(token);
      await this.fetchUser();
    },

    /**
     * Logout user
     */
    async logout() {
      if (this.token) {
        try {
          const config = useRuntimeConfig();
          await $fetch(`${config.public.apiUrl}/logout`, {
            method: "POST",
            headers: {
              Authorization: `Bearer ${this.token}`,
            },
          });
        } catch (error) {
          console.error("Logout failed:", error);
        }
      }

      // Clear state
      this.token = null;
      this.user = null;
      this.isAuthenticated = false;
      localStorage.removeItem(TOKEN_KEY);

      // Redirect to login
      await navigateTo("/login");
    },

    /**
     * Initialize auth state
     */
    async init() {
      this.restoreToken();

      if (this.token) {
        const isValid = await this.checkAuth();
        if (isValid) {
          await this.fetchUser();
        }
      }
    },
  },
});
