<script setup lang="ts">
import type { Audio } from "~/types/audio";

definePageMeta({
  middleware: "auth",
});

const { t } = useI18n();
const toast = useToast();
const localePath = useLocalePath();

const audioStore = useAudioStore();
const {
  uploading,
  progress,
  error: uploadError,
  upload,
  reset: resetUpload,
  formatFileSize,
} = useAudioUpload({
  onSuccess: async (response) => {
    // Fetch the newly created audio and add it to the list immediately
    await audioStore.fetchAudio(response.audioId);
    if (audioStore.currentAudio) {
      audioStore.addAudio(audioStore.currentAudio);
    }

    startPolling(response.jobId, response.audioId);
    toast.add({
      title: t("pages.dashboard.workshop.uploadSuccess"),
      description: t("pages.dashboard.workshop.processingStarted"),
      color: "success",
    });
  },
  onError: (error) => {
    toast.add({
      title: t("pages.dashboard.workshop.uploadError"),
      description: error.message,
      color: "error",
    });
  },
});

const { startPolling, stopPolling, polling } = useAudioPolling({
  onComplete: () => {
    toast.add({
      title: t("pages.dashboard.workshop.processingComplete"),
      color: "success",
    });
    // Refresh the list
    audioStore.fetchAudios(1);
  },
  onError: (error) => {
    toast.add({
      title: t("pages.dashboard.workshop.processingError"),
      description: error.message,
      color: "error",
    });
  },
});

// State
const selectedFile = ref<File | null>(null);
const prompt = ref("");
const activeTab = ref<"upload" | "record">("upload");
const deleteModalOpen = ref(false);
const audioToDelete = ref<Audio | null>(null);

// Load audios on mount
onMounted(async () => {
  await audioStore.fetchAudios();
});

// Handle file selection
function handleFileSelected(file: File) {
  selectedFile.value = file;
}

function handleRecordingComplete(file: File) {
  selectedFile.value = file;
  activeTab.value = "upload";
}

function removeFile() {
  selectedFile.value = null;
  prompt.value = "";
}

// Handle upload
async function handleUpload() {
  if (!selectedFile.value || !prompt.value.trim()) {
    toast.add({
      title: t("pages.dashboard.workshop.validationError"),
      description: t("pages.dashboard.workshop.fileAndPromptRequired"),
      color: "error",
    });
    return;
  }

  const response = await upload(selectedFile.value, prompt.value);

  if (response) {
    // Reset form on success
    selectedFile.value = null;
    prompt.value = "";
    resetUpload();
  }
}

// Handle audio selection - navigate to detail page
function handleSelectAudio(audio: Audio) {
  navigateTo(localePath(`/dashboard/${audio.id}`));
}

// Handle delete
function handleDeleteRequest(audio: Audio) {
  audioToDelete.value = audio;
  deleteModalOpen.value = true;
}

async function handleDeleteConfirm() {
  if (!audioToDelete.value) return;

  const success = await audioStore.deleteAudio(audioToDelete.value.id);

  if (success) {
    toast.add({
      title: t("pages.dashboard.workshop.deleteSuccess"),
      color: "success",
    });
  } else {
    toast.add({
      title: t("pages.dashboard.workshop.deleteError"),
      color: "error",
    });
  }

  deleteModalOpen.value = false;
  audioToDelete.value = null;
}

// Load more
async function handleLoadMore() {
  await audioStore.fetchAudios(audioStore.pagination.currentPage + 1);
}

// Cleanup
onUnmounted(() => {
  stopPolling();
});

// Tab items for upload/record
const tabItems = computed(() => [
  {
    label: t("pages.dashboard.workshop.tabs.upload"),
    value: "upload",
    icon: "i-lucide-upload",
  },
  {
    label: t("pages.dashboard.workshop.tabs.record"),
    value: "record",
    icon: "i-lucide-mic",
  },
]);
</script>

<template>
  <div>
  <div class="space-y-6">
    <!-- Header Section -->
    <div class="flex items-center justify-between mb-8">
      <div>
        <h1 class="text-3xl font-bold text-gray-900 dark:text-white">{{ t('pages.dashboard.workshop.title') }}</h1>
        <p class="mt-2 text-gray-500 dark:text-gray-400">Gérez vos fichiers audio et générez des analyses.</p>
      </div>
    </div>

    <div class="grid grid-cols-1 gap-8 lg:grid-cols-2">
      <!-- Left: Upload/Record section -->
      <div class="space-y-6">
        <UCard
          class="transition-all duration-300 hover:-translate-y-1 bg-white/50 dark:bg-slate-900/50 backdrop-blur-sm ring-1 ring-gray-200 dark:ring-gray-800 hover:ring-2 hover:ring-primary-500/50 dark:hover:ring-primary-400/50 shadow-lg hover:shadow-xl dark:shadow-none"
        >
          <template #header>
             <h3 class="text-xl font-semibold text-gray-900 dark:text-white flex items-center gap-2">
               <UIcon name="i-lucide-sparkles" class="text-primary-500" />
               {{ t('pages.dashboard.workshop.newAudio') }}
             </h3>
          </template>

          <!-- Tabs for Upload/Record -->
          <UTabs v-model="activeTab" :items="tabItems" class="mb-6" />

          <!-- Upload tab -->
          <div v-show="activeTab === 'upload'">
            <div v-if="!selectedFile">
              <WorkshopAudioUploadZone
                :disabled="uploading"
                :loading="uploading"
                @file-selected="handleFileSelected"
                class="border-2 border-dashed border-gray-300 dark:border-gray-700 hover:border-primary-500 dark:hover:border-primary-400 transition-colors duration-300 rounded-xl bg-gray-50/50 dark:bg-gray-800/20"
              />
            </div>

            <!-- Selected file preview -->
            <div
              v-else
              class="bg-white dark:bg-slate-800 border border-gray-200 dark:border-gray-700 flex items-center gap-4 rounded-xl p-4 shadow-sm"
            >
              <div
                class="bg-primary-100 dark:bg-primary-900/30 flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-lg"
              >
                <UIcon name="i-lucide-music" class="text-primary-600 dark:text-primary-400 h-6 w-6" />
              </div>

              <div class="min-w-0 flex-1">
                <p class="text-gray-900 dark:text-white truncate font-medium">
                  {{ selectedFile.name }}
                </p>
                <p class="text-gray-500 dark:text-gray-400 text-sm">
                  {{ formatFileSize(selectedFile.size) }}
                </p>
              </div>

              <UButton
                icon="i-lucide-x"
                color="neutral"
                variant="ghost"
                size="sm"
                :disabled="uploading"
                @click="removeFile"
              />
            </div>
          </div>

          <!-- Record tab -->
          <div v-show="activeTab === 'record'">
            <WorkshopAudioRecorder
              :disabled="uploading"
              @recording-complete="handleRecordingComplete"
            />
          </div>

          <!-- Prompt input -->
          <div v-if="selectedFile" class="mt-6 space-y-4">
            <AudioPromptInput 
              v-model="prompt" 
              :disabled="uploading"
              class="bg-white dark:bg-slate-900" 
            />

            <!-- Processing status -->
            <WorkshopProcessingStatus
              v-if="uploading || polling"
              :status="{
                jobId: '',
                status: uploading ? 'processing' : 'pending',
                progress: progress.percentage,
              }"
            />

            <!-- Submit button -->
            <UButton
              :label="t('pages.dashboard.workshop.processButton')"
              icon="i-lucide-sparkles"
              color="primary"
              size="lg"
              block
              :loading="uploading"
              :disabled="!prompt.trim()"
              class="rounded-xl shadow-md hover:shadow-lg transition-shadow"
              @click="handleUpload"
            />
          </div>
        </UCard>
      </div>

      <!-- Right: Audio list -->
      <div>
        <WorkshopAudioList
          :audios="audioStore.audios"
          :loading="audioStore.loading"
          @select="handleSelectAudio"
          @delete="handleDeleteRequest"
          @load-more="handleLoadMore"
        />
      </div>
    </div>
  </div>

  <!-- Delete modal -->
  <WorkshopAudioDeleteModal
    v-model:open="deleteModalOpen"
    :audio="audioToDelete"
    @confirm="handleDeleteConfirm"
  />
  </div>
</template>
