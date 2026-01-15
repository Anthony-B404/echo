<script setup lang="ts">
import type { ResellerOrganization, UpdateOrganizationPayload } from '~/types/reseller'
import { USER_ROLES } from '~/types/reseller'

definePageMeta({
  layout: 'reseller',
  middleware: ['auth', 'reseller'],
})

const { t } = useI18n()
const route = useRoute()
const localePath = useLocalePath()
const toast = useToast()
const { formatDate, formatCredits } = useFormatters()

const organizationId = computed(() => Number(route.params.id))

// Breadcrumb (will be reactive once organization is loaded)
const breadcrumbItems = computed(() => [
  { label: t('reseller.navigation.dashboard'), icon: 'i-lucide-home', to: localePath('/reseller') },
  { label: t('reseller.navigation.organizations'), icon: 'i-lucide-building-2', to: localePath('/reseller/organizations') },
  { label: organization.value?.name || '...', icon: 'i-lucide-building' },
])

useSeoMeta({
  title: t('reseller.organizations.detail.title'),
})

const { fetchOrganization, updateOrganization, loading, error } = useResellerOrganizations()
const organization = ref<ResellerOrganization | null>(null)
const isEditing = ref(false)

// Role configuration
const roleConfig: Record<number, { label: string; color: string }> = {
  [USER_ROLES.OWNER]: { label: t('reseller.users.roles.owner'), color: 'primary' },
  [USER_ROLES.ADMINISTRATOR]: { label: t('reseller.users.roles.administrator'), color: 'info' },
  [USER_ROLES.MEMBER]: { label: t('reseller.users.roles.member'), color: 'neutral' },
}

function getRoleLabel(role: number) {
  return roleConfig[role]?.label || '-'
}

function getRoleColor(role: number) {
  return roleConfig[role]?.color || 'neutral'
}

// Load organization
onMounted(async () => {
  organization.value = await fetchOrganization(organizationId.value)
})

// Watch for route param changes
watch(organizationId, async (newId) => {
  if (newId) {
    isEditing.value = false
    organization.value = await fetchOrganization(newId)
  }
})

async function handleSubmit(data: UpdateOrganizationPayload) {
  try {
    const result = await updateOrganization(organizationId.value, data)
    if (result) {
      organization.value = result.organization
      isEditing.value = false
      toast.add({
        title: t('reseller.organizations.detail.updateSuccess'),
        color: 'success',
      })
    }
  } catch (e) {
    toast.add({
      title: error.value || t('reseller.organizations.detail.updateError'),
      color: 'error',
    })
  }
}

function handleCancel() {
  isEditing.value = false
}
</script>

<template>
  <div class="p-6 space-y-6">
    <!-- Breadcrumb -->
    <UBreadcrumb :items="breadcrumbItems" />

    <!-- Loading -->
    <div v-if="loading && !organization" class="flex items-center justify-center py-12">
      <UIcon name="i-lucide-loader-2" class="h-8 w-8 animate-spin text-primary-500" />
    </div>

    <!-- Error -->
    <UAlert v-else-if="error && !organization" color="error" :title="t('common.error')">
      {{ error }}
    </UAlert>

    <!-- Content -->
    <template v-else-if="organization">
      <!-- Header -->
      <div class="flex items-start justify-between mb-6">
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
            :to="localePath(`/reseller/organizations/${organization.id}/credits`)"
            color="neutral"
            icon="i-lucide-coins"
          >
            {{ t('reseller.organizations.actions.distributeCredits') }}
          </UButton>
          <UButton
            :to="localePath(`/reseller/organizations/${organization.id}/users`)"
            color="neutral"
            icon="i-lucide-users"
          >
            {{ t('reseller.organizations.actions.manageUsers') }}
          </UButton>
          <UButton
            v-if="!isEditing"
            color="primary"
            icon="i-lucide-edit"
            @click="isEditing = true"
          >
            {{ t('common.buttons.edit') }}
          </UButton>
        </div>
      </div>

      <div class="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <!-- Main content -->
        <div class="lg:col-span-2 space-y-6">
          <!-- Organization info -->
          <UCard>
            <template #header>
              <h2 class="text-lg font-semibold">{{ t('reseller.organizations.detail.info') }}</h2>
            </template>

            <!-- Edit form -->
            <UForm
              v-if="isEditing"
              class="space-y-4"
              @submit.prevent="handleSubmit({ name: organization.name, email: organization.email })"
            >
              <UFormField :label="t('reseller.organizations.fields.name')" name="name" required>
                <UInput v-model="organization.name" />
              </UFormField>
              <UFormField :label="t('reseller.organizations.fields.email')" name="email" required>
                <UInput v-model="organization.email" type="email" />
              </UFormField>
              <div class="flex justify-end gap-2">
                <UButton type="button" color="neutral" variant="outline" @click="handleCancel">
                  {{ t('common.buttons.cancel') }}
                </UButton>
                <UButton type="submit" color="primary" :loading="loading">
                  {{ t('common.buttons.save') }}
                </UButton>
              </div>
            </UForm>

            <!-- Display mode -->
            <dl v-else class="divide-y divide-gray-100 dark:divide-gray-800">
              <div class="py-3 grid grid-cols-3 gap-4">
                <dt class="text-sm font-medium text-gray-500">
                  {{ t('reseller.organizations.fields.name') }}
                </dt>
                <dd class="col-span-2 text-sm text-gray-900 dark:text-white">
                  {{ organization.name }}
                </dd>
              </div>
              <div class="py-3 grid grid-cols-3 gap-4">
                <dt class="text-sm font-medium text-gray-500">
                  {{ t('reseller.organizations.fields.email') }}
                </dt>
                <dd class="col-span-2 text-sm text-gray-900 dark:text-white">
                  {{ organization.email }}
                </dd>
              </div>
              <div class="py-3 grid grid-cols-3 gap-4">
                <dt class="text-sm font-medium text-gray-500">
                  {{ t('reseller.organizations.fields.createdAt') }}
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
                  {{ t('reseller.organizations.detail.members') }}
                  <UBadge color="neutral" class="ml-2">{{ organization.usersCount || organization.users.length }}</UBadge>
                </h2>
                <UButton
                  :to="localePath(`/reseller/organizations/${organization.id}/users`)"
                  color="neutral"
                  variant="ghost"
                  size="sm"
                  trailing-icon="i-lucide-arrow-right"
                >
                  {{ t('reseller.organizations.actions.manageUsers') }}
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
                class="py-3 flex items-center justify-between"
              >
                <div>
                  <p class="font-medium text-gray-900 dark:text-white">
                    {{ user.fullName || `${user.firstName} ${user.lastName}` }}
                  </p>
                  <p class="text-sm text-gray-500">{{ user.email }}</p>
                </div>
                <UBadge :color="getRoleColor(user.role)">
                  {{ getRoleLabel(user.role) }}
                </UBadge>
              </div>
            </div>
            <div v-else class="py-8 text-center text-gray-500">
              {{ t('reseller.organizations.detail.noMembers') }}
            </div>
          </UCard>
        </div>

        <!-- Sidebar -->
        <div class="space-y-6">
          <!-- Credits card -->
          <UCard>
            <template #header>
              <h2 class="text-lg font-semibold">{{ t('reseller.organizations.detail.creditBalance') }}</h2>
            </template>

            <div class="text-center py-4">
              <div class="text-4xl font-bold text-primary-500">
                {{ formatCredits(organization.credits) }}
              </div>
              <div class="text-gray-500">{{ t('common.credits') }}</div>
            </div>

            <UButton
              :to="localePath(`/reseller/organizations/${organization.id}/credits`)"
              color="primary"
              block
              icon="i-lucide-plus"
            >
              {{ t('reseller.organizations.actions.distributeCredits') }}
            </UButton>
          </UCard>

          <!-- Quick actions -->
          <UCard>
            <template #header>
              <h2 class="text-lg font-semibold">{{ t('reseller.organizations.detail.quickActions') }}</h2>
            </template>

            <div class="space-y-2">
              <UButton
                :to="localePath(`/reseller/organizations/${organization.id}/users`)"
                color="neutral"
                variant="outline"
                block
                icon="i-lucide-user-plus"
              >
                {{ t('reseller.organizations.actions.addUser') }}
              </UButton>
            </div>
          </UCard>
        </div>
      </div>
    </template>
  </div>
</template>
