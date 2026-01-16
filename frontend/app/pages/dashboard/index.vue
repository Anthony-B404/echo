<script setup lang="ts">
import { AudioStatus } from "~/types/audio";
import type { Audio } from "~/types/audio";
import { getAudioDuration } from "~/utils/audio";

definePageMeta({
  middleware: ["auth", "pending-deletion"],
});

const { t } = useI18n();

useSeoMeta({
  title: t("seo.dashboard.title"),
  description: t("seo.dashboard.description"),
});
const toast = useToast();
const localePath = useLocalePath();

const audioStore = useAudioStore();
const creditsStore = useCreditsStore();

const {
  uploading,
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

    // Start polling for this job (multiple jobs can be polled simultaneously)
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

const { startPolling, stopAllPolling } = useAudioPolling({
  onComplete: () => {
    toast.add({
      title: t("pages.dashboard.workshop.processingComplete"),
      color: "success",
    });
    // Refresh the list and credits
    audioStore.fetchAudios(1);
    creditsStore.refresh();
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
const initialLoadDone = ref(false);

// Computed: Only show 5 most recent audios on dashboard
const recentAudios = computed(() => audioStore.audios.slice(0, 5));
const hasMoreAudios = computed(() => audioStore.pagination.total > 5);

// Load audios on mount
onMounted(async () => {
  await audioStore.fetchAudios();
  initialLoadDone.value = true;

  // Resume polling for ALL processing audios with currentJobId (after page refresh)
  const processingAudios = audioStore.audios.filter(
    (a) => (a.status === AudioStatus.Pending || a.status === AudioStatus.Processing) && a.currentJobId
  );
  processingAudios.forEach((audio) => {
    if (audio.currentJobId) {
      startPolling(audio.currentJobId, audio.id);
    }
  });
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

  // Check credits
  try {
    const duration = await getAudioDuration(selectedFile.value);
    const creditsNeeded = Math.max(1, Math.ceil(duration / 60));

    if (creditsStore.credits < creditsNeeded) {
      toast.add({
        title: t("pages.dashboard.credits.insufficientCredits"),
        description: t("pages.dashboard.credits.insufficientCreditsMessage", { 
          required: creditsNeeded, 
          available: creditsStore.credits 
        }),
        color: "error",
      });
      return;
    }
  } catch (error) {
    console.error("Failed to check audio duration:", error);
    // Continue with upload if check fails (backend will handle it)
  }

  const response = await upload(selectedFile.value, prompt.value);

  if (response) {
    // Reset form on success - immediately ready for next upload
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

// Cleanup
onUnmounted(() => {
  stopAllPolling();
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
  <div class="w-full space-y-6">
    <!-- Header Section - toujours visible -->
    <div class="w-full flex items-center justify-between mb-8">
      <div>
        <h1 class="text-3xl font-bold text-gray-900 dark:text-white">{{ t('pages.dashboard.workshop.title') }}</h1>
        <p class="mt-2 text-gray-500 dark:text-gray-400">{{ t('pages.dashboard.workshop.subtitle') }}</p>
      </div>
    </div>

    <div class="w-full grid grid-cols-1 gap-8 lg:grid-cols-2">
      <!-- Left: Upload/Record section - toujours visible -->
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
                class="bg-primary-100 dark:bg-primary-900/30 flex h-12 w-12 shrink-0 items-center justify-center rounded-lg"
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

          <!-- Prompt input and submit button -->
          <div v-if="selectedFile" class="mt-6 space-y-4">
            <AudioPromptInput
              v-model="prompt"
              :disabled="uploading"
              class="bg-white dark:bg-slate-900"
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

      <!-- Right: Audio list - skeleton interne géré par AudioList -->
      <div class="space-y-4">
        <WorkshopAudioList
          :audios="recentAudios"
          :loading="!initialLoadDone || audioStore.loading"
          @select="handleSelectAudio"
          @delete="handleDeleteRequest"
        />

        <!-- View all audios link - visible seulement après chargement -->
        <Transition
          enter-active-class="transition-opacity duration-300"
          enter-from-class="opacity-0"
          enter-to-class="opacity-100"
        >
          <div v-if="initialLoadDone && hasMoreAudios" class="text-center pt-2">
            <UButton
              :to="localePath('/dashboard/library')"
              color="neutral"
              variant="ghost"
              icon="i-lucide-library"
            >
              {{ t('pages.dashboard.workshop.viewAllAudios') }}
              <UBadge color="primary" variant="subtle" size="xs" class="ml-2">
                {{ audioStore.pagination.total }}
              </UBadge>
            </UButton>
          </div>
        </Transition>
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
