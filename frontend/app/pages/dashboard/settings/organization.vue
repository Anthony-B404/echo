<script setup lang="ts">
import * as z from 'zod'
import type { FormSubmitEvent } from '@nuxt/ui'
import type { BusinessSector } from '~/types/reseller'

definePageMeta({
  middleware: ['auth', 'pending-deletion', 'organization-status']
})

const { t } = useI18n()

useSeoMeta({
  title: t('seo.settingsOrganization.title'),
  description: t('seo.settingsOrganization.description')
})

const organizationStore = useOrganizationStore()
const config = useRuntimeConfig()
const toast = useToast()
const localePath = useLocalePath()
const { canAccessOrganization } = useSettingsPermissions()
const { sectorOptions } = useBusinessSectors()

// Redirect if not authorized (Owner only) - wait for org data to load
const hasRedirected = ref(false)
watch(
  () => ({
    canAccess: canAccessOrganization.value,
    orgLoaded: organizationStore.currentOrganization !== null
  }),
  ({ canAccess, orgLoaded }) => {
    if (orgLoaded && canAccess === false && !hasRedirected.value) {
      hasRedirected.value = true
      toast.add({
        title: t('common.errors.accessDenied'),
        icon: 'i-lucide-shield-x',
        color: 'error'
      })
      navigateTo(localePath('/dashboard/settings'), { replace: true })
    }
  },
  { immediate: true }
)

const fileRef = ref<HTMLInputElement>()

const organizationSchema = z.object({
  name: z
    .string()
    .min(2, t('pages.dashboard.settings.organization.validation.nameTooShort')),
  email: z
    .string()
    .email(t('pages.dashboard.settings.organization.validation.invalidEmail')),
  logo: z.string().optional(),
  // Sectors are validated dynamically from API - backend performs final validation
  businessSectors: z.array(z.string()).optional()
})

type OrganizationSchema = z.output<typeof organizationSchema>;

// Initialize state with organization data from store
const organization = reactive<OrganizationSchema>({
  name: organizationStore.organization?.name || '',
  email: organizationStore.organization?.email || '',
  logo: organizationStore.organization?.logo || undefined,
  businessSectors: (organizationStore.organization?.businessSectors || []) as BusinessSector[]
})

const loading = ref(false)
const logoRemoved = ref(false)

// Watch for organization changes (when switching organizations)
watch(
  () => organizationStore.organization,
  (newOrg) => {
    if (newOrg) {
      organization.name = newOrg.name || ''
      organization.email = newOrg.email || ''
      organization.logo = newOrg.logo || undefined
      organization.businessSectors = (newOrg.businessSectors || []) as BusinessSector[]
      logoRemoved.value = false
    }
  },
  { deep: true }
)

// Ensure organization data is loaded on mount
onMounted(async () => {
  if (!organizationStore.organization) {
    await organizationStore.fetchOrganization()
  }
})

async function onSubmit (event: FormSubmitEvent<OrganizationSchema>) {
  loading.value = true
  try {
    const formData = new FormData()

    // Add text fields if they changed
    if (event.data.name !== organizationStore.organization?.name) {
      formData.append('name', event.data.name)
    }
    if (event.data.email !== organizationStore.organization?.email) {
      formData.append('email', event.data.email)
    }

    // Add business sectors if they changed
    const currentSectors = organizationStore.organization?.businessSectors || []
    const newSectors = event.data.businessSectors || []
    if (JSON.stringify(currentSectors) !== JSON.stringify(newSectors)) {
      formData.append('businessSectors', JSON.stringify(newSectors))
    }

    // Add logo removal flag
    if (logoRemoved.value) {
      formData.append('removeLogo', 'true')
    }

    // Add logo if file was selected
    const fileInput = fileRef.value
    const logoFile = fileInput?.files?.[0]
    if (logoFile) {
      formData.append('logo', logoFile)
    }

    // Only send request if there are changes
    if (Array.from(formData.keys()).length > 0) {
      const { authenticatedFetch } = useAuth()
      const response = await authenticatedFetch<{
        name: string;
        email: string;
        logo: string | null;
      }>('/organization/update', {
        method: 'PUT',
        body: formData
      })

      // Update organization in store
      await Promise.all([
        organizationStore.fetchOrganization(),
        organizationStore.fetchUserOrganizations()
      ])

      // Update local state with new data
      organization.name = response.name
      organization.email = response.email
      organization.logo = response.logo || undefined
      logoRemoved.value = false

      toast.add({
        title: t('pages.dashboard.settings.organization.successTitle'),
        description: t(
          'pages.dashboard.settings.organization.successDescription'
        ),
        icon: 'i-lucide-check',
        color: 'success'
      })
    } else {
      toast.add({
        title: t('pages.dashboard.settings.organization.noChangesTitle'),
        description: t(
          'pages.dashboard.settings.organization.noChangesDescription'
        ),
        icon: 'i-lucide-info',
        color: 'neutral'
      })
    }
  } catch (error: unknown) {
    const apiError = error as { data?: { message?: string } }
    toast.add({
      title: t('pages.dashboard.settings.organization.errorTitle'),
      description:
        apiError.data?.message ||
        t('pages.dashboard.settings.organization.errorDescription'),
      icon: 'i-lucide-x',
      color: 'error'
    })
  } finally {
    loading.value = false
  }
}

function onFileChange (e: Event) {
  const input = e.target as HTMLInputElement
  const file = input.files?.[0]

  if (!file) {
    return
  }

  organization.logo = URL.createObjectURL(file)
  logoRemoved.value = false
}

function onFileClick () {
  fileRef.value?.click()
}

function onRemoveLogo () {
  organization.logo = undefined
  logoRemoved.value = true
  // Clear file input
  if (fileRef.value) {
    fileRef.value.value = ''
  }
}

// Get logo URL with smart detection
const logoUrl = computed(() => {
  if (!organization.logo) { return undefined }

  // If it's already a full URL (unlikely for organization logo), use it directly
  if (
    organization.logo.startsWith('http://') ||
    organization.logo.startsWith('https://')
  ) {
    return organization.logo
  }

  // If it's a blob URL (local preview), use it directly
  if (organization.logo.startsWith('blob:')) {
    return organization.logo
  }

  // Otherwise, it's an uploaded file - construct backend URL
  return `${config.public.apiUrl}/${organization.logo}`
})

// Compute organization name for display
const organizationName = computed(() => {
  return organization.name.trim()
})
</script>

<template>
  <UForm
    id="organization-settings"
    :schema="organizationSchema"
    :state="organization"
    @submit="onSubmit"
  >
    <UPageCard
      :title="t('pages.dashboard.settings.organization.title')"
      :description="t('pages.dashboard.settings.organization.description')"
      variant="naked"
      orientation="horizontal"
      class="mb-4"
    >
      <UButton
        form="organization-settings"
        :label="t('common.buttons.saveChanges')"
        :loading="loading"
        :disabled="loading"
        color="neutral"
        type="submit"
        class="w-fit lg:ms-auto"
      />
    </UPageCard>

    <UPageCard variant="subtle">
      <UFormField
        name="name"
        :label="t('pages.dashboard.settings.organization.nameLabel')"
        :description="
          t('pages.dashboard.settings.organization.nameDescription')
        "
        required
        class="flex items-start justify-between gap-4 max-sm:flex-col"
      >
        <UInput v-model="organization.name" autocomplete="organization" />
      </UFormField>
      <USeparator />
      <UFormField
        name="email"
        :label="t('pages.dashboard.settings.organization.emailLabel')"
        :description="
          t('pages.dashboard.settings.organization.emailDescription')
        "
        required
        class="flex items-start justify-between gap-4 max-sm:flex-col"
      >
        <UInput
          v-model="organization.email"
          type="email"
          autocomplete="off"
          class="min-w-0 w-full sm:min-w-[225px]"
        />
      </UFormField>
      <USeparator />
      <UFormField
        name="logo"
        :label="t('pages.dashboard.settings.organization.logoLabel')"
        :description="
          t('pages.dashboard.settings.organization.logoDescription')
        "
        class="flex justify-between gap-4 max-sm:flex-col sm:items-center"
      >
        <div class="flex flex-wrap items-center gap-3">
          <UAvatar :src="logoUrl" :alt="organizationName" size="lg" />
          <UButton
            :label="t('common.buttons.choose')"
            color="neutral"
            @click="onFileClick"
          />
          <UButton
            v-if="organization.logo"
            :label="t('pages.dashboard.settings.organization.removeLogo')"
            color="error"
            variant="ghost"
            @click="onRemoveLogo"
          />
          <input
            ref="fileRef"
            type="file"
            class="hidden"
            accept=".jpg, .jpeg, .png, .gif"
            @change="onFileChange"
          >
        </div>
      </UFormField>
      <USeparator />
      <UFormField
        name="businessSectors"
        :label="t('pages.dashboard.settings.organization.businessSectorsLabel')"
        :description="t('pages.dashboard.settings.organization.businessSectorsDescription')"
        class="flex justify-between gap-4 max-sm:flex-col sm:items-start"
      >
        <UInputMenu
          v-model="organization.businessSectors"
          :items="sectorOptions"
          multiple
          value-key="value"
          :placeholder="t('pages.dashboard.settings.organization.businessSectorsPlaceholder')"
          class="w-full max-w-full sm:max-w-md"
        />
      </UFormField>
    </UPageCard>
  </UForm>
</template>
