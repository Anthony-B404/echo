<script setup lang="ts">
import * as z from 'zod'
import type { FormSubmitEvent } from '@nuxt/ui'

definePageMeta({
  middleware: ['auth', 'pending-deletion', 'organization-status']
})

const { t } = useI18n()

useSeoMeta({
  title: t('seo.settingsGeneral.title'),
  description: t('seo.settingsGeneral.description')
})

const authStore = useAuthStore()
const toast = useToast()
const api = useApi()
const { getAvatarUrl } = useAvatarUrl()

const fileRef = ref<HTMLInputElement>()

const profileSchema = z.object({
  firstName: z
    .string()
    .min(2, t('pages.dashboard.settings.general.validation.firstNameTooShort')),
  lastName: z
    .string()
    .min(2, t('pages.dashboard.settings.general.validation.lastNameTooShort')),
  email: z
    .string()
    .email(t('pages.dashboard.settings.general.validation.invalidEmail')),
  avatar: z.string().optional()
})

type ProfileSchema = z.output<typeof profileSchema>;

// Initialize state with user data from store
const profile = reactive<ProfileSchema>({
  firstName: authStore.user?.firstName || '',
  lastName: authStore.user?.lastName || '',
  email: authStore.user?.email || '',
  avatar: authStore.user?.avatar || undefined
})

const loading = ref(false)
const avatarRemoved = ref(false)

async function onSubmit (event: FormSubmitEvent<ProfileSchema>) {
  loading.value = true
  try {
    const formData = new FormData()

    // Add text fields if they changed
    if (event.data.firstName !== authStore.user?.firstName) {
      formData.append('firstName', event.data.firstName)
    }
    if (event.data.lastName !== authStore.user?.lastName) {
      formData.append('lastName', event.data.lastName)
    }
    if (event.data.email !== authStore.user?.email) {
      formData.append('email', event.data.email)
    }

    // Add avatar removal flag
    if (avatarRemoved.value) {
      formData.append('removeAvatar', 'true')
    }

    // Add avatar if file was selected
    const avatarFile = fileRef.value?.files?.[0]
    if (avatarFile) {
      formData.append('avatar', avatarFile)
    }

    // Only send request if there are changes
    if (Array.from(formData.keys()).length > 0) {
      const response = await api<{ message: string; user: { firstName: string; lastName: string; email: string; avatar?: string } }>('/profile', {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${authStore.token}`
        },
        body: formData
      })

      // Update user in store - merge updated fields into existing user
      if (authStore.user) {
        authStore.user.firstName = response.user.firstName
        authStore.user.lastName = response.user.lastName
        authStore.user.email = response.user.email
        authStore.user.avatar = response.user.avatar ?? null
      }

      // Update local state with new data
      profile.firstName = response.user.firstName
      profile.lastName = response.user.lastName
      profile.email = response.user.email
      profile.avatar = response.user.avatar
      avatarRemoved.value = false

      toast.add({
        title: t('pages.dashboard.settings.general.successTitle'),
        description: response.message,
        icon: 'i-lucide-check',
        color: 'success'
      })
    } else {
      toast.add({
        title: t('pages.dashboard.settings.general.noChangesTitle'),
        description: t('pages.dashboard.settings.general.noChangesDescription'),
        icon: 'i-lucide-info',
        color: 'neutral'
      })
    }
  } catch (error: unknown) {
    const apiError = error as { data?: { message?: string } }
    toast.add({
      title: t('pages.dashboard.settings.general.errorTitle'),
      description:
        apiError.data?.message ||
        t('pages.dashboard.settings.general.errorDescription'),
      icon: 'i-lucide-x',
      color: 'error'
    })
  } finally {
    loading.value = false
  }
}

function onFileChange (e: Event) {
  const input = e.target as HTMLInputElement

  if (!input.files?.length) {
    return
  }

  profile.avatar = URL.createObjectURL(input.files[0]!)
  avatarRemoved.value = false
}

function onFileClick () {
  fileRef.value?.click()
}

function onRemoveAvatar () {
  profile.avatar = undefined
  avatarRemoved.value = true
  // Clear file input
  if (fileRef.value) {
    fileRef.value.value = ''
  }
}

// Compute full name for display
const fullName = computed(() => {
  return `${profile.firstName} ${profile.lastName}`.trim()
})
</script>

<template>
  <UForm
    id="settings"
    :schema="profileSchema"
    :state="profile"
    @submit="onSubmit"
  >
    <UPageCard
      :title="t('pages.dashboard.settings.general.title')"
      :description="t('pages.dashboard.settings.general.description')"
      variant="naked"
      orientation="horizontal"
      class="mb-4"
    >
      <UButton
        form="settings"
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
        name="firstName"
        :label="t('pages.dashboard.settings.general.firstNameLabel')"
        :description="
          t('pages.dashboard.settings.general.firstNameDescription')
        "
        required
        class="flex items-start justify-between gap-4 max-sm:flex-col"
      >
        <UInput v-model="profile.firstName" autocomplete="given-name" />
      </UFormField>
      <USeparator />
      <UFormField
        name="lastName"
        :label="t('pages.dashboard.settings.general.lastNameLabel')"
        :description="t('pages.dashboard.settings.general.lastNameDescription')"
        required
        class="flex items-start justify-between gap-4 max-sm:flex-col"
      >
        <UInput v-model="profile.lastName" autocomplete="family-name" />
      </UFormField>
      <USeparator />
      <UFormField
        name="email"
        :label="t('pages.dashboard.settings.general.emailLabel')"
        :description="t('pages.dashboard.settings.general.emailDescription')"
        required
        class="flex items-start justify-between gap-4 max-sm:flex-col"
      >
        <UInput
          v-model="profile.email"
          type="email"
          autocomplete="off"
          class="min-w-0 w-full sm:min-w-[225px]"
        />
      </UFormField>
      <USeparator />
      <UFormField
        name="avatar"
        :label="t('pages.dashboard.settings.general.avatarLabel')"
        :description="t('pages.dashboard.settings.general.avatarDescription')"
        class="flex justify-between gap-4 max-sm:flex-col sm:items-center"
      >
        <div class="flex flex-wrap items-center gap-3">
          <UAvatar :src="getAvatarUrl(profile.avatar)" :alt="fullName" size="lg" />
          <UButton
            :label="t('common.buttons.choose')"
            color="neutral"
            @click="onFileClick"
          />
          <UButton
            v-if="profile.avatar"
            :label="t('pages.dashboard.settings.general.removeAvatar')"
            color="error"
            variant="ghost"
            @click="onRemoveAvatar"
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
    </UPageCard>
  </UForm>
</template>
