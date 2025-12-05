<script setup lang="ts">
import type { Member } from "~/types";

const props = defineProps<{
  member: Member | null;
  open: boolean;
}>();

const emit = defineEmits<{
  close: [];
  deleted: [];
}>();

const { t } = useI18n();
const toast = useToast();
const { authenticatedFetch } = useAuth();

const loading = ref(false);

async function onConfirm() {
  if (!props.member) return;

  loading.value = true;

  try {
    await authenticatedFetch(`/delete-member/${props.member.id}`, {
      method: "DELETE",
    });

    toast.add({
      title: t("components.settings.members.deleteModal.successTitle"),
      description: t("components.settings.members.deleteModal.successDescription"),
      color: "success",
    });

    emit("deleted");
    emit("close");
  } catch (error: any) {
    toast.add({
      title: t("components.settings.members.deleteModal.errorTitle"),
      description:
        error.data?.message ||
        t("components.settings.members.deleteModal.errorDescription"),
      color: "error",
    });
  } finally {
    loading.value = false;
  }
}

function handleClose() {
  emit("close");
}
</script>

<template>
  <UModal
    :open="open"
    :title="t('components.settings.members.deleteModal.title')"
    :ui="{ footer: 'justify-end' }"
    @update:open="(val) => !val && handleClose()"
  >
    <template #body>
      <p class="text-muted">
        {{ t("components.settings.members.deleteModal.description") }}
      </p>
      <p v-if="member" class="text-highlighted mt-2 font-medium">
        {{ member.fullName || member.email }}
      </p>
      <p class="text-muted mt-4 text-sm">
        {{ t("components.settings.members.deleteModal.warning") }}
      </p>
    </template>

    <template #footer>
      <UButton
        :label="t('common.buttons.cancel')"
        color="neutral"
        variant="outline"
        :disabled="loading"
        @click="handleClose"
      />
      <UButton
        :label="t('components.settings.members.deleteModal.confirmButton')"
        color="error"
        :loading="loading"
        @click="onConfirm"
      />
    </template>
  </UModal>
</template>
