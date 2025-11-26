<script setup lang="ts">
import * as z from "zod";
import type { FormSubmitEvent } from "@nuxt/ui";

const { t } = useI18n();
const router = useRouter();
const { $localePath } = useNuxtApp();
const toast = useToast();
const config = useRuntimeConfig();

definePageMeta({
  layout: "auth",
});

useSeoMeta({
  title: t("seo.completeSignup.title"),
  description: t("seo.completeSignup.description"),
});

const token = ref("");
const userData = ref<{ email: string; fullName?: string } | null>(null);
const selectedLogo = ref<File | null>(null);
const isLoading = ref(true);

// Verify auth token and get user data on mount
onMounted(async () => {
  // Get token from localStorage
  token.value = localStorage.getItem("auth_token") || "";

  if (!token.value) {
    toast.add({
      title: t("auth.completeSignup.error"),
      description: t("auth.completeSignup.noToken"),
      color: "error",
    });
    router.push($localePath("login"));
    return;
  }

  try {
    // Verify token and get user data
    const response = await $fetch(`${config.public.apiUrl}/me`, {
      headers: {
        Authorization: `Bearer ${token.value}`,
      },
    });

    userData.value = {
      email: response.email,
      fullName: response.fullName || response.firstName || "",
    };

    // If onboarding already completed, redirect to dashboard
    if (response.onboardingCompleted) {
      router.push($localePath("dashboard"));
      return;
    }

    isLoading.value = false;
  } catch (error: any) {
    toast.add({
      title: t("auth.completeSignup.error"),
      description: error.data?.message || t("auth.completeSignup.invalidToken"),
      color: "error",
    });
    router.push($localePath("login"));
  }
});

const schema = z.object({
  firstName: z.preprocess(
    (val) => val ?? "",
    z.string().superRefine((val, ctx) => {
      if (!val || val.length === 0) {
        ctx.addIssue({
          code: "custom",
          message: t("auth.validation.firstNameRequired"),
        });
      } else if (val.length < 2) {
        ctx.addIssue({
          code: "custom",
          message: t("auth.validation.firstNameTooShort"),
        });
      }
    }),
  ),
  lastName: z.preprocess(
    (val) => val ?? "",
    z.string().superRefine((val, ctx) => {
      if (!val || val.length === 0) {
        ctx.addIssue({
          code: "custom",
          message: t("auth.validation.lastNameRequired"),
        });
      } else if (val.length < 2) {
        ctx.addIssue({
          code: "custom",
          message: t("auth.validation.lastNameTooShort"),
        });
      }
    }),
  ),
  organizationName: z.preprocess(
    (val) => val ?? "",
    z.string().superRefine((val, ctx) => {
      if (!val || val.length === 0) {
        ctx.addIssue({
          code: "custom",
          message: t("auth.validation.organizationNameRequired"),
        });
      } else if (val.length < 2) {
        ctx.addIssue({
          code: "custom",
          message: t("auth.validation.organizationNameTooShort"),
        });
      }
    }),
  ),
  logo: z.any().optional(),
});

type Schema = z.output<typeof schema>;

const state = reactive<Partial<Schema>>({
  firstName: undefined,
  lastName: undefined,
  organizationName: undefined,
  logo: undefined,
});

async function onSubmit(event: FormSubmitEvent<Schema>) {
  try {
    // Prepare FormData
    const formData = new FormData();
    formData.append("firstName", event.data.firstName);
    formData.append("lastName", event.data.lastName);
    formData.append("organizationName", event.data.organizationName);

    if (selectedLogo.value) {
      formData.append("logo", selectedLogo.value);
    }

    await $fetch(`${config.public.apiUrl}/oauth/complete-registration`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token.value}`,
      },
      body: formData,
    });

    toast.add({
      title: t("auth.completeSignup.success"),
      description: t("auth.completeSignup.successDescription"),
      color: "success",
    });

    // Redirect to dashboard
    router.push($localePath("index"));
  } catch (error: any) {
    toast.add({
      title: t("auth.completeSignup.error"),
      description:
        error.data?.message || t("auth.completeSignup.errorDescription"),
      color: "error",
    });
  }
}
</script>

<template>
  <div v-if="isLoading" class="flex items-center justify-center py-12">
    <UIcon name="i-lucide-loader-2" class="text-primary h-8 w-8 animate-spin" />
  </div>

  <div v-else class="mx-auto w-full max-w-4xl px-6">
    <div class="mb-10 text-center">
      <div class="mb-6 flex justify-center">
        <div class="bg-primary/10 rounded-full p-4">
          <UIcon name="i-lucide-building-2" class="text-primary h-8 w-8" />
        </div>
      </div>
      <h1 class="text-foreground mb-3 text-3xl font-bold tracking-tight">
        {{ $t("auth.completeSignup.title") }}
      </h1>
      <p class="text-muted-foreground text-base">
        {{ $t("auth.completeSignup.description") }}
      </p>
      <p v-if="userData" class="text-muted-foreground mt-2 text-sm font-medium">
        {{ userData.email }}
      </p>
    </div>

    <UForm :schema="schema" :state="state" class="space-y-5" @submit="onSubmit">
      <UFormField :label="$t('auth.completeSignup.firstName')" name="firstName">
        <UInput
          v-model="state.firstName"
          :placeholder="$t('auth.completeSignup.firstNamePlaceholder')"
          class="w-full"
          size="lg"
        />
      </UFormField>

      <UFormField :label="$t('auth.completeSignup.lastName')" name="lastName">
        <UInput
          v-model="state.lastName"
          :placeholder="$t('auth.completeSignup.lastNamePlaceholder')"
          class="w-full"
          size="lg"
        />
      </UFormField>

      <UFormField
        :label="$t('auth.completeSignup.organizationName')"
        name="organizationName"
      >
        <UInput
          v-model="state.organizationName"
          :placeholder="$t('auth.completeSignup.organizationNamePlaceholder')"
          class="w-full"
          size="lg"
        />
      </UFormField>

      <UFormField :label="$t('auth.completeSignup.logo')" name="logo">
        <UFileUpload
          v-model="selectedLogo"
          description="PNG, JPG, GIF or SVG (max. 2MB)"
          accept="image/*"
          class="aspect-square w-40"
        />
      </UFormField>

      <UButton type="submit" block class="mt-6" size="lg">
        {{ $t("auth.completeSignup.submitButton") }}
      </UButton>
    </UForm>
  </div>
</template>
