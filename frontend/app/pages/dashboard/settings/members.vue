<script setup lang="ts">
import type { Member } from "~/types";
import * as z from "zod";
import type { FormSubmitEvent } from "@nuxt/ui";
import type { SelectItem } from "@nuxt/ui";

definePageMeta({
  middleware: "auth",
});

const { t } = useI18n();
const toast = useToast();
const { authenticatedFetch } = useAuth();

const members = ref<Member[]>([]);

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

await loadMembers();

const refreshMembers = loadMembers;

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

    // Refresh members list
    await refreshMembers();
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

      <SettingsMembersList :members="filteredMembers" />
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
