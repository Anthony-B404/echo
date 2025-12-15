<script setup lang="ts">
const { t } = useI18n();
const { authenticatedFetch, logout } = useAuth();
const toast = useToast();
const trialStore = useTrialStore();

const loading = ref(false);
const loadingSwitch = ref(false);
const accessibleOrgs = ref<Array<{ id: number; name: string; logo: string | null }>>([]);
const loadingOrgs = ref(true);

const isOwner = computed(() => trialStore.isOwnerOfCurrentOrganization);
const hasOtherAccessibleOrgs = computed(() => accessibleOrgs.value.length > 0);

// Fetch accessible organizations on mount
onMounted(async () => {
  try {
    const response = await authenticatedFetch<
      Array<{ id: number; name: string; logo: string | null }>
    >("/organizations/accessible");
    accessibleOrgs.value = response;
  } catch (error) {
    console.error("Failed to fetch accessible organizations:", error);
  } finally {
    loadingOrgs.value = false;
  }
});

const handleSwitchOrganization = async (orgId: number) => {
  try {
    loadingSwitch.value = true;
    await authenticatedFetch(`/organizations/${orgId}/switch`, {
      method: "POST",
    });
    // Reload page to refresh all state
    window.location.reload();
  } catch (error: unknown) {
    loadingSwitch.value = false;
    console.error("Failed to switch organization:", error);
    toast.add({
      title: t("common.messages.error"),
      color: "error",
      icon: "i-lucide-x",
    });
  }
};

const handleSubscribe = async () => {
  try {
    loading.value = true;
    const response = await authenticatedFetch<{ checkoutUrl: string }>(
      "/billing/checkout",
      { method: "POST" },
    );
    // Keep loading state until redirect completes
    window.location.href = response.checkoutUrl;
  } catch (error: unknown) {
    loading.value = false;
    console.error("Failed to create checkout:", error);
    toast.add({
      title: t("components.accessBlockedModal.error"),
      color: "error",
      icon: "i-lucide-x",
    });
  }
};

const handleCreateOrganization = () => {
  navigateTo("/create-organization");
};

const handleLogout = async () => {
  await logout();
};
</script>

<template>
  <UModal
    :open="true"
    :closable="false"
    prevent-close
    :ui="{ overlay: 'backdrop-blur-sm' }"
  >
    <template #content>
      <UCard>
        <div class="space-y-6 p-4 text-center">
          <UIcon
            name="i-lucide-lock"
            class="text-warning mx-auto h-16 w-16"
          />

          <div class="space-y-2">
            <h1 class="text-2xl font-bold">
              {{ t("components.accessBlockedModal.title") }}
            </h1>
            <p class="text-muted">
              {{
                isOwner
                  ? t("components.accessBlockedModal.description")
                  : t("components.accessBlockedModal.descriptionMember")
              }}
            </p>
          </div>

          <div class="space-y-3">
            <!-- Switch to accessible organization -->
            <div v-if="!loadingOrgs && hasOtherAccessibleOrgs" class="space-y-2">
              <p class="text-muted text-sm">
                {{ t("components.accessBlockedModal.switchToAccessible") }}
              </p>
              <UButton
                v-for="org in accessibleOrgs"
                :key="org.id"
                :label="org.name"
                :loading="loadingSwitch"
                icon="i-lucide-building-2"
                color="primary"
                variant="soft"
                block
                @click="handleSwitchOrganization(org.id)"
              />
              <USeparator :label="t('common.or')" />
            </div>

            <!-- Loading orgs indicator -->
            <div v-if="loadingOrgs" class="flex justify-center py-2">
              <UIcon name="i-lucide-loader-2" class="text-muted h-5 w-5 animate-spin" />
            </div>

            <!-- Owner: Subscribe button -->
            <UButton
              v-if="isOwner"
              :label="t('components.accessBlockedModal.subscribe')"
              :loading="loading"
              icon="i-lucide-credit-card"
              color="primary"
              size="lg"
              block
              @click="handleSubscribe"
            />

            <!-- Member: Create organization button -->
            <UButton
              v-else
              :label="t('components.accessBlockedModal.createOrganization')"
              icon="i-lucide-building"
              color="primary"
              size="lg"
              block
              @click="handleCreateOrganization"
            />

            <UButton
              :label="t('components.accessBlockedModal.logout')"
              icon="i-lucide-log-out"
              color="neutral"
              variant="ghost"
              size="lg"
              block
              @click="handleLogout"
            />
          </div>
        </div>
      </UCard>
    </template>
  </UModal>
</template>
