<script setup lang="ts">
import { z } from 'zod'

const props = defineProps<{
  audioId: number
  audioTitle: string
}>()

const open = defineModel<boolean>('open', { default: false })

const { t } = useI18n()
const toast = useToast()
const { authenticatedFetch } = useAuth()

const email = ref('')
const loading = ref(false)

const emailSchema = z.string().email()

const isEmailValid = computed(() => {
  if (!email.value) return false
  try {
    emailSchema.parse(email.value)
    return true
  } catch {
    return false
  }
})

async function handleShare() {
  if (!isEmailValid.value) {
    toast.add({
      title: t('components.workshop.shareModal.validation.invalidEmail'),
      color: 'error',
    })
    return
  }

  loading.value = true
  try {
    await authenticatedFetch(`/audios/${props.audioId}/share`, {
      method: 'POST',
      body: { email: email.value },
    })

    toast.add({
      title: t('components.workshop.shareModal.success'),
      color: 'success',
    })

    email.value = ''
    open.value = false
  } catch (error: any) {
    toast.add({
      title: t('components.workshop.shareModal.error'),
      description: error?.data?.message || error?.message,
      color: 'error',
    })
  } finally {
    loading.value = false
  }
}

watch(open, (isOpen) => {
  if (!isOpen) {
    email.value = ''
    loading.value = false
  }
})
</script>

<template>
  <UModal
    v-model:open="open"
    :title="t('components.workshop.shareModal.title')"
    :ui="{ footer: 'justify-end' }"
  >
    <template #body>
      <p class="text-muted text-sm mb-4">
        {{ t('components.workshop.shareModal.description') }}
      </p>

      <UFormField
        :label="t('components.workshop.shareModal.emailLabel')"
        class="w-full"
      >
        <UInput
          v-model="email"
          type="email"
          :placeholder="t('components.workshop.shareModal.emailPlaceholder')"
          :disabled="loading"
          class="w-full"
          @keydown.enter="handleShare"
        />
      </UFormField>
    </template>

    <template #footer>
      <UButton
        :label="t('common.buttons.cancel')"
        color="neutral"
        variant="outline"
        :disabled="loading"
        @click="open = false"
      />
      <UButton
        :label="t('components.workshop.shareModal.send')"
        color="primary"
        :loading="loading"
        :disabled="!isEmailValid"
        @click="handleShare"
      />
    </template>
  </UModal>
</template>
