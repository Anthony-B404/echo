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
        const api = useApi();
        const response = await api<User>("/me", {
          headers: {
            Authorization: `Bearer ${this.token}`,
          },
        });

        this.setUser(response);

        // Charger l'organisation après avoir récupéré l'utilisateur
        const organizationStore = useOrganizationStore();
        await organizationStore.fetchOrganization();
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
        const api = useApi();
        await api("/check-token", {
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
          const api = useApi();
          await api("/logout", {
            method: "POST",
            headers: {
              Authorization: `Bearer ${this.token}`,
            },
          });
        } catch (error) {
          console.error("Logout failed:", error);
        }
      }

      // Clear auth state
      this.token = null;
      this.user = null;
      this.isAuthenticated = false;
      localStorage.removeItem(TOKEN_KEY);

      // Clear organization state
      const organizationStore = useOrganizationStore();
      organizationStore.clearOrganization();

      // Redirect to login
      const { $localePath } = useNuxtApp();
      await navigateTo($localePath("login"));
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
