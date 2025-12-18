<script setup lang="ts">
const model = defineModel<string>({ default: "" });

defineProps<{
  disabled?: boolean;
}>();

const { t } = useI18n();

const promptExamples = [
  "pages.dashboard.analyze.examples.summary",
  "pages.dashboard.analyze.examples.keyPoints",
  "pages.dashboard.analyze.examples.participants",
  "pages.dashboard.analyze.examples.sentiment",
];

function useExample(key: string) {
  model.value = t(key);
}
</script>

<template>
  <div class="space-y-4">
    <UTextarea
      v-model="model"
      :placeholder="t('pages.dashboard.analyze.promptPlaceholder')"
      :disabled="disabled"
      :rows="5"
      autoresize
      class="w-full"
    />

    <!-- Example Prompts -->
    <div class="space-y-2">
      <p class="text-xs text-muted font-medium">
        {{ t("pages.dashboard.analyze.examplesTitle") }}
      </p>
      <div class="flex flex-wrap gap-2">
        <UButton
          v-for="example in promptExamples"
          :key="example"
          :label="t(example)"
          size="xs"
          variant="soft"
          color="neutral"
          :disabled="disabled"
          @click="useExample(example)"
        />
      </div>
    </div>
  </div>
</template>
