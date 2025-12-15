<script setup lang="ts">
definePageMeta({
  middleware: "auth",
});

const { t } = useI18n();
const { authenticatedFetch } = useAuth();
const route = useRoute();
const router = useRouter();
const toast = useToast();

// State
const loading = ref(true);
const checkoutLoading = ref(false);
const reactivateLoading = ref(false);
const cancelModalOpen = ref(false);
const subscriptionStatus = ref<{
  hasSubscription: boolean;
  subscription: {
    status: string;
    currentPeriodEnd: string | null;
    isActive: boolean;
    cardBrand: string | null;
    cardLastFour: string | null;
    updatePaymentMethodUrl: string | null;
  } | null;
  trial: {
    isOnTrial: boolean;
    trialStartedAt: string | null;
    trialEndsAt: string | null;
    trialDaysRemaining: number;
    trialExpired: boolean;
    trialUsed: boolean;
  };
  hasAccess: boolean;
} | null>(null);

// Check for success redirect from Lemon Squeezy
const isSuccess = computed(() => route.query.success === "true");

// Check if subscription is cancelled
const isCancelled = computed(() => {
  return subscriptionStatus.value?.subscription?.status === "cancelled";
});

// Fetch subscription status
const fetchSubscriptionStatus = async () => {
  try {
    loading.value = true;
    subscriptionStatus.value =
      await authenticatedFetch<typeof subscriptionStatus.value>(
        "/billing/status",
      );
  } catch (error) {
    console.error("Failed to fetch subscription status:", error);
    toast.add({
      title: t("pages.dashboard.settings.billing.error.fetchFailed"),
      color: "error",
      icon: "i-lucide-x",
    });
  } finally {
    loading.value = false;
  }
};

// Create checkout session
const handleSubscribe = async () => {
  try {
    checkoutLoading.value = true;
    const response = await authenticatedFetch<{ checkoutUrl: string }>(
      "/billing/checkout",
      { method: "POST" },
    );

    // Redirect to Lemon Squeezy checkout
    window.location.href = response.checkoutUrl;
  } catch (error: any) {
    console.error("Failed to create checkout:", error);
    toast.add({
      title: t("pages.dashboard.settings.billing.error.checkoutFailed"),
      description: error.data?.message,
      color: "error",
      icon: "i-lucide-x",
    });
  } finally {
    checkoutLoading.value = false;
  }
};

// Update payment method
const handleUpdatePaymentMethod = () => {
  const url = subscriptionStatus.value?.subscription?.updatePaymentMethodUrl;
  if (url) {
    window.open(url, "_blank");
  }
};

// Reactivate subscription
const handleReactivate = async () => {
  try {
    reactivateLoading.value = true;
    await authenticatedFetch("/billing/reactivate", {
      method: "POST",
    });

    toast.add({
      title: t("pages.dashboard.settings.billing.reactivate.success"),
      color: "success",
      icon: "i-lucide-check",
    });

    await fetchSubscriptionStatus();
  } catch (error: any) {
    console.error("Failed to reactivate:", error);
    toast.add({
      title: t("pages.dashboard.settings.billing.reactivate.error"),
      description: error.data?.message,
      color: "error",
      icon: "i-lucide-x",
    });
  } finally {
    reactivateLoading.value = false;
  }
};

// Handle cancel modal
const openCancelModal = () => {
  cancelModalOpen.value = true;
};

const handleCancelled = async () => {
  await fetchSubscriptionStatus();
};

// Format date helper
const formatDate = (dateString: string | null) => {
  if (!dateString) return "-";
  return new Date(dateString).toLocaleDateString();
};

// Status badge color
const getStatusColor = (status: string) => {
  switch (status) {
    case "active":
    case "on_trial":
      return "success";
    case "cancelled":
    case "expired":
      return "error";
    case "paused":
    case "past_due":
    case "unpaid":
      return "warning";
    default:
      return "neutral";
  }
};

// Get card brand icon
const getCardIcon = (brand: string | null) => {
  switch (brand?.toLowerCase()) {
    case "visa":
      return "i-lucide-credit-card";
    case "mastercard":
      return "i-lucide-credit-card";
    case "amex":
      return "i-lucide-credit-card";
    default:
      return "i-lucide-credit-card";
  }
};

// Format card brand name
const formatCardBrand = (brand: string | null) => {
  if (!brand) return "";
  return brand.charAt(0).toUpperCase() + brand.slice(1);
};

// Show success toast on redirect
onMounted(async () => {
  await fetchSubscriptionStatus();

  if (isSuccess.value) {
    toast.add({
      title: t("pages.dashboard.settings.billing.success.subscribed"),
      color: "success",
      icon: "i-lucide-check",
    });
    // Clean URL
    router.replace({ query: {} });
  }
});
</script>

<template>
  <UPageCard
    :title="t('pages.dashboard.settings.billing.title')"
    :description="t('pages.dashboard.settings.billing.description')"
  >
    <div v-if="loading" class="flex items-center justify-center py-8">
      <UIcon name="i-lucide-loader-2" class="h-6 w-6 animate-spin" />
    </div>

    <template v-else>
      <!-- Trial status alert (when on trial) -->
      <UAlert
        v-if="subscriptionStatus?.trial?.isOnTrial"
        class="mb-6"
        :title="t('pages.dashboard.settings.billing.trial.title')"
        :description="
          t('pages.dashboard.settings.billing.trial.description', {
            days: subscriptionStatus.trial.trialDaysRemaining,
          })
        "
        color="info"
        icon="i-lucide-clock"
      />

      <!-- No subscription -->
      <div v-if="!subscriptionStatus?.hasSubscription" class="space-y-4">
        <UButton
          :label="t('pages.dashboard.settings.billing.subscribe')"
          :loading="checkoutLoading"
          icon="i-lucide-credit-card"
          color="primary"
          @click="handleSubscribe"
        />
      </div>

      <!-- Has subscription -->
      <div v-else class="space-y-6">
        <!-- Cancelled alert -->
        <UAlert
          v-if="isCancelled"
          :title="t('pages.dashboard.settings.billing.cancelled.alert.title')"
          :description="
            t('pages.dashboard.settings.billing.cancelled.alert.description', {
              date: formatDate(
                subscriptionStatus.subscription?.currentPeriodEnd,
              ),
            })
          "
          color="warning"
          icon="i-lucide-alert-triangle"
        />

        <!-- Subscription info -->
        <div class="space-y-4">
          <!-- Status -->
          <div class="flex items-center gap-2">
            <span class="text-sm font-medium">
              {{ t("pages.dashboard.settings.billing.status") }}:
            </span>
            <UBadge
              :color="
                getStatusColor(subscriptionStatus.subscription?.status || '')
              "
            >
              {{
                t(
                  `pages.dashboard.settings.billing.statuses.${subscriptionStatus.subscription?.status}`,
                )
              }}
            </UBadge>
          </div>

          <!-- Renewal date -->
          <div
            v-if="subscriptionStatus.subscription?.currentPeriodEnd"
            class="text-muted text-sm"
          >
            <span class="font-medium">
              {{
                isCancelled
                  ? t("pages.dashboard.settings.billing.endsAt")
                  : t("pages.dashboard.settings.billing.renewsAt")
              }}:
            </span>
            {{ formatDate(subscriptionStatus.subscription.currentPeriodEnd) }}
          </div>

          <!-- Payment method -->
          <div
            v-if="subscriptionStatus.subscription?.cardLastFour"
            class="space-y-2"
          >
            <span class="text-sm font-medium">
              {{ t("pages.dashboard.settings.billing.paymentMethod.title") }}:
            </span>
            <div class="flex items-center gap-2">
              <UIcon
                :name="getCardIcon(subscriptionStatus.subscription.cardBrand)"
                class="h-5 w-5"
              />
              <span class="text-sm">
                {{ formatCardBrand(subscriptionStatus.subscription.cardBrand) }}
                •••• {{ subscriptionStatus.subscription.cardLastFour }}
              </span>
            </div>
          </div>
        </div>

        <!-- Actions -->
        <div class="flex flex-wrap gap-3 pt-2">
          <!-- Update payment method -->
          <UButton
            v-if="
              subscriptionStatus.subscription?.updatePaymentMethodUrl &&
              !isCancelled
            "
            :label="t('pages.dashboard.settings.billing.paymentMethod.update')"
            icon="i-lucide-pencil"
            color="neutral"
            variant="outline"
            @click="handleUpdatePaymentMethod"
          />

          <!-- Reactivate (when cancelled) -->
          <UButton
            v-if="isCancelled"
            :label="t('pages.dashboard.settings.billing.reactivate.button')"
            :loading="reactivateLoading"
            icon="i-lucide-refresh-cw"
            color="primary"
            @click="handleReactivate"
          />

          <!-- Cancel subscription (when active) -->
          <UButton
            v-if="!isCancelled && subscriptionStatus.subscription?.isActive"
            :label="t('pages.dashboard.settings.billing.cancel.button')"
            icon="i-lucide-x"
            color="error"
            variant="outline"
            @click="openCancelModal"
          />
        </div>
      </div>
    </template>
  </UPageCard>

  <!-- Cancel subscription modal -->
  <BillingCancelSubscriptionModal
    :open="cancelModalOpen"
    :current-period-end="
      subscriptionStatus?.subscription?.currentPeriodEnd || null
    "
    @close="cancelModalOpen = false"
    @cancelled="handleCancelled"
  />
</template>
