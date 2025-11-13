<script setup lang="ts">
import type { NuxtError } from "#app";

const { t } = useI18n();

defineProps<{
  error: NuxtError;
}>();

useSeoMeta({
  title: t('seo.error.title'),
  description: t('seo.error.description'),
});

useHead({
  htmlAttrs: {
    lang: "en",
  },
});
</script>

<template>
  <UApp>
    <UError :error="error" />
  </UApp>
</template>
