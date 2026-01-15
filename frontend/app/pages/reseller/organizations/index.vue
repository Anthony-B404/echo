<script setup lang="ts">
import type { ResellerOrganization, OrganizationsFilters } from '~/types/reseller'

definePageMeta({
  layout: 'reseller',
  middleware: ['auth', 'reseller'],
})

const { t } = useI18n()
const localePath = useLocalePath()

// Breadcrumb
const breadcrumbItems = computed(() => [
  { label: t('reseller.navigation.dashboard'), icon: 'i-lucide-home', to: localePath('/reseller') },
  { label: t('reseller.navigation.organizations'), icon: 'i-lucide-building-2' },
])

useSeoMeta({
  title: t('reseller.organizations.list.title'),
})

const { fetchOrganizations, loading, error } = useResellerOrganizations()

// State
const organizations = ref<ResellerOrganization[]>([])
const pagination = ref({
  total: 0,
  perPage: 20,
  currentPage: 1,
  lastPage: 1,
})

// Filters
const search = ref('')

// Load organizations
async function loadOrganizations(page = 1) {
  const filters: OrganizationsFilters = {
    page,
    limit: pagination.value.perPage,
    search: search.value || undefined,
    sortBy: 'createdAt',
    sortOrder: 'desc',
  }

  const response = await fetchOrganizations(filters)
  if (response) {
    organizations.value = response.data
    pagination.value = {
      total: response.meta.total,
      perPage: response.meta.perPage,
      currentPage: response.meta.currentPage,
      lastPage: response.meta.lastPage,
    }
  }
}

// Initial load
onMounted(() => loadOrganizations())

// Debounced search
const debouncedSearch = useDebounceFn(() => {
  loadOrganizations(1)
}, 300)

// Watch filters
watch(search, () => {
  debouncedSearch()
})

// Handle page change
function handlePageChange(page: number) {
  loadOrganizations(page)
}

// Handle view
function handleView(organization: ResellerOrganization) {
  navigateTo(localePath(`/reseller/organizations/${organization.id}`))
}

// Handle credits
function handleCredits(organization: ResellerOrganization) {
  navigateTo(localePath(`/reseller/organizations/${organization.id}/credits`))
}

// Handle users
function handleUsers(organization: ResellerOrganization) {
  navigateTo(localePath(`/reseller/organizations/${organization.id}/users`))
}
</script>

<template>
  <div class="p-6 space-y-6">
    <!-- Breadcrumb -->
    <UBreadcrumb :items="breadcrumbItems" />

    <!-- Header -->
    <div class="flex items-center justify-between">
      <div>
        <h1 class="text-3xl font-bold text-gray-900 dark:text-white">
          {{ t('reseller.organizations.list.title') }}
        </h1>
        <p class="mt-1 text-gray-500 dark:text-gray-400">
          {{ t('reseller.organizations.list.subtitle') }}
        </p>
      </div>
      <UButton
        :to="localePath('/reseller/organizations/create')"
        color="primary"
        icon="i-lucide-plus"
      >
        {{ t('reseller.organizations.create.button') }}
      </UButton>
    </div>

    <!-- Filters -->
    <UCard>
      <div class="flex flex-wrap gap-4">
        <UInput
          v-model="search"
          icon="i-lucide-search"
          :placeholder="t('reseller.organizations.filters.searchPlaceholder')"
          class="w-full md:w-80"
        />
      </div>
    </UCard>

    <!-- Error -->
    <UAlert v-if="error" color="error" :title="t('common.error')">
      {{ error }}
    </UAlert>

    <!-- Table -->
    <UCard :ui="{ body: { padding: 'p-0' } }">
      <ResellerOrganizationTable
        :organizations="organizations"
        :loading="loading"
        @view="handleView"
        @credits="handleCredits"
        @users="handleUsers"
      />

      <!-- Empty state -->
      <div
        v-if="!loading && organizations.length === 0"
        class="py-12 text-center"
      >
        <div
          class="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-gray-100 dark:bg-gray-800"
        >
          <UIcon name="i-lucide-building-2" class="h-8 w-8 text-gray-400" />
        </div>
        <h3 class="mb-2 text-lg font-medium text-gray-900 dark:text-white">
          {{ t('reseller.organizations.list.noOrganizations') }}
        </h3>
        <p class="mb-4 text-gray-500">
          {{ t('reseller.organizations.list.noOrganizationsDescription') }}
        </p>
        <UButton
          :to="localePath('/reseller/organizations/create')"
          color="primary"
          icon="i-lucide-plus"
        >
          {{ t('reseller.organizations.create.button') }}
        </UButton>
      </div>

      <!-- Pagination -->
      <div
        v-if="pagination.lastPage > 1"
        class="flex justify-center p-4 border-t border-gray-200 dark:border-gray-700"
      >
        <UPagination
          :default-page="pagination.currentPage"
          :total="pagination.total"
          :items-per-page="pagination.perPage"
          @update:page="handlePageChange"
        />
      </div>
    </UCard>
  </div>
</template>
