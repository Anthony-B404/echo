<script setup lang="ts">
defineProps<{
  transcription: string;
  analysis: string;
}>();

const { t } = useI18n();
const toast = useToast();

const activeTab = ref("analysis");

async function copyToClipboard(text: string) {
  try {
    await navigator.clipboard.writeText(text);
    toast.add({
      title: t("common.messages.copiedToClipboard"),
      color: "success",
    });
  } catch {
    toast.add({
      title: t("common.messages.error"),
      color: "error",
    });
  }
}

function downloadAsText(content: string, filename: string) {
  const blob = new Blob([content], { type: "text/plain;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
</script>

<template>
  <UCard>
    <template #header>
      <div class="flex items-center justify-between">
        <div class="flex items-center gap-2">
          <UIcon name="i-lucide-file-text" class="w-5 h-5" />
          <span class="font-medium">{{ t("pages.dashboard.analyze.resultTitle") }}</span>
        </div>

        <div class="flex items-center gap-2">
          <UButton
            icon="i-lucide-copy"
            size="xs"
            variant="ghost"
            color="neutral"
            @click="copyToClipboard(activeTab === 'analysis' ? analysis : transcription)"
          />
          <UButton
            icon="i-lucide-download"
            size="xs"
            variant="ghost"
            color="neutral"
            @click="downloadAsText(
              activeTab === 'analysis' ? analysis : transcription,
              activeTab === 'analysis' ? 'analysis.txt' : 'transcription.txt'
            )"
          />
        </div>
      </div>
    </template>

    <UTabs
      v-model="activeTab"
      :items="[
        { label: t('pages.dashboard.analyze.tabs.analysis'), value: 'analysis' },
        { label: t('pages.dashboard.analyze.tabs.transcription'), value: 'transcription' },
      ]"
    >
      <template #content="{ item }">
        <div class="prose prose-sm dark:prose-invert max-w-none pt-4">
          <div v-if="item.value === 'analysis'" class="whitespace-pre-wrap">
            {{ analysis }}
          </div>
          <div v-else class="whitespace-pre-wrap text-muted">
            {{ transcription }}
          </div>
        </div>
      </template>
    </UTabs>
  </UCard>
</template>
