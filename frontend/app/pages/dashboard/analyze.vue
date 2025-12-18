<script setup lang="ts">
definePageMeta({
  middleware: "auth",
});

const { t } = useI18n();
const { authenticatedFetch } = useAuth();
const toast = useToast();

// State
const audioFile = ref<File | null>(null);
const prompt = ref("");
const isProcessing = ref(false);
const transcription = ref("");
const analysis = ref("");
const error = ref("");

// Computed
const canProcess = computed(() => audioFile.value && prompt.value.trim().length >= 5 && !isProcessing.value);

// Methods
function handleFileSelected(file: File) {
  audioFile.value = file;
  error.value = "";
}

function handleFileRemoved() {
  audioFile.value = null;
}

async function processAudio() {
  if (!canProcess.value || !audioFile.value) return;

  isProcessing.value = true;
  error.value = "";
  transcription.value = "";
  analysis.value = "";

  try {
    const formData = new FormData();
    formData.append("audio", audioFile.value);
    formData.append("prompt", prompt.value);

    const result = await authenticatedFetch<{ transcription: string; analysis: string }>("/audio/process", {
      method: "POST",
      body: formData,
    });

    transcription.value = result.transcription;
    analysis.value = result.analysis;
    
    toast.add({
      title: t("pages.dashboard.analyze.success"),
      color: "success",
    });
  } catch (err: any) {
    error.value = err?.data?.message || t("pages.dashboard.analyze.error");
    toast.add({
      title: t("common.messages.error"),
      description: error.value,
      color: "error",
    });
  } finally {
    isProcessing.value = false;
  }
}

function resetAll() {
  audioFile.value = null;
  prompt.value = "";
  transcription.value = "";
  analysis.value = "";
  error.value = "";
}
</script>

<template>
  <UDashboardPanel id="analyze">
    <template #header>
      <UDashboardNavbar :title="t('pages.dashboard.analyze.title')">
        <template #leading>
          <UDashboardSidebarCollapse />
        </template>
      </UDashboardNavbar>
    </template>

    <template #body>
      <div class="max-w-4xl mx-auto space-y-6">
        <!-- Error Alert -->
        <UAlert
          v-if="error"
          color="error"
          variant="subtle"
          icon="i-lucide-alert-circle"
          :title="t('common.messages.error')"
          :description="error"
          :close-button="{ icon: 'i-lucide-x', color: 'error', variant: 'link' }"
          @close="error = ''"
        />

        <!-- Upload & Prompt Section -->
        <div class="grid gap-6 lg:grid-cols-2">
          <!-- Audio Upload -->
          <UCard>
            <template #header>
              <div class="flex items-center gap-2">
                <UIcon name="i-lucide-upload" class="w-5 h-5" />
                <span class="font-medium">{{ t("pages.dashboard.analyze.uploadTitle") }}</span>
              </div>
            </template>

            <AudioUploader
              :file="audioFile"
              :disabled="isProcessing"
              @file-selected="handleFileSelected"
              @file-removed="handleFileRemoved"
            />
          </UCard>

          <!-- Prompt Input -->
          <UCard>
            <template #header>
              <div class="flex items-center gap-2">
                <UIcon name="i-lucide-message-square" class="w-5 h-5" />
                <span class="font-medium">{{ t("pages.dashboard.analyze.promptTitle") }}</span>
              </div>
            </template>

            <PromptInput
              v-model="prompt"
              :disabled="isProcessing"
            />
          </UCard>
        </div>

        <!-- Action Buttons -->
        <div class="flex items-center justify-center gap-4">
          <UButton
            :label="t('pages.dashboard.analyze.processButton')"
            icon="i-lucide-sparkles"
            size="lg"
            :loading="isProcessing"
            :disabled="!canProcess"
            @click="processAudio"
          />
          <UButton
            v-if="transcription || analysis"
            :label="t('pages.dashboard.analyze.resetButton')"
            icon="i-lucide-rotate-ccw"
            variant="outline"
            color="neutral"
            size="lg"
            @click="resetAll"
          />
        </div>

        <!-- Results Section -->
        <AnalysisResult
          v-if="transcription || analysis"
          :transcription="transcription"
          :analysis="analysis"
        />
      </div>
    </template>
  </UDashboardPanel>
</template>
