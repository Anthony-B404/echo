<script setup lang="ts">
import * as z from "zod";
import type { FormSubmitEvent } from "@nuxt/ui";

const { t } = useI18n();

const fileRef = ref<HTMLInputElement>();

const profileSchema = z.object({
  name: z.string().min(2, t('pages.dashboard.settings.general.validation.nameTooShort')),
  email: z.string().email(t('pages.dashboard.settings.general.validation.invalidEmail')),
  username: z.string().min(2, t('pages.dashboard.settings.general.validation.nameTooShort')),
  avatar: z.string().optional(),
  bio: z.string().optional(),
});

type ProfileSchema = z.output<typeof profileSchema>;

const profile = reactive<Partial<ProfileSchema>>({
  name: "Benjamin Canac",
  email: "ben@nuxtlabs.com",
  username: "benjamincanac",
  avatar: undefined,
  bio: undefined,
});
const toast = useToast();
async function onSubmit(event: FormSubmitEvent<ProfileSchema>) {
  toast.add({
    title: t('pages.dashboard.settings.general.successTitle'),
    description: t('pages.dashboard.settings.general.successDescription'),
    icon: "i-lucide-check",
    color: "success",
  });
  console.log(event.data);
}

function onFileChange(e: Event) {
  const input = e.target as HTMLInputElement;

  if (!input.files?.length) {
    return;
  }

  profile.avatar = URL.createObjectURL(input.files[0]!);
}

function onFileClick() {
  fileRef.value?.click();
}
</script>

<template>
  <UForm
    id="settings"
    :schema="profileSchema"
    :state="profile"
    @submit="onSubmit"
  >
    <UPageCard
      :title="t('pages.dashboard.settings.general.title')"
      :description="t('pages.dashboard.settings.general.description')"
      variant="naked"
      orientation="horizontal"
      class="mb-4"
    >
      <UButton
        form="settings"
        :label="t('common.buttons.saveChanges')"
        color="neutral"
        type="submit"
        class="w-fit lg:ms-auto"
      />
    </UPageCard>

    <UPageCard variant="subtle">
      <UFormField
        name="name"
        :label="t('pages.dashboard.settings.general.nameLabel')"
        :description="t('pages.dashboard.settings.general.nameDescription')"
        required
        class="flex items-start justify-between gap-4 max-sm:flex-col"
      >
        <UInput v-model="profile.name" autocomplete="off" />
      </UFormField>
      <USeparator />
      <UFormField
        name="email"
        :label="t('pages.dashboard.settings.general.emailLabel')"
        :description="t('pages.dashboard.settings.general.emailDescription')"
        required
        class="flex items-start justify-between gap-4 max-sm:flex-col"
      >
        <UInput v-model="profile.email" type="email" autocomplete="off" />
      </UFormField>
      <USeparator />
      <UFormField
        name="username"
        :label="t('pages.dashboard.settings.general.usernameLabel')"
        :description="t('pages.dashboard.settings.general.usernameDescription')"
        required
        class="flex items-start justify-between gap-4 max-sm:flex-col"
      >
        <UInput v-model="profile.username" type="username" autocomplete="off" />
      </UFormField>
      <USeparator />
      <UFormField
        name="avatar"
        :label="t('pages.dashboard.settings.general.avatarLabel')"
        :description="t('pages.dashboard.settings.general.avatarDescription')"
        class="flex justify-between gap-4 max-sm:flex-col sm:items-center"
      >
        <div class="flex flex-wrap items-center gap-3">
          <UAvatar :src="profile.avatar" :alt="profile.name" size="lg" />
          <UButton :label="t('common.buttons.choose')" color="neutral" @click="onFileClick" />
          <input
            ref="fileRef"
            type="file"
            class="hidden"
            accept=".jpg, .jpeg, .png, .gif"
            @change="onFileChange"
          />
        </div>
      </UFormField>
      <USeparator />
      <UFormField
        name="bio"
        :label="t('pages.dashboard.settings.general.bioLabel')"
        :description="t('pages.dashboard.settings.general.bioDescription')"
        class="flex items-start justify-between gap-4 max-sm:flex-col"
        :ui="{ container: 'w-full' }"
      >
        <UTextarea v-model="profile.bio" :rows="5" autoresize class="w-full" />
      </UFormField>
    </UPageCard>
  </UForm>
</template>
