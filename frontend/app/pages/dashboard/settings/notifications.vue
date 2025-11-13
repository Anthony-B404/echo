<script setup lang="ts">
const { t } = useI18n();

const state = reactive<{ [key: string]: boolean }>({
  email: true,
  desktop: false,
  product_updates: true,
  weekly_digest: false,
  important_updates: true,
});

const sections = computed(() => [
  {
    title: t('pages.dashboard.settings.notifications.channels.title'),
    description: t('pages.dashboard.settings.notifications.channels.description'),
    fields: [
      {
        name: "email",
        label: t('pages.dashboard.settings.notifications.channels.email.label'),
        description: t('pages.dashboard.settings.notifications.channels.email.description'),
      },
      {
        name: "desktop",
        label: t('pages.dashboard.settings.notifications.channels.desktop.label'),
        description: t('pages.dashboard.settings.notifications.channels.desktop.description'),
      },
    ],
  },
  {
    title: t('pages.dashboard.settings.notifications.accountUpdates.title'),
    description: t('pages.dashboard.settings.notifications.accountUpdates.description'),
    fields: [
      {
        name: "weekly_digest",
        label: t('pages.dashboard.settings.notifications.accountUpdates.weeklyDigest.label'),
        description: t('pages.dashboard.settings.notifications.accountUpdates.weeklyDigest.description'),
      },
      {
        name: "product_updates",
        label: t('pages.dashboard.settings.notifications.accountUpdates.productUpdates.label'),
        description: t('pages.dashboard.settings.notifications.accountUpdates.productUpdates.description'),
      },
      {
        name: "important_updates",
        label: t('pages.dashboard.settings.notifications.accountUpdates.importantUpdates.label'),
        description: t('pages.dashboard.settings.notifications.accountUpdates.importantUpdates.description'),
      },
    ],
  },
]);

async function onChange() {
  // Do something with data
  console.log(state);
}
</script>

<template>
  <div v-for="(section, index) in sections" :key="index">
    <UPageCard
      :title="section.title"
      :description="section.description"
      variant="naked"
      class="mb-4"
    />

    <UPageCard variant="subtle" :ui="{ container: 'divide-y divide-default' }">
      <UFormField
        v-for="field in section.fields"
        :key="field.name"
        :name="field.name"
        :label="field.label"
        :description="field.description"
        class="flex items-center justify-between gap-2 not-last:pb-4"
      >
        <USwitch v-model="state[field.name]" @update:model-value="onChange" />
      </UFormField>
    </UPageCard>
  </div>
</template>
