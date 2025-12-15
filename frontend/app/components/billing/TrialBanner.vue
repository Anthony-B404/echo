<script setup lang="ts">
const props = defineProps<{
  daysRemaining: number;
  trialEndsAt: string | null;
}>();

const { t } = useI18n();
const localePath = useLocalePath();

// Simple session-based dismissal - reappears on next page load
const dismissed = ref(false);

const handleDismiss = () => {
  dismissed.value = true;
};
</script>

<template>
  <div v-if="!dismissed" class="px-2 py-2">
    <UAlert
      :title="t('components.trialBanner.title')"
      :description="
        t('components.trialBanner.description', { days: daysRemaining })
      "
      icon="i-lucide-clock"
      variant="outline"
      close
      :actions="[
        {
          label: t('components.trialBanner.subscribe'),
          to: localePath('/dashboard/settings/billing'),
        },
      ]"
      @update:open="handleDismiss"
    />
  </div>
</template>
