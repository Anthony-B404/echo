<script setup lang="ts">
const { t } = useI18n()
const localePath = useLocalePath()
const cookie = useCookie('cookie-consent')

const isVisible = computed(() => cookie.value !== 'accepted' && cookie.value !== 'declined')

function accept() {
  cookie.value = 'accepted'
}

function decline() {
  cookie.value = 'declined'
}
</script>

<template>
  <UBanner
    v-if="isVisible"
    :title="t('layouts.default.cookies.title')"
    icon="i-lucide-cookie"
    color="neutral"
    :close="false"
    :actions="[
      { label: t('layouts.default.cookies.accept'), color: 'primary' as const, onClick: accept },
      { label: t('layouts.default.cookies.optOut'), color: 'neutral' as const, variant: 'outline' as const, onClick: decline },
      { label: t('layouts.default.cookies.learnMore'), color: 'neutral' as const, variant: 'outline' as const, to: localePath('/cookies-policy') }
    ]"
  />
</template>
