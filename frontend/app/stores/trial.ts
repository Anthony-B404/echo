import { defineStore } from "pinia";
import { useAuthStore } from "~/stores/auth";

interface TrialState {
  isOnTrial: boolean;
  trialStartedAt: string | null;
  trialEndsAt: string | null;
  trialDaysRemaining: number;
  trialExpired: boolean;
  trialUsed: boolean;
  hasAccess: boolean;
  loaded: boolean;
  isOwnerOfCurrentOrganization: boolean;
}

export const useTrialStore = defineStore("trial", {
  state: (): TrialState => ({
    isOnTrial: false,
    trialStartedAt: null,
    trialEndsAt: null,
    trialDaysRemaining: 0,
    trialExpired: false,
    trialUsed: false,
    hasAccess: true,
    loaded: false,
    isOwnerOfCurrentOrganization: true, // Default to true to avoid flash of wrong UI
  }),

  getters: {
    getTrialDaysRemaining: (state) => state.trialDaysRemaining,
    getIsOnTrial: (state) => state.isOnTrial,
    getTrialExpired: (state) => state.trialExpired,
    getHasAccess: (state) => state.hasAccess,
    isLoaded: (state) => state.loaded,
  },

  actions: {
    /**
     * Set trial info from API response
     */
    setTrialInfo(info: Partial<TrialState>) {
      Object.assign(this, info);
      this.loaded = true;
    },

    /**
     * Fetch trial status from billing/status endpoint
     */
    async fetchTrialStatus() {
      const authStore = useAuthStore();
      const api = useApi();

      if (!authStore.token) {
        return;
      }

      try {
        const response = await api<{
          trial: {
            isOnTrial: boolean;
            trialStartedAt: string | null;
            trialEndsAt: string | null;
            trialDaysRemaining: number;
            trialExpired: boolean;
            trialUsed: boolean;
          };
          hasAccess: boolean;
          isOwnerOfCurrentOrganization: boolean;
        }>("/billing/status", {
          headers: {
            Authorization: `Bearer ${authStore.token}`,
          },
        });

        this.setTrialInfo({
          isOnTrial: response.trial.isOnTrial,
          trialStartedAt: response.trial.trialStartedAt,
          trialEndsAt: response.trial.trialEndsAt,
          trialDaysRemaining: response.trial.trialDaysRemaining,
          trialExpired: response.trial.trialExpired,
          trialUsed: response.trial.trialUsed,
          hasAccess: response.hasAccess,
          isOwnerOfCurrentOrganization: response.isOwnerOfCurrentOrganization,
        });
      } catch (error: unknown) {
        // Handle 402 Payment Required (subscription ended)
        const err = error as {
          status?: number;
          data?: { code?: string; isOwner?: boolean };
        };
        if (err.status === 402 && err.data?.code === "SUBSCRIPTION_ENDED") {
          this.setTrialInfo({
            isOnTrial: false,
            trialExpired: true,
            hasAccess: false,
            isOwnerOfCurrentOrganization: err.data?.isOwner ?? true,
          });
        }
        console.error("Failed to fetch trial status:", error);
      }
    },

    /**
     * Clear trial state
     */
    clearTrial() {
      this.$reset();
    },
  },
});
