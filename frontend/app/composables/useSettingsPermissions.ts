import { UserRole } from "~/types/auth";

/**
 * Composable for managing settings page permissions based on user role
 * in the current organization.
 */
export const useSettingsPermissions = () => {
  const organizationStore = useOrganizationStore();

  // Get the current user's role in the current organization
  const currentUserRole = computed(() => {
    return organizationStore.currentOrganization?.role ?? null;
  });

  // Role checks
  const isOwner = computed(() => currentUserRole.value === UserRole.Owner);
  const isAdministrator = computed(
    () => currentUserRole.value === UserRole.Administrator
  );
  const isMember = computed(() => currentUserRole.value === UserRole.Member);

  // Page access permissions
  const canAccessOrganization = computed(() => isOwner.value);
  const canManageMembers = computed(
    () => isOwner.value || isAdministrator.value
  );

  return {
    currentUserRole,
    isOwner,
    isAdministrator,
    isMember,
    canAccessOrganization,
    canManageMembers,
  };
};
