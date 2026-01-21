<script setup lang="ts">
import type {
  ResellerOrganization,
  UpdateOrganizationPayload,
  SubscriptionStatus,
  ConfigureSubscriptionPayload,
  BusinessSector,
} from "~/types/reseller";
import { USER_ROLES } from "~/types/reseller";

definePageMeta({
  layout: "reseller",
  middleware: ["auth", "reseller"],
});

const { t } = useI18n();
const route = useRoute();
const localePath = useLocalePath();
const toast = useToast();
const { formatDate, formatCredits } = useFormatters();
const { sectorOptions, getSectorConfig, getSectorLabel } = useBusinessSectors();

const organizationId = computed(() => Number(route.params.id));

// Breadcrumb (will be reactive once organization is loaded)
const breadcrumbItems = computed(() => [
  {
    label: t("reseller.navigation.dashboard"),
    icon: "i-lucide-home",
    to: localePath("/reseller"),
  },
  {
    label: t("reseller.navigation.organizations"),
    icon: "i-lucide-building-2",
    to: localePath("/reseller/organizations"),
  },
  { label: organization.value?.name || "...", icon: "i-lucide-building" },
]);

useSeoMeta({
  title: t("reseller.organizations.detail.title"),
});

const {
  fetchOrganization,
  updateOrganization,
  suspendOrganization,
  restoreOrganization,
  deleteOrganization,
  loading,
  error,
} = useResellerOrganizations();
const {
  fetchSubscription,
  configureSubscription,
  pauseSubscription,
  resumeSubscription,
  loading: subscriptionLoading,
} = useResellerSubscriptions();
const router = useRouter();
const organization = ref<ResellerOrganization | null>(null);
const subscription = ref<SubscriptionStatus | null>(null);
const isEditing = ref(false);
const editedBusinessSectors = ref<BusinessSector[]>([]);

// Status management modal states
const suspendModalOpen = ref(false);
const restoreModalOpen = ref(false);
const deleteModalOpen = ref(false);
const statusLoading = ref(false);

// Role labels
const roleLabels: Record<number, string> = {
  [USER_ROLES.OWNER]: t("reseller.users.roles.owner"),
  [USER_ROLES.ADMINISTRATOR]: t("reseller.users.roles.administrator"),
  [USER_ROLES.MEMBER]: t("reseller.users.roles.member"),
};

function getRoleLabel(role: number) {
  return roleLabels[role] || "-";
}

// Load organization and subscription
onMounted(async () => {
  organization.value = await fetchOrganization(organizationId.value);
  subscription.value = await fetchSubscription(organizationId.value);
});

// Watch for route param changes
watch(organizationId, async (newId) => {
  if (newId) {
    isEditing.value = false;
    organization.value = await fetchOrganization(newId);
    subscription.value = await fetchSubscription(newId);
  }
});

async function handleSubmit(data: UpdateOrganizationPayload) {
  try {
    const result = await updateOrganization(organizationId.value, data);
    if (result) {
      organization.value = result.organization;
      isEditing.value = false;
      toast.add({
        title: t("reseller.organizations.detail.updateSuccess"),
        color: "success",
      });
    }
  } catch (_e) {
    toast.add({
      title: error.value || t("reseller.organizations.detail.updateError"),
      color: "error",
    });
  }
}

function handleCancel() {
  isEditing.value = false;
}

// Subscription handlers
async function handleSubscriptionSubmit(data: ConfigureSubscriptionPayload) {
  try {
    const result = await configureSubscription(organizationId.value, data);
    if (result) {
      subscription.value = result.subscription;
      toast.add({
        title: t("reseller.subscription.configureSuccess"),
        color: "success",
      });
    }
  } catch (_e) {
    toast.add({
      title: t("reseller.subscription.configureError"),
      color: "error",
    });
  }
}

async function handlePauseSubscription() {
  try {
    const result = await pauseSubscription(organizationId.value);
    if (result) {
      subscription.value = result.subscription;
      toast.add({
        title: t("reseller.subscription.pauseSuccess"),
        color: "success",
      });
    }
  } catch (_e) {
    toast.add({
      title: t("reseller.subscription.pauseError"),
      color: "error",
    });
  }
}

async function handleResumeSubscription() {
  try {
    const result = await resumeSubscription(organizationId.value);
    if (result) {
      subscription.value = result.subscription;
      toast.add({
        title: t("reseller.subscription.resumeSuccess"),
        color: "success",
      });
    }
  } catch (_e) {
    toast.add({
      title: t("reseller.subscription.resumeError"),
      color: "error",
    });
  }
}

// Status management handlers
async function handleSuspend(reason?: string) {
  statusLoading.value = true;
  try {
    const result = await suspendOrganization(
      organizationId.value,
      reason ? { reason } : undefined,
    );
    if (result) {
      organization.value = result.organization;
      suspendModalOpen.value = false;
      toast.add({
        title: t("reseller.organizations.suspend.success"),
        color: "success",
      });
    }
  } catch (_e) {
    toast.add({
      title: error.value || t("reseller.organizations.suspend.error"),
      color: "error",
    });
  } finally {
    statusLoading.value = false;
  }
}

async function handleRestore() {
  statusLoading.value = true;
  try {
    const result = await restoreOrganization(organizationId.value);
    if (result) {
      organization.value = result.organization;
      restoreModalOpen.value = false;
      toast.add({
        title: t("reseller.organizations.restore.success"),
        color: "success",
      });
    }
  } catch (_e) {
    toast.add({
      title: error.value || t("reseller.organizations.restore.error"),
      color: "error",
    });
  } finally {
    statusLoading.value = false;
  }
}

async function handleDelete() {
  statusLoading.value = true;
  try {
    const result = await deleteOrganization(organizationId.value);
    if (result) {
      deleteModalOpen.value = false;
      toast.add({
        title: t("reseller.organizations.delete.success"),
        color: "success",
      });
      // Redirect to organizations list after deletion
      router.push(localePath("/reseller/organizations"));
    }
  } catch (_e) {
    toast.add({
      title: error.value || t("reseller.organizations.delete.error"),
      color: "error",
    });
  } finally {
    statusLoading.value = false;
  }
}

// Computed for days until purge (for deleted organizations)
const daysUntilPurge = computed(() => {
  if (!organization.value?.deletedAt) {
    return null;
  }
  const deletedDate = new Date(organization.value.deletedAt);
  const purgeDate = new Date(deletedDate);
  purgeDate.setDate(purgeDate.getDate() + 30);
  const now = new Date();
  const diff = purgeDate.getTime() - now.getTime();
  return Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)));
});
</script>

<template>
  <div class="min-h-0 space-y-6 overflow-y-auto p-6">
    <!-- Breadcrumb -->
    <UBreadcrumb :items="breadcrumbItems" />

    <!-- Loading -->
    <div
      v-if="loading && !organization"
      class="flex items-center justify-center py-12"
    >
      <UIcon
        name="i-lucide-loader-2"
        class="text-primary-500 h-8 w-8 animate-spin"
      />
    </div>

    <!-- Error -->
    <UAlert
      v-else-if="error && !organization"
      color="error"
      :title="t('common.error')"
    >
      {{ error }}
    </UAlert>

    <!-- Content -->
    <template v-else-if="organization">
      <!-- Header -->
      <div class="mb-6 flex items-start justify-between">
        <div>
          <h1 class="text-3xl font-bold text-gray-900 dark:text-white">
            {{ organization.name }}
          </h1>
          <p class="mt-1 text-gray-500 dark:text-gray-400">
            {{ organization.email }}
          </p>
        </div>
        <div class="flex gap-2">
          <UButton
            :to="
              localePath(`/reseller/organizations/${organization.id}/credits`)
            "
            color="neutral"
            icon="i-lucide-coins"
          >
            {{ t("reseller.organizations.actions.distributeCredits") }}
          </UButton>
          <UButton
            :to="localePath(`/reseller/organizations/${organization.id}/users`)"
            color="neutral"
            icon="i-lucide-users"
          >
            {{ t("reseller.organizations.actions.manageUsers") }}
          </UButton>
          <UButton
            v-if="!isEditing"
            color="primary"
            icon="i-lucide-edit"
            @click="
              () => {
                editedBusinessSectors = organization?.businessSectors || [];
                isEditing = true;
              }
            "
          >
            {{ t("common.buttons.edit") }}
          </UButton>
        </div>
      </div>

      <div class="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <!-- Main content -->
        <div class="space-y-6 lg:col-span-2">
          <!-- Organization info -->
          <UCard>
            <template #header>
              <h2 class="text-lg font-semibold">
                {{ t("reseller.organizations.detail.info") }}
              </h2>
            </template>

            <!-- Edit form -->
            <UForm
              v-if="isEditing"
              class="space-y-4"
              @submit.prevent="
                handleSubmit({
                  name: organization.name,
                  email: organization.email,
                  businessSectors: editedBusinessSectors,
                })
              "
            >
              <UFormField
                :label="t('reseller.organizations.fields.name')"
                name="name"
                required
              >
                <UInput v-model="organization.name" class="w-3/4" />
              </UFormField>
              <UFormField
                :label="t('reseller.organizations.fields.email')"
                name="email"
                required
              >
                <UInput
                  v-model="organization.email"
                  type="email"
                  class="w-3/4"
                />
              </UFormField>
              <UFormField
                :label="t('reseller.organizations.fields.businessSectors')"
                name="businessSectors"
              >
                <UInputMenu
                  v-model="editedBusinessSectors"
                  class="w-3/4"
                  :items="sectorOptions"
                  multiple
                  value-key="value"
                  :placeholder="
                    t('reseller.organizations.placeholders.businessSectors')
                  "
                />
              </UFormField>
              <div class="flex justify-end gap-2">
                <UButton
                  type="button"
                  color="neutral"
                  variant="outline"
                  @click="handleCancel"
                >
                  {{ t("common.buttons.cancel") }}
                </UButton>
                <UButton type="submit" color="primary" :loading="loading">
                  {{ t("common.buttons.save") }}
                </UButton>
              </div>
            </UForm>

            <!-- Display mode -->
            <dl v-else class="divide-y divide-gray-100 dark:divide-gray-800">
              <div class="grid grid-cols-3 gap-4 py-3">
                <dt class="text-sm font-medium text-gray-500">
                  {{ t("reseller.organizations.fields.name") }}
                </dt>
                <dd class="col-span-2 text-sm text-gray-900 dark:text-white">
                  {{ organization.name }}
                </dd>
              </div>
              <div class="grid grid-cols-3 gap-4 py-3">
                <dt class="text-sm font-medium text-gray-500">
                  {{ t("reseller.organizations.fields.email") }}
                </dt>
                <dd class="col-span-2 text-sm text-gray-900 dark:text-white">
                  {{ organization.email }}
                </dd>
              </div>
              <div class="grid grid-cols-3 gap-4 py-3">
                <dt class="text-sm font-medium text-gray-500">
                  {{ t("reseller.organizations.fields.businessSectors") }}
                </dt>
                <dd class="col-span-2">
                  <div
                    v-if="organization.businessSectors?.length > 0"
                    class="flex flex-wrap gap-1.5"
                  >
                    <span
                      v-for="sector in organization.businessSectors"
                      :key="sector"
                      class="inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium"
                      :class="[
                        getSectorConfig(sector).bgClass,
                        getSectorConfig(sector).textClass,
                      ]"
                    >
                      <UIcon
                        :name="getSectorConfig(sector).icon"
                        class="h-3.5 w-3.5"
                      />
                      {{ getSectorLabel(sector) }}
                    </span>
                  </div>
                  <span v-else class="text-sm text-gray-400 italic">
                    {{ t("reseller.organizations.detail.noSectors") }}
                  </span>
                </dd>
              </div>
              <div class="grid grid-cols-3 gap-4 py-3">
                <dt class="text-sm font-medium text-gray-500">
                  {{ t("reseller.organizations.fields.createdAt") }}
                </dt>
                <dd class="col-span-2 text-sm text-gray-900 dark:text-white">
                  {{ formatDate(organization.createdAt) }}
                </dd>
              </div>
            </dl>
          </UCard>

          <!-- Members list -->
          <UCard v-if="organization.users">
            <template #header>
              <div class="flex items-center justify-between">
                <h2 class="text-lg font-semibold">
                  {{ t("reseller.organizations.detail.members") }}
                  <UBadge color="neutral" variant="outline" class="ml-2">
                    {{ organization.usersCount || organization.users.length }}
                  </UBadge>
                </h2>
                <UButton
                  :to="
                    localePath(
                      `/reseller/organizations/${organization.id}/users`,
                    )
                  "
                  color="neutral"
                  variant="ghost"
                  size="sm"
                  trailing-icon="i-lucide-arrow-right"
                >
                  {{ t("reseller.organizations.actions.manageUsers") }}
                </UButton>
              </div>
            </template>

            <div
              v-if="organization.users.length > 0"
              class="divide-y divide-gray-100 dark:divide-gray-800"
            >
              <div
                v-for="user in organization.users"
                :key="user.id"
                class="flex items-center justify-between py-3"
              >
                <div>
                  <p class="font-medium text-gray-900 dark:text-white">
                    {{ user.fullName || `${user.firstName} ${user.lastName}` }}
                  </p>
                  <p class="text-sm text-gray-500">
                    {{ user.email }}
                  </p>
                </div>
                <UBadge color="neutral" variant="subtle">
                  {{ getRoleLabel(user.role) }}
                </UBadge>
              </div>
            </div>
            <div v-else class="py-8 text-center text-gray-500">
              {{ t("reseller.organizations.detail.noMembers") }}
            </div>
          </UCard>
        </div>

        <!-- Sidebar -->
        <div class="space-y-6">
          <!-- Credits card -->
          <UCard>
            <template #header>
              <h2 class="text-lg font-semibold">
                {{ t("reseller.organizations.detail.creditBalance") }}
              </h2>
            </template>

            <div class="py-4 text-center">
              <div class="text-primary-500 text-4xl font-bold">
                {{ formatCredits(organization.credits) }}
              </div>
              <div class="text-gray-500">
                {{ t("common.credits") }}
              </div>
            </div>

            <UButton
              :to="
                localePath(`/reseller/organizations/${organization.id}/credits`)
              "
              color="primary"
              block
              icon="i-lucide-plus"
            >
              {{ t("reseller.organizations.actions.distributeCredits") }}
            </UButton>
          </UCard>

          <!-- Subscription card -->
          <UCard>
            <template #header>
              <div class="flex items-center justify-between">
                <h2 class="text-lg font-semibold">
                  {{ t("reseller.subscription.title") }}
                </h2>
                <ResellerSubscriptionStatusBadge :subscription="subscription" />
              </div>
            </template>

            <ResellerSubscriptionConfigForm
              :subscription="subscription"
              :current-credits="organization.credits"
              :loading="subscriptionLoading"
              @submit="handleSubscriptionSubmit"
              @pause="handlePauseSubscription"
              @resume="handleResumeSubscription"
            />
          </UCard>

          <!-- Status management card -->
          <UCard>
            <template #header>
              <div class="flex items-center justify-between">
                <h2 class="text-lg font-semibold">
                  {{ t("reseller.organizations.status.title") }}
                </h2>
                <ResellerOrganizationStatusBadge
                  :status="organization.status"
                  :suspended-at="organization.suspendedAt"
                  :deleted-at="organization.deletedAt"
                />
              </div>
            </template>

            <div class="space-y-4">
              <!-- Status details -->
              <div
                v-if="
                  organization.status === 'suspended' &&
                  organization.suspendedAt
                "
                class="text-sm text-gray-600 dark:text-gray-400"
              >
                <p>
                  <span class="font-medium"
                    >{{ t("reseller.organizations.status.suspendedAt") }}:</span
                  >
                  {{ formatDate(organization.suspendedAt) }}
                </p>
                <p v-if="organization.suspensionReason" class="mt-1">
                  <span class="font-medium"
                    >{{ t("reseller.organizations.status.reason") }}:</span
                  >
                  {{ organization.suspensionReason }}
                </p>
              </div>

              <div
                v-if="
                  organization.status === 'deleted' && organization.deletedAt
                "
                class="text-sm text-gray-600 dark:text-gray-400"
              >
                <p>
                  <span class="font-medium"
                    >{{ t("reseller.organizations.status.deletedAt") }}:</span
                  >
                  {{ formatDate(organization.deletedAt) }}
                </p>
                <p v-if="daysUntilPurge !== null" class="text-error-500 mt-1">
                  {{
                    t("reseller.organizations.status.daysUntilPurge", {
                      days: daysUntilPurge,
                    })
                  }}
                </p>
              </div>

              <!-- Action buttons based on status -->
              <div v-if="organization.status === 'active'" class="space-y-2">
                <UButton
                  color="warning"
                  variant="outline"
                  block
                  icon="i-lucide-pause-circle"
                  @click="suspendModalOpen = true"
                >
                  {{ t("reseller.organizations.actions.suspend") }}
                </UButton>
                <UButton
                  color="error"
                  variant="outline"
                  block
                  icon="i-lucide-trash-2"
                  @click="deleteModalOpen = true"
                >
                  {{ t("reseller.organizations.actions.delete") }}
                </UButton>
              </div>

              <div
                v-else-if="organization.status === 'suspended'"
                class="space-y-2"
              >
                <UButton
                  color="primary"
                  variant="outline"
                  block
                  icon="i-lucide-rotate-ccw"
                  @click="restoreModalOpen = true"
                >
                  {{ t("reseller.organizations.actions.restore") }}
                </UButton>
                <UButton
                  color="error"
                  variant="outline"
                  block
                  icon="i-lucide-trash-2"
                  @click="deleteModalOpen = true"
                >
                  {{ t("reseller.organizations.actions.delete") }}
                </UButton>
              </div>

              <!-- Deleted status: no actions available -->
              <div
                v-else-if="organization.status === 'deleted'"
                class="text-sm text-gray-500 italic"
              >
                {{ t("reseller.organizations.status.noActionsAvailable") }}
              </div>
            </div>
          </UCard>

          <!-- Quick actions -->
          <UCard>
            <template #header>
              <h2 class="text-lg font-semibold">
                {{ t("reseller.organizations.detail.quickActions") }}
              </h2>
            </template>

            <div class="space-y-2">
              <UButton
                :to="
                  localePath(`/reseller/organizations/${organization.id}/users`)
                "
                color="neutral"
                variant="outline"
                block
                icon="i-lucide-user-plus"
              >
                {{ t("reseller.organizations.actions.addUser") }}
              </UButton>
            </div>
          </UCard>
        </div>
      </div>

      <!-- Modals -->
      <ResellerOrganizationSuspendModal
        v-model:open="suspendModalOpen"
        :organization="organization"
        :loading="statusLoading"
        @confirm="handleSuspend"
        @cancel="suspendModalOpen = false"
      />

      <ResellerOrganizationRestoreModal
        v-model:open="restoreModalOpen"
        :organization="organization"
        :loading="statusLoading"
        @confirm="handleRestore"
        @cancel="restoreModalOpen = false"
      />

      <ResellerOrganizationDeleteModal
        v-model:open="deleteModalOpen"
        :organization="organization"
        :loading="statusLoading"
        @confirm="handleDelete"
        @cancel="deleteModalOpen = false"
      />
    </template>
  </div>
</template>
