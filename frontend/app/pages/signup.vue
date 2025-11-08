<template>
  <div class="flex h-full items-center justify-center">
    <div class="flex w-full max-w-md lg:p-8">
      <div class="mx-auto flex w-full flex-col justify-center space-y-6">
        <div class="flex flex-col space-y-2 text-center">
          <h1 class="text-2xl font-semibold tracking-tight">
            {{ $t('signup') }}
          </h1>
          <p class="text-sm text-muted-foreground">
            {{ $t('signupInstructions') }}
          </p>
        </div>

        <SignupForm :is-loading="isLoading" @submit="handleSignup" />

        <!-- Link to Login -->
        <div class="text-center text-sm">
          <span class="text-muted-foreground">{{ $t('alreadyHaveAccount') }}</span>
          <NuxtLink to="/login" class="ml-1 text-primary hover:underline">
            {{ $t('loginHere') }}
          </NuxtLink>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { navigateTo, useRuntimeConfig } from '#app'
import { toast } from '@/components/ui/toast'
import { useI18n } from 'vue-i18n'
import { definePageMeta } from '#imports'
import { useApi } from '@/composables/useApi'

const { t } = useI18n()
const isLoading = ref(false)

interface SignupData {
  fullName: string
  email: string
  password: string
  confirmPassword: string
  organizationName: string
  logo: File | null
}

const handleSignup = async (data: SignupData) => {
  isLoading.value = true

  try {
    const formData = new FormData()

    // Prepare user data
    const userData = {
      fullName: data.fullName,
      email: data.email,
      password: data.password,
      role: 1, // Owner role
      isOwner: true,
    }

    // Prepare organization data
    const organizationData = {
      name: data.organizationName,
      email: data.email,
    }

    // Append as JSON strings (backend expects this format)
    formData.append('user', JSON.stringify(userData))
    formData.append('organization', JSON.stringify(organizationData))

    // Append logo if provided
    if (data.logo) {
      formData.append('logo', data.logo)
    }

    // Send to backend
    const config = useRuntimeConfig()
    const response = await fetch(`${config.public.apiUrl}/signup`, {
      method: 'POST',
      body: formData,
    })

    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.message || 'Erreur lors de l\'inscription')
    }

    // Success
    toast({
      title: t('signupSuccess'),
      description: t('checkYourEmail'),
    })

    // Redirect to waiting verification page
    navigateTo('/waiting-verification')
  } catch (error: any) {
    toast({
      title: t('signupError'),
      description: error.message || t('tryAgainLater'),
      variant: 'destructive',
    })
  } finally {
    isLoading.value = false
  }
}

definePageMeta({
  layout: 'visitor',
})
</script>
