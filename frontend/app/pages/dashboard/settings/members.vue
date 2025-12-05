<script setup lang="ts">
import type { Member, Invitation } from "~/types";
import { UserRole } from "~/types/auth";
import * as z from "zod";
import type { FormSubmitEvent } from "@nuxt/ui";
import type { SelectItem } from "@nuxt/ui";

definePageMeta({
  middleware: "auth",
});

const { t } = useI18n();
const toast = useToast();
const { authenticatedFetch } = useAuth();
const authStore = useAuthStore();

const members = ref<Member[]>([]);
const invitations = ref<Invitation[]>([]);

const loadMembers = async () => {
  try {
    const data = await authenticatedFetch<Member[]>("/members");
    members.value = data || [];
  } catch (error) {
    toast.add({
      title: t("components.settings.members.errorLoadingTitle"),
      description: t("components.settings.members.errorLoadingDescription"),
      color: "error",
    });
  }
};

const loadInvitations = async () => {
  try {
    const data = await authenticatedFetch<Invitation[]>("/invitations");
    invitations.value = data || [];
  } catch (error) {
    toast.add({
      title: t("components.settings.invitations.errorLoadingTitle"),
      description: t("components.settings.invitations.errorLoadingDescription"),
      color: "error",
    });
  }
};

await loadMembers();
await loadInvitations();

const refreshMembers = loadMembers;
const refreshInvitations = loadInvitations;

// Get current user's role in the organization
const currentUserRole = computed(() => {
  // Find current user in members list to get their role
  const currentMember = members.value.find((m) => m.isCurrentUser);
  return currentMember?.role ?? UserRole.Member;
});

// Collapsible state for invitations - open by default if there are invitations
const invitationsOpen = ref(invitations.value.length > 0);

// Update collapsible state when invitations change
watch(invitations, (newInvitations) => {
  if (newInvitations.length > 0 && !invitationsOpen.value) {
    invitationsOpen.value = true;
  }
});

const q = ref("");

const filteredMembers = computed(() => {
  return members.value.filter((member) => {
    const name = member.fullName || "";
    const email = member.email || "";
    return (
      name.search(new RegExp(q.value, "i")) !== -1 ||
      email.search(new RegExp(q.value, "i")) !== -1
    );
  });
});

// Invitation modal state
const inviteModalOpen = ref(false);
const formRef = ref();
const submitting = ref(false);

// Role enum matching backend (2 = Administrator, 3 = Member)
enum UserRole {
  Administrator = 2,
  Member = 3,
}

// Role options for select
const roleOptions = ref<SelectItem[]>([
  {
    label: t("components.settings.members.inviteModal.roles.administrator"),
    value: UserRole.Administrator,
  },
  {
    label: t("components.settings.members.inviteModal.roles.member"),
    value: UserRole.Member,
  },
]);

// Validation schema
const schema = z.object({
  email: z.preprocess(
    (val) => val ?? "",
    z.string().superRefine((val, ctx) => {
      if (!val || val.length === 0) {
        ctx.addIssue({
          code: "custom",
          message: t(
            "components.settings.members.inviteModal.validation.emailRequired",
          ),
        });
      } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(val)) {
        ctx.addIssue({
          code: "custom",
          message: t(
            "components.settings.members.inviteModal.validation.invalidEmail",
          ),
        });
      }
    }),
  ),
  role: z.preprocess(
    (val) => (val === undefined || val === null ? undefined : val),
    z.number().superRefine((val, ctx) => {
      if (val === undefined) {
        ctx.addIssue({
          code: "custom",
          message: t(
            "components.settings.members.inviteModal.validation.roleRequired",
          ),
        });
      }
    }),
  ),
});

type Schema = z.output<typeof schema>;

const state = reactive<Partial<Schema>>({
  email: undefined,
  role: UserRole.Member,
});

// Submit handler
async function onSubmit(event: FormSubmitEvent<Schema>) {
  submitting.value = true;

  try {
    await authenticatedFetch("/invite-member", {
      method: "POST",
      body: {
        email: event.data.email,
        role: event.data.role,
      },
    });

    toast.add({
      title: t("components.settings.members.inviteModal.successTitle"),
      description: t(
        "components.settings.members.inviteModal.successDescription",
        {
          email: event.data.email,
        },
      ),
      color: "success",
    });

    // Close modal and reset form
    inviteModalOpen.value = false;
    state.email = undefined;
    state.role = UserRole.Member;

    // Refresh members list and invitations list
    await refreshMembers();
    await refreshInvitations();
  } catch (error: any) {
    toast.add({
      title: t("components.settings.members.inviteModal.errorTitle"),
      description:
        error.data?.message ||
        t("components.settings.members.inviteModal.errorDescription"),
      color: "error",
    });
  } finally {
    submitting.value = false;
  }
}

// Resend invitation
const resendingInvitation = ref<number | null>(null);

async function resendInvitation(id: number) {
  resendingInvitation.value = id;

  try {
    await authenticatedFetch(`/resend-invitation/${id}`, {
      method: "POST",
    });

    toast.add({
      title: t("components.settings.invitations.resendSuccess"),
      color: "success",
    });

    // Refresh invitations list
    await refreshInvitations();
  } catch (error: any) {
    toast.add({
      title: t("components.settings.invitations.resendError"),
      description:
        error.data?.message || t("components.settings.invitations.resendError"),
      color: "error",
    });
  } finally {
    resendingInvitation.value = null;
  }
}

// Delete invitation
const deletingInvitation = ref<number | null>(null);

async function deleteInvitation(id: number) {
  deletingInvitation.value = id;

  try {
    await authenticatedFetch(`/delete-invitation/${id}`, {
      method: "DELETE",
    });

    toast.add({
      title: t("components.settings.invitations.deleteSuccess"),
      color: "success",
    });

    // Refresh invitations list
    await refreshInvitations();
  } catch (error: any) {
    toast.add({
      title: t("components.settings.invitations.deleteError"),
      description:
        error.data?.message || t("components.settings.invitations.deleteError"),
      color: "error",
    });
  } finally {
    deletingInvitation.value = null;
  }
}
</script>

<template>
  <div>
    <UPageCard
      :title="t('pages.dashboard.settings.members.title')"
      :description="t('pages.dashboard.settings.members.description')"
      variant="naked"
      orientation="horizontal"
      class="mb-4"
    >
      <UButton
        :label="t('common.buttons.invitePeople')"
        color="neutral"
        class="w-fit lg:ms-auto"
        @click="inviteModalOpen = true"
      />
    </UPageCard>

    <!-- Invitations Section (Collapsible) -->
    <UPageCard
      variant="subtle"
      :ui="{
        container: 'p-0 sm:p-0 gap-y-0',
        wrapper: 'items-stretch',
      }"
      class="mb-4"
    >
      <!-- Collapsible Header (Always visible) -->
      <UButton
        variant="ghost"
        color="neutral"
        block
        class="h-auto justify-start p-4"
        @click="invitationsOpen = !invitationsOpen"
      >
        <div class="flex w-full items-center justify-between">
          <div class="flex-1 text-left">
            <div class="flex items-center gap-2">
              <h3 class="text-highlighted text-lg font-semibold">
                {{ t("components.settings.invitations.title") }}
              </h3>
              <UBadge
                v-if="invitations.length > 0"
                :label="invitations.length.toString()"
                color="primary"
                size="sm"
              />
            </div>
            <p class="text-muted mt-1 text-sm">
              {{ t("components.settings.invitations.description") }}
            </p>
          </div>
          <UIcon
            :name="
              invitationsOpen ? 'i-lucide-chevron-up' : 'i-lucide-chevron-down'
            "
            class="text-muted ml-3 h-5 w-5 shrink-0 transition-transform"
          />
        </div>
      </UButton>

      <!-- Collapsible Content -->
      <div v-show="invitationsOpen" class="border-default border-t">
        <SettingsInvitationsList
          :invitations="invitations"
          @resend="resendInvitation"
          @delete="deleteInvitation"
        />
      </div>
    </UPageCard>

    <!-- Members Section -->
    <UPageCard
      variant="subtle"
      :ui="{
        container: 'p-0 sm:p-0 gap-y-0',
        wrapper: 'items-stretch',
        header: 'p-4 mb-0 border-b border-default',
      }"
    >
      <template #header>
        <UInput
          v-model="q"
          icon="i-lucide-search"
          :placeholder="t('common.placeholders.searchMembers')"
          autofocus
          class="w-full"
        />
      </template>

      <SettingsMembersList
        :members="filteredMembers"
        :current-user-role="currentUserRole"
        @refresh="refreshMembers"
      />
    </UPageCard>

    <!-- Invitation Modal -->
    <UModal
      v-model:open="inviteModalOpen"
      :title="t('components.settings.members.inviteModal.title')"
      :description="t('components.settings.members.inviteModal.description')"
      :ui="{ footer: 'justify-end' }"
    >
      <template #body>
        <UForm
          ref="formRef"
          :schema="schema"
          :state="state"
          class="space-y-4"
          @submit="onSubmit"
        >
          <UFormField
            :label="t('components.settings.members.inviteModal.emailLabel')"
            name="email"
          >
            <UInput
              v-model="state.email"
              type="email"
              :placeholder="
                t('components.settings.members.inviteModal.emailPlaceholder')
              "
              icon="i-lucide-mail"
              size="lg"
              class="w-full"
            />
          </UFormField>

          <UFormField
            :label="t('components.settings.members.inviteModal.roleLabel')"
            name="role"
          >
            <USelect
              v-model="state.role"
              :items="roleOptions"
              :placeholder="
                t('components.settings.members.inviteModal.rolePlaceholder')
              "
              size="lg"
              class="w-full"
            />
          </UFormField>
        </UForm>
      </template>

      <template #footer="{ close }">
        <UButton
          :label="t('common.buttons.cancel')"
          color="neutral"
          variant="outline"
          :disabled="submitting"
          @click="close"
        />
        <UButton
          :label="t('common.buttons.send')"
          color="primary"
          :loading="submitting"
          @click="formRef?.submit()"
        />
      </template>
    </UModal>
  </div>
</template>
