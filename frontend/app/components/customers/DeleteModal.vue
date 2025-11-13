<script setup lang="ts">
const { t } = useI18n();

const props = withDefaults(
  defineProps<{
    count?: number;
  }>(),
  {
    count: 0,
  },
);

const open = ref(false);

const title = computed(() =>
  props.count > 1
    ? t('components.customers.deleteModal.titlePlural', { count: props.count })
    : t('components.customers.deleteModal.title', { count: props.count })
);

async function onSubmit() {
  await new Promise((resolve) => setTimeout(resolve, 1000));
  open.value = false;
}
</script>

<template>
  <UModal
    v-model:open="open"
    :title="title"
    :description="t('components.customers.deleteModal.description')"
  >
    <slot />

    <template #body>
      <div class="flex justify-end gap-2">
        <UButton
          :label="t('common.buttons.cancel')"
          color="neutral"
          variant="subtle"
          @click="open = false"
        />
        <UButton
          :label="t('common.buttons.delete')"
          color="error"
          variant="solid"
          loading-auto
          @click="onSubmit"
        />
      </div>
    </template>
  </UModal>
</template>
