<template>
  <div>
    <form @submit.prevent="onSubmit" class="w-full space-y-4">
      <!-- Full Name -->
      <div class="space-y-2">
        <label for="fullName" class="text-sm font-medium">{{ t('fullName') }}</label>
        <Input
          id="fullName"
          v-model="formData.fullName"
          type="text"
          :placeholder="t('fullNamePlaceholder')"
          required
        />
      </div>

      <!-- Email -->
      <div class="space-y-2">
        <label for="email" class="text-sm font-medium">{{ t('email') }}</label>
        <Input
          id="email"
          v-model="formData.email"
          type="email"
          :placeholder="t('emailPlaceholder')"
          required
        />
      </div>

      <!-- Password -->
      <div class="space-y-2">
        <label for="password" class="text-sm font-medium">{{ t('password') }}</label>
        <Input
          id="password"
          v-model="formData.password"
          type="password"
          :placeholder="t('passwordPlaceholder')"
          required
        />
      </div>

      <!-- Confirm Password -->
      <div class="space-y-2">
        <label for="confirmPassword" class="text-sm font-medium">{{ t('confirmPassword') }}</label>
        <Input
          id="confirmPassword"
          v-model="formData.confirmPassword"
          type="password"
          :placeholder="t('confirmPasswordPlaceholder')"
          required
        />
      </div>

      <!-- Organization Name -->
      <div class="space-y-2">
        <label for="organizationName" class="text-sm font-medium">{{ t('organizationName') }}</label>
        <Input
          id="organizationName"
          v-model="formData.organizationName"
          type="text"
          :placeholder="t('organizationNamePlaceholder')"
          required
        />
      </div>

      <!-- Logo Upload -->
      <div class="space-y-2">
        <label for="logo" class="text-sm font-medium">{{ t('logo') }}</label>
        <Input
          id="logo"
          type="file"
          accept="image/*"
          @change="handleLogoChange"
        />
        <p class="text-xs text-muted-foreground">{{ t('logoOptional') }}</p>
      </div>

      <!-- Submit Button -->
      <Button type="submit" :disabled="props.isLoading" class="w-full">
        <template v-if="props.isLoading">
          <ReloadIcon class="mr-2 h-4 w-4 animate-spin" />
          {{ t('pleaseWait') }}
        </template>
        <template v-else>
          {{ t('createAccount') }}
        </template>
      </Button>
    </form>
  </div>
</template>

<script setup lang="ts">
import { ReloadIcon } from '@radix-icons/vue'
import { ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'

const { t } = useI18n()

const props = defineProps<{
  isLoading: boolean
}>()

const emit = defineEmits(['submit'])

const formData = ref({
  fullName: '',
  email: '',
  password: '',
  confirmPassword: '',
  organizationName: '',
  logo: null as File | null,
})

const handleLogoChange = (event: Event) => {
  const target = event.target as HTMLInputElement
  if (target.files && target.files[0]) {
    formData.value.logo = target.files[0]
  }
}

const onSubmit = () => {
  // Validation
  if (formData.value.password !== formData.value.confirmPassword) {
    alert(t('passwordsMustMatch'))
    return
  }

  if (formData.value.password.length < 8) {
    alert(t('passwordMinLength'))
    return
  }

  emit('submit', formData.value)
}
</script>
