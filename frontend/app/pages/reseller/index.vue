<script setup lang="ts">
import type { ResellerOrganization, CreditsResponse } from '~/types/reseller'

definePageMeta({
  layout: 'reseller',
  middleware: ['auth', 'reseller'],
})

const { t } = useI18n()
const localePath = useLocalePath()
const { formatCredits } = useFormatters()

// Breadcrumb
const breadcrumbItems = computed(() => [
  { label: t('reseller.navigation.dashboard'), icon: 'i-lucide-home' },
])

useSeoMeta({
  title: t('reseller.dashboard.title'),
  description: t('reseller.dashboard.subtitle'),
})

// Composables
const { fetchProfile, fetchCredits } = useResellerProfile()
const { fetchOrganizations } = useResellerOrganizations()

// State
const loading = ref(true)
const error = ref<string | null>(null)
const creditBalance = ref(0)
const organizations = ref<ResellerOrganization[]>([])
const creditsData = ref<CreditsResponse | null>(null)

// Computed stats
const totalDistributed = computed(() => {
  if (!creditsData.value?.transactions?.data) return 0
  return creditsData.value.transactions.data
    .filter((t) => t.type === 'distribution')
    .reduce((sum, t) => sum + Math.abs(t.amount), 0)
})

const totalConsumed = computed(() => {
  // This would require organization-level tracking
  // For now, show sum of organization credits as a proxy
  return organizations.value.reduce((sum, org) => sum + org.credits, 0)
})

// Load data
onMounted(async () => {
  try {
    const [profileData, creditsResult, orgsResult] = await Promise.all([
      fetchProfile(),
      fetchCredits({ limit: 5 }),
      fetchOrganizations({ limit: 5, sortBy: 'createdAt', sortOrder: 'desc' }),
    ])

    if (profileData) {
      creditBalance.value = profileData.creditBalance
    }
    if (creditsResult) {
      creditsData.value = creditsResult
      creditBalance.value = creditsResult.creditBalance
    }
    if (orgsResult) {
      organizations.value = orgsResult.data
    }
  } catch (e) {
    error.value = e instanceof Error ? e.message : 'Failed to load dashboard'
  } finally {
    loading.value = false
  }
})

</script>

<template>
  <div class="p-6 space-y-6">
    <!-- Breadcrumb -->
    <UBreadcrumb :items="breadcrumbItems" />

    <!-- Header -->
    <div>
      <h1 class="text-3xl font-bold text-gray-900 dark:text-white">
        {{ t('reseller.dashboard.title') }}
      </h1>
      <p class="mt-1 text-gray-500 dark:text-gray-400">
        {{ t('reseller.dashboard.subtitle') }}
      </p>
    </div>

    <!-- Loading state -->
    <div v-if="loading" class="flex items-center justify-center py-12">
      <UIcon name="i-lucide-loader-2" class="h-8 w-8 animate-spin text-primary-500" />
    </div>

    <!-- Error state -->
    <UAlert v-else-if="error" color="error" :title="t('common.error')">
      {{ error }}
    </UAlert>

    <!-- Dashboard content -->
    <template v-else>
      <!-- Stats grid -->
      <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <ResellerStatsCard
          :title="t('reseller.dashboard.stats.creditPool')"
          :value="formatCredits(creditBalance)"
          :subtitle="t('reseller.dashboard.stats.creditsAvailable')"
          icon="i-lucide-coins"
          color="success"
        />
        <ResellerStatsCard
          :title="t('reseller.dashboard.stats.organizations')"
          :value="organizations.length"
          icon="i-lucide-building-2"
          color="primary"
        />
        <ResellerStatsCard
          :title="t('reseller.dashboard.stats.distributedCredits')"
          :value="formatCredits(totalDistributed)"
          icon="i-lucide-send"
          color="info"
        />
        <ResellerStatsCard
          :title="t('reseller.dashboard.stats.creditsInOrgs')"
          :value="formatCredits(totalConsumed)"
          icon="i-lucide-trending-up"
          color="warning"
        />
      </div>

      <!-- Two column layout -->
      <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <!-- Recent Organizations -->
        <UCard>
          <template #header>
            <div class="flex items-center justify-between">
              <h2 class="text-lg font-semibold">{{ t('reseller.dashboard.recentOrganizations') }}</h2>
              <UButton
                :to="localePath('/reseller/organizations')"
                color="neutral"
                variant="ghost"
                size="sm"
                trailing-icon="i-lucide-arrow-right"
              >
                {{ t('common.buttons.viewAll') }}
              </UButton>
            </div>
          </template>

          <div
            v-if="organizations.length > 0"
            class="divide-y divide-gray-100 dark:divide-gray-800"
          >
            <NuxtLink
              v-for="org in organizations"
              :key="org.id"
              :to="localePath(`/reseller/organizations/${org.id}`)"
              class="flex items-center justify-between py-3 hover:bg-gray-50 dark:hover:bg-gray-800/50 -mx-4 px-4 transition-colors"
            >
              <div>
                <p class="font-medium text-gray-900 dark:text-white">{{ org.name }}</p>
                <p class="text-sm text-gray-500">{{ org.email }}</p>
              </div>
              <UBadge color="success" variant="subtle">
                {{ formatCredits(org.credits) }} {{ t('common.credits') }}
              </UBadge>
            </NuxtLink>
          </div>
          <div v-else class="py-8 text-center text-gray-500">
            {{ t('reseller.dashboard.noOrganizations') }}
          </div>
        </UCard>

        <!-- Recent Transactions -->
        <UCard>
          <template #header>
            <div class="flex items-center justify-between">
              <h2 class="text-lg font-semibold">{{ t('reseller.dashboard.recentTransactions') }}</h2>
              <UButton
                :to="localePath('/reseller/credits')"
                color="neutral"
                variant="ghost"
                size="sm"
                trailing-icon="i-lucide-arrow-right"
              >
                {{ t('common.buttons.viewAll') }}
              </UButton>
            </div>
          </template>

          <ResellerTransactionHistory
            :transactions="creditsData?.transactions?.data || []"
            :loading="false"
            show-organization
          />
        </UCard>
      </div>
    </template>
  </div>
</template>
