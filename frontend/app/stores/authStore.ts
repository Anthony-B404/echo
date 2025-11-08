import { defineStore } from "pinia";
import { navigateTo } from "#app";
import { useApi } from "@/composables/useApi";
export const enum UserRole {
  OWNER = 1,
  MEMBER = 2,
}

export const useAuthStore = defineStore("auth", {
  state: () => ({
    isAuthenticated:
      localStorage.getItem("isAuthenticated") === "true" ||
      sessionStorage.getItem("isAuthenticated") === "true",
    role: parseInt(
      localStorage.getItem("role") || sessionStorage.getItem("role") || "",
    ),
    token:
      localStorage.getItem("token") || sessionStorage.getItem("token") || "",
    userName:
      localStorage.getItem("userName") ||
      sessionStorage.getItem("userName") ||
      "",
    isEmailVerified:
      localStorage.getItem("isEmailVerified") === "true" ||
      sessionStorage.getItem("isEmailVerified") === "true",
  }),
  actions: {
    login(
      role: UserRole,
      token: string,
      userName: string,
      rememberMe: boolean,
      isEmailVerified: boolean,
    ) {
      const storage = rememberMe ? localStorage : sessionStorage;

      storage.setItem("isAuthenticated", "true");
      storage.setItem("role", role.toString());
      storage.setItem("token", token);
      storage.setItem("userName", userName);
      storage.setItem("isEmailVerified", isEmailVerified.toString());

      this.isAuthenticated = true;
      this.role = role;
      this.token = token;
      this.userName = userName;
      this.isEmailVerified = isEmailVerified;
    },
    logout() {
      localStorage.removeItem("isAuthenticated");
      localStorage.removeItem("role");
      localStorage.removeItem("token");
      localStorage.removeItem("userName");
      localStorage.removeItem("isEmailVerified");
      sessionStorage.removeItem("isAuthenticated");
      sessionStorage.removeItem("role");
      sessionStorage.removeItem("token");
      sessionStorage.removeItem("userName");
      sessionStorage.removeItem("isEmailVerified");
      this.isAuthenticated = false;
      this.role = 0;
      this.token = "";
      this.userName = "";
      this.isEmailVerified = false;
    },
    setIsEmailVerified(isEmailVerified: boolean) {
      this.isEmailVerified = isEmailVerified;
      localStorage.setItem("isEmailVerified", isEmailVerified.toString());
      sessionStorage.setItem("isEmailVerified", isEmailVerified.toString());
    },

    checkTokenValidity() {
      const { get } = useApi();

      get("/check-token", true).catch(() => {
        this.logout();
        navigateTo("/login");
      });
    },
  },
});
