<script setup lang="ts">
import type { ResellerOrganization, OrganizationUser, AddUserPayload, UsersFilters } from '~/types/reseller'

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
  { label: t('reseller.users.management.title'), icon: 'i-lucide-users' },
])

useSeoMeta({
  title: t('reseller.users.management.title'),
})

// Composables
const { fetchOrganization, fetchUsers, addUser, removeUser, resendInvitation, loading, error } =
  useResellerOrganizations()

// State
const organization = ref<ResellerOrganization | null>(null)
const users = ref<OrganizationUser[]>([])
const pagination = ref({
  total: 0,
  perPage: 20,
  currentPage: 1,
  lastPage: 1,
})

// Modal state
const showAddModal = ref(false)
const showDeleteModal = ref(false)
const userToDelete = ref<OrganizationUser | null>(null)
const addingUser = ref(false)
const deletingUser = ref(false)
const resendingInvitation = ref(false)

// Load data
onMounted(async () => {
  await loadData()
})

async function loadData() {
  const [orgData, usersData] = await Promise.all([
    fetchOrganization(organizationId.value),
    fetchUsers(organizationId.value),
  ])

  if (orgData) {
    organization.value = orgData
  }
  if (usersData) {
    users.value = usersData.data
    pagination.value = {
      total: usersData.meta.total,
      perPage: usersData.meta.perPage,
      currentPage: usersData.meta.currentPage,
      lastPage: usersData.meta.lastPage,
    }
  }
}

async function loadUsers(page = 1) {
  const filters: UsersFilters = {
    page,
    limit: pagination.value.perPage,
  }

  const response = await fetchUsers(organizationId.value, filters)
  if (response) {
    users.value = response.data
    pagination.value = {
      total: response.meta.total,
      perPage: response.meta.perPage,
      currentPage: response.meta.currentPage,
      lastPage: response.meta.lastPage,
    }
  }
}

async function handleAddUser(data: AddUserPayload) {
  addingUser.value = true
  try {
    const result = await addUser(organizationId.value, data)
    if (result) {
      toast.add({
        title: t('reseller.users.add.success'),
        color: 'success',
      })
      showAddModal.value = false
      await loadUsers(pagination.value.currentPage)
    }
  } catch (e) {
    toast.add({
      title: error.value || t('reseller.users.add.error'),
      color: 'error',
    })
  } finally {
    addingUser.value = false
  }
}

function openDeleteModal(user: OrganizationUser) {
  userToDelete.value = user
  showDeleteModal.value = true
}

async function confirmDelete() {
  if (!userToDelete.value) return

  deletingUser.value = true
  try {
    const success = await removeUser(organizationId.value, userToDelete.value.id)
    if (success) {
      toast.add({
        title: t('reseller.users.delete.success'),
        color: 'success',
      })
      showDeleteModal.value = false
      userToDelete.value = null
      await loadUsers(pagination.value.currentPage)
    }
  } catch (e) {
    toast.add({
      title: error.value || t('reseller.users.delete.error'),
      color: 'error',
    })
  } finally {
    deletingUser.value = false
  }
}

function handlePageChange(page: number) {
  loadUsers(page)
}

async function handleResendInvitation(user: OrganizationUser) {
  resendingInvitation.value = true
  try {
    const result = await resendInvitation(organizationId.value, user.id)
    if (result) {
      toast.add({
        title: t('reseller.users.resend.success'),
        color: 'success',
      })
      // Refresh the users list to get updated lastInvitationSentAt
      await loadUsers(pagination.value.currentPage)
    }
  } catch (e: unknown) {
    // Check if it's a rate limit error
    const errorData = (e as { data?: { code?: string } })?.data
    if (errorData?.code === 'INVITATION_RATE_LIMIT') {
      toast.add({
        title: t('reseller.users.resend.rateLimited'),
        color: 'warning',
      })
    } else {
      toast.add({
        title: error.value || t('reseller.users.resend.error'),
        color: 'error',
      })
    }
  } finally {
    resendingInvitation.value = false
  }
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
          {{ t('reseller.users.management.title') }}
        </h1>
        <p v-if="organization" class="mt-1 text-gray-500 dark:text-gray-400">
          {{ organization.name }}
        </p>
      </div>
      <UButton color="primary" icon="i-lucide-user-plus" @click="showAddModal = true">
        {{ t('reseller.users.add.button') }}
      </UButton>
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
      <UCard :ui="{ body: 'p-0' }">
        <ResellerUserTable
          :users="users"
          :loading="loading || resendingInvitation"
          @delete="openDeleteModal"
          @resend="handleResendInvitation"
        />

        <!-- Empty state -->
        <div v-if="!loading && users.length === 0" class="py-12 text-center">
          <div
            class="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-gray-100 dark:bg-gray-800"
          >
            <UIcon name="i-lucide-users" class="h-8 w-8 text-gray-400" />
          </div>
          <h3 class="mb-2 text-lg font-medium text-gray-900 dark:text-white">
            {{ t('reseller.users.management.noUsers') }}
          </h3>
          <p class="mb-4 text-gray-500">
            {{ t('reseller.users.management.noUsersDescription') }}
          </p>
          <UButton color="primary" icon="i-lucide-user-plus" @click="showAddModal = true">
            {{ t('reseller.users.add.button') }}
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
    </template>

    <!-- Add User Modal -->
    <UModal v-model:open="showAddModal">
      <template #header>
        <h2 class="text-lg font-semibold">{{ t('reseller.users.add.title') }}</h2>
      </template>
      <template #body>
        <p class="mb-4 text-sm text-gray-500">
          {{ t('reseller.users.add.description') }}
        </p>
        <ResellerUserForm
          :loading="addingUser"
          @submit="handleAddUser"
          @cancel="showAddModal = false"
        />
      </template>
    </UModal>

    <!-- Delete User Modal -->
    <ResellerUserDeleteModal
      v-model:open="showDeleteModal"
      :user="userToDelete"
      @confirm="confirmDelete"
    />
  </div>
</template>
