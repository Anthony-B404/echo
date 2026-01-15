<script setup lang="ts">
import type { ResellerProfile } from '~/types/reseller'

definePageMeta({
  layout: 'reseller',
  middleware: ['auth', 'reseller'],
})

const { t } = useI18n()
const localePath = useLocalePath()
const { formatDate, formatCredits } = useFormatters()

// Breadcrumb
const breadcrumbItems = computed(() => [
  { label: t('reseller.navigation.dashboard'), icon: 'i-lucide-home', to: localePath('/reseller') },
  { label: t('reseller.navigation.profile'), icon: 'i-lucide-user' },
])

useSeoMeta({
  title: t('reseller.profile.title'),
})

// Composables
const { fetchProfile, loading, error } = useResellerProfile()

// State
const profile = ref<ResellerProfile | null>(null)

// Load data
onMounted(async () => {
  profile.value = await fetchProfile()
})
</script>

<template>
  <div class="p-6 space-y-6">
    <!-- Breadcrumb -->
    <UBreadcrumb :items="breadcrumbItems" />

    <!-- Header -->
    <div>
      <h1 class="text-3xl font-bold text-gray-900 dark:text-white">
        {{ t('reseller.profile.title') }}
      </h1>
      <p class="mt-1 text-gray-500 dark:text-gray-400">
        {{ t('reseller.profile.subtitle') }}
      </p>
    </div>

    <!-- Loading -->
    <div v-if="loading" class="flex items-center justify-center py-12">
      <UIcon name="i-lucide-loader-2" class="h-8 w-8 animate-spin text-primary-500" />
    </div>

    <!-- Error -->
    <UAlert v-else-if="error" color="error" :title="t('common.error')">
      {{ error }}
    </UAlert>

    <!-- Content -->
    <template v-else-if="profile">
      <div class="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <!-- Main content -->
        <div class="lg:col-span-2">
          <UCard>
            <template #header>
              <h2 class="text-lg font-semibold">{{ t('reseller.profile.info') }}</h2>
            </template>

            <dl class="divide-y divide-gray-100 dark:divide-gray-800">
              <div class="py-3 grid grid-cols-3 gap-4">
                <dt class="text-sm font-medium text-gray-500">
                  {{ t('reseller.profile.fields.name') }}
                </dt>
                <dd class="col-span-2 text-sm text-gray-900 dark:text-white">
                  {{ profile.name }}
                </dd>
              </div>
              <div class="py-3 grid grid-cols-3 gap-4">
                <dt class="text-sm font-medium text-gray-500">
                  {{ t('reseller.profile.fields.company') }}
                </dt>
                <dd class="col-span-2 text-sm text-gray-900 dark:text-white">
                  {{ profile.company }}
                </dd>
              </div>
              <div class="py-3 grid grid-cols-3 gap-4">
                <dt class="text-sm font-medium text-gray-500">
                  {{ t('reseller.profile.fields.email') }}
                </dt>
                <dd class="col-span-2 text-sm text-gray-900 dark:text-white">
                  {{ profile.email }}
                </dd>
              </div>
              <div class="py-3 grid grid-cols-3 gap-4">
                <dt class="text-sm font-medium text-gray-500">
                  {{ t('reseller.profile.fields.phone') }}
                </dt>
                <dd class="col-span-2 text-sm text-gray-900 dark:text-white">
                  {{ profile.phone || '-' }}
                </dd>
              </div>
              <div class="py-3 grid grid-cols-3 gap-4">
                <dt class="text-sm font-medium text-gray-500">
                  {{ t('reseller.profile.fields.siret') }}
                </dt>
                <dd class="col-span-2 text-sm text-gray-900 dark:text-white">
                  {{ profile.siret || '-' }}
                </dd>
              </div>
              <div class="py-3 grid grid-cols-3 gap-4">
                <dt class="text-sm font-medium text-gray-500">
                  {{ t('reseller.profile.fields.address') }}
                </dt>
                <dd class="col-span-2 text-sm text-gray-900 dark:text-white whitespace-pre-wrap">
                  {{ profile.address || '-' }}
                </dd>
              </div>
              <div class="py-3 grid grid-cols-3 gap-4">
                <dt class="text-sm font-medium text-gray-500">
                  {{ t('reseller.profile.fields.createdAt') }}
                </dt>
                <dd class="col-span-2 text-sm text-gray-900 dark:text-white">
                  {{ formatDate(profile.createdAt) }}
                </dd>
              </div>
            </dl>
          </UCard>
        </div>

        <!-- Sidebar -->
        <div class="space-y-6">
          <!-- Status card -->
          <UCard>
            <template #header>
              <h2 class="text-lg font-semibold">{{ t('reseller.profile.status') }}</h2>
            </template>

            <div class="text-center py-4">
              <UBadge :color="profile.isActive ? 'success' : 'error'" size="lg">
                {{
                  profile.isActive
                    ? t('reseller.profile.statusActive')
                    : t('reseller.profile.statusInactive')
                }}
              </UBadge>
            </div>
          </UCard>

          <!-- Credits card -->
          <UCard>
            <template #header>
              <h2 class="text-lg font-semibold">{{ t('reseller.profile.creditBalance') }}</h2>
            </template>

            <div class="text-center py-4">
              <div class="text-4xl font-bold text-primary-500">
                {{ formatCredits(profile.creditBalance) }}
              </div>
              <div class="text-gray-500">{{ t('common.credits') }}</div>
            </div>
          </UCard>

          <!-- Info card -->
          <UCard>
            <div class="text-center text-sm text-gray-500">
              <UIcon name="i-lucide-info" class="h-5 w-5 inline mr-2" />
              {{ t('reseller.profile.editInfo') }}
            </div>
          </UCard>
        </div>
      </div>
    </template>
  </div>
</template>
