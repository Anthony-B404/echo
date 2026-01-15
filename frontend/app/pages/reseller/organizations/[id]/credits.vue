<script setup lang="ts">
import type { ResellerOrganization, DistributeCreditsPayload, ResellerTransaction } from '~/types/reseller'

definePageMeta({
  layout: 'reseller',
  middleware: ['auth', 'reseller'],
})

const { t } = useI18n()
const route = useRoute()
const localePath = useLocalePath()
const toast = useToast()

const organizationId = computed(() => Number(route.params.id))

// Breadcrumb (will be reactive once organization is loaded)
const breadcrumbItems = computed(() => [
  { label: t('reseller.navigation.dashboard'), icon: 'i-lucide-home', to: localePath('/reseller') },
  { label: t('reseller.navigation.organizations'), icon: 'i-lucide-building-2', to: localePath('/reseller/organizations') },
  { label: organization.value?.name || '...', icon: 'i-lucide-building', to: localePath(`/reseller/organizations/${organizationId.value}`) },
  { label: t('reseller.navigation.credits'), icon: 'i-lucide-coins' },
])

useSeoMeta({
  title: t('reseller.credits.distribution.title'),
})

// Composables
const { fetchOrganization, distributeCredits, loading, error } = useResellerOrganizations()
const { fetchProfile, fetchCredits } = useResellerProfile()

// State
const organization = ref<ResellerOrganization | null>(null)
const resellerBalance = ref(0)
const transactions = ref<ResellerTransaction[]>([])
const distributing = ref(false)

// Load data
onMounted(async () => {
  await loadData()
})

async function loadData() {
  const [orgData, profileData, creditsData] = await Promise.all([
    fetchOrganization(organizationId.value),
    fetchProfile(),
    fetchCredits({ limit: 10 }),
  ])

  if (orgData) {
    organization.value = orgData
  }
  if (profileData) {
    resellerBalance.value = profileData.creditBalance
  }
  if (creditsData) {
    resellerBalance.value = creditsData.creditBalance
    // Filter transactions for this organization
    transactions.value = creditsData.transactions.data.filter(
      (t) => t.targetOrganizationId === organizationId.value
    )
  }
}

async function handleDistribute(data: DistributeCreditsPayload) {
  distributing.value = true
  try {
    const result = await distributeCredits(organizationId.value, data)
    if (result) {
      toast.add({
        title: t('reseller.credits.distribution.success'),
        color: 'success',
      })
      // Update local state
      resellerBalance.value = result.resellerBalance
      if (organization.value) {
        organization.value.credits = result.organizationCredits
      }
      // Reload transactions
      await loadData()
    }
  } catch (e) {
    toast.add({
      title: error.value || t('reseller.credits.distribution.error'),
      color: 'error',
    })
  } finally {
    distributing.value = false
  }
}
</script>

<template>
  <div class="p-6 space-y-6">
    <!-- Breadcrumb -->
    <UBreadcrumb :items="breadcrumbItems" />

    <!-- Header -->
    <div>
      <h1 class="text-3xl font-bold text-gray-900 dark:text-white">
        {{ t('reseller.credits.distribution.title') }}
      </h1>
      <p v-if="organization" class="mt-1 text-gray-500 dark:text-gray-400">
        {{ organization.name }}
      </p>
    </div>

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
      <!-- Balance cards -->
      <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
        <!-- Reseller pool -->
        <UCard>
          <template #header>
            <h2 class="text-lg font-semibold">{{ t('reseller.credits.distribution.myPool') }}</h2>
          </template>
          <div class="text-center py-4">
            <div class="text-4xl font-bold text-primary-500">
              {{ resellerBalance.toLocaleString() }}
            </div>
            <div class="text-gray-500">{{ t('reseller.credits.availableToDistribute') }}</div>
          </div>
        </UCard>

        <!-- Organization balance -->
        <UCard>
          <template #header>
            <h2 class="text-lg font-semibold">{{ t('reseller.credits.distribution.orgBalance') }}</h2>
          </template>
          <div class="text-center py-4">
            <div class="text-4xl font-bold text-green-500">
              {{ organization.credits.toLocaleString() }}
            </div>
            <div class="text-gray-500">{{ t('reseller.credits.currentBalance') }}</div>
          </div>
        </UCard>
      </div>

      <!-- Distribution form -->
      <UCard>
        <template #header>
          <h2 class="text-lg font-semibold">{{ t('reseller.credits.distribution.formTitle') }}</h2>
        </template>
        <ResellerCreditDistributionForm
          :loading="distributing"
          :max-credits="resellerBalance"
          @submit="handleDistribute"
        />
      </UCard>

      <!-- Transaction history -->
      <UCard>
        <template #header>
          <h2 class="text-lg font-semibold">{{ t('reseller.credits.distribution.history') }}</h2>
        </template>
        <ResellerTransactionHistory :transactions="transactions" :loading="false" />
      </UCard>
    </template>
  </div>
</template>
