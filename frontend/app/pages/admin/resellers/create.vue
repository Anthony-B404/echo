<script setup lang="ts">
import type { CreateResellerPayload } from '~/types/admin'
import { getErrorMessage } from '~/utils/errors'

definePageMeta({
  layout: 'admin',
  middleware: ['auth', 'admin'],
})

const { t } = useI18n()
const localePath = useLocalePath()
const toast = useToast()

useSeoMeta({
  title: t('admin.resellers.create.title'),
})

const { createReseller, loading } = useResellers()

async function handleSubmit(data: CreateResellerPayload) {
  try {
    // Build payload, excluding empty optional fields
    const payload: CreateResellerPayload = {
      name: data.name,
      email: data.email,
      company: data.company,
    }
    if (data.phone) payload.phone = data.phone
    if (data.siret) payload.siret = data.siret
    if (data.address) payload.address = data.address
    if (data.notes) payload.notes = data.notes
    if (data.initialCredits) payload.initialCredits = data.initialCredits

    const result = await createReseller(payload)
    if (result) {
      toast.add({
        title: t('admin.resellers.create.success'),
        description: t('admin.resellers.create.successDescription'),
        color: 'success',
      })
      navigateTo(localePath(`/admin/resellers/${result.reseller.id}`))
    }
  } catch (e: unknown) {
    toast.add({
      title: t('admin.resellers.create.error'),
      description: getErrorMessage(e, t('admin.resellers.create.errorDescription')),
      color: 'error',
    })
  }
}

function handleCancel() {
  navigateTo(localePath('/admin/resellers'))
}
</script>

<template>
  <div class="p-6">
    <!-- Header -->
    <div class="mb-6">
      <UButton
        :to="localePath('/admin/resellers')"
        color="neutral"
        variant="ghost"
        icon="i-lucide-arrow-left"
        class="mb-4"
      >
        {{ t('common.buttons.back') }}
      </UButton>
      <h1 class="text-3xl font-bold text-gray-900 dark:text-white">
        {{ t('admin.resellers.create.title') }}
      </h1>
      <p class="mt-1 text-gray-500 dark:text-gray-400">
        {{ t('admin.resellers.create.subtitle') }}
      </p>
    </div>

    <!-- Form -->
    <UCard>
      <AdminResellerForm
        mode="create"
        :loading="loading"
        @submit="handleSubmit"
        @cancel="handleCancel"
      />
    </UCard>
  </div>
</template>
