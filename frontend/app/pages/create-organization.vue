<script setup lang="ts">
import * as z from "zod";
import type { FormSubmitEvent } from "@nuxt/ui";

const { t } = useI18n();
const { $localePath } = useNuxtApp();
const { authenticatedFetch } = useAuth();
const config = useRuntimeConfig();
const toast = useToast();

definePageMeta({
  layout: "auth",
  middleware: "auth",
});

useSeoMeta({
  title: t("pages.createOrganization.seoTitle"),
  description: t("pages.createOrganization.seoDescription"),
});

const fileRef = ref<HTMLInputElement>();
const loading = ref(false);

const organizationSchema = z.object({
  name: z
    .string()
    .min(2, t("pages.createOrganization.validation.nameTooShort")),
  email: z
    .string()
    .email(t("pages.createOrganization.validation.invalidEmail")),
  logo: z.string().optional(),
});

type OrganizationSchema = z.output<typeof organizationSchema>;

const organization = reactive<OrganizationSchema>({
  name: "",
  email: "",
  logo: undefined,
});

async function onSubmit(event: FormSubmitEvent<OrganizationSchema>) {
  loading.value = true;
  try {
    const formData = new FormData();

    // Create organization payload as JSON string
    const organizationData = {
      name: event.data.name,
      email: event.data.email,
    };
    formData.append("organization", JSON.stringify(organizationData));

    // Add logo if file was selected
    const fileInput = fileRef.value;
    if (fileInput?.files && fileInput.files.length > 0) {
      formData.append("logo", fileInput.files[0]);
    }

    const response = await authenticatedFetch<{
      message: string;
      organization: {
        id: number;
        name: string;
        email: string;
        logo: string | null;
      };
      needsCheckout: boolean;
    }>("/organizations", {
      method: "POST",
      body: formData,
    });

    toast.add({
      title: t("pages.createOrganization.successTitle"),
      description: t("pages.createOrganization.successDescription"),
      icon: "i-lucide-check",
      color: "success",
    });

    // Redirect based on needsCheckout
    if (response.needsCheckout) {
      // User needs to checkout - redirect to billing page
      navigateTo($localePath("/dashboard/settings/billing"));
    } else {
      // User has active trial - redirect to dashboard
      navigateTo($localePath("/dashboard"));
    }
  } catch (error: any) {
    toast.add({
      title: t("pages.createOrganization.errorTitle"),
      description:
        error.data?.message || t("pages.createOrganization.errorDescription"),
      icon: "i-lucide-x",
      color: "error",
    });
  } finally {
    loading.value = false;
  }
}

function onFileChange(e: Event) {
  const input = e.target as HTMLInputElement;

  if (!input.files?.length) {
    return;
  }

  organization.logo = URL.createObjectURL(input.files[0]!);
}

function onFileClick() {
  fileRef.value?.click();
}

function onRemoveLogo() {
  organization.logo = undefined;
  if (fileRef.value) {
    fileRef.value.value = "";
  }
}

// Get logo URL for preview
const logoUrl = computed(() => {
  if (!organization.logo) return undefined;
  if (organization.logo.startsWith("blob:")) {
    return organization.logo;
  }
  return `${config.public.apiUrl}/${organization.logo}`;
});

// Compute organization name for display
const organizationName = computed(() => {
  return organization.name.trim() || t("pages.createOrganization.newOrg");
});
</script>

<template>
  <UCard class="w-full max-w-md">
    <div class="mb-6 text-center">
      <UIcon
        name="i-lucide-building"
        class="text-primary mx-auto mb-4 h-12 w-12"
      />
      <h1 class="text-2xl font-bold">
        {{ t("pages.createOrganization.title") }}
      </h1>
      <p class="text-muted mt-2">
        {{ t("pages.createOrganization.subtitle") }}
      </p>
    </div>

    <UForm
      :schema="organizationSchema"
      :state="organization"
      class="space-y-4"
      @submit="onSubmit"
    >
      <UFormField
        name="name"
        :label="t('pages.createOrganization.nameLabel')"
        required
      >
        <UInput
          v-model="organization.name"
          :placeholder="t('pages.createOrganization.namePlaceholder')"
          autocomplete="organization"
        />
      </UFormField>

      <UFormField
        name="email"
        :label="t('pages.createOrganization.emailLabel')"
        required
      >
        <UInput
          v-model="organization.email"
          type="email"
          :placeholder="t('pages.createOrganization.emailPlaceholder')"
          autocomplete="off"
        />
      </UFormField>

      <UFormField
        name="logo"
        :label="t('pages.createOrganization.logoLabel')"
      >
        <div class="flex flex-wrap items-center gap-3">
          <UAvatar :src="logoUrl" :alt="organizationName" size="lg" />
          <UButton
            :label="t('common.buttons.choose')"
            color="neutral"
            variant="soft"
            @click="onFileClick"
          />
          <UButton
            v-if="organization.logo"
            :label="t('pages.createOrganization.removeLogo')"
            color="error"
            variant="ghost"
            @click="onRemoveLogo"
          />
          <input
            ref="fileRef"
            type="file"
            class="hidden"
            accept=".jpg, .jpeg, .png, .gif"
            @change="onFileChange"
          />
        </div>
      </UFormField>

      <UButton
        :label="t('pages.createOrganization.submit')"
        :loading="loading"
        :disabled="loading"
        color="primary"
        type="submit"
        block
        class="mt-6"
      />
    </UForm>
  </UCard>
</template>
