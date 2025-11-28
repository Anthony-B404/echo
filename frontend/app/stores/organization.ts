import { defineStore } from "pinia";
import type { Organization, OrganizationState } from "~/types/organization";

export const useOrganizationStore = defineStore("organization", {
  state: (): OrganizationState => ({
    organization: null,
    loading: false,
    error: null,
  }),

  getters: {
    getOrganization: (state) => state.organization,
    isLoading: (state) => state.loading,
    hasError: (state) => !!state.error,
    getError: (state) => state.error,
    organizationName: (state) => state.organization?.name || "",
    organizationLogo: (state) => state.organization?.logo || null,
    organizationUsers: (state) => state.organization?.users || [],
    organizationInvitations: (state) => state.organization?.invitations || [],
  },

  actions: {
    /**
     * Set organization data
     */
    setOrganization(organization: Organization | null) {
      this.organization = organization;
    },

    /**
     * Set error state
     */
    setError(error: string | null) {
      this.error = error;
    },

    /**
     * Fetch organization data from API
     */
    async fetchOrganization() {
      this.loading = true;
      this.error = null;

      try {
        const { authenticatedFetch } = useAuth();
        const response = await authenticatedFetch<Organization>("/organization");
        this.setOrganization(response);
      } catch (error: any) {
        console.error("Failed to fetch organization:", error);
        this.setError(error?.message || "Failed to load organization");
        this.setOrganization(null);
      } finally {
        this.loading = false;
      }
    },

    /**
     * Clear organization data
     */
    clearOrganization() {
      this.organization = null;
      this.loading = false;
      this.error = null;
    },
  },
});
