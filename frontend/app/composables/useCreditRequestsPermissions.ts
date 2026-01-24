/**
 * Composable for managing credit request permissions based on user role
 * and credit mode in the current organization.
 */
export const useCreditRequestsPermissions = () => {
  const { isOwner } = useSettingsPermissions()
  const creditsStore = useCreditsStore()

  // Can request credits (member in individual mode, not owner)
  const canRequestCredits = computed(
    () => !isOwner.value && creditsStore.isIndividualMode,
  )

  // Can request credits from reseller (owner only)
  const canRequestFromReseller = computed(() => isOwner.value)

  // Can view and process pending requests (owner only)
  const canProcessRequests = computed(() => isOwner.value)

  // Show pending badge notification
  const showPendingBadge = computed(() => {
    const creditRequestsStore = useCreditRequestsStore()
    return isOwner.value && creditRequestsStore.hasPendingRequests
  })

  return {
    canRequestCredits,
    canRequestFromReseller,
    canProcessRequests,
    showPendingBadge,
  }
}
