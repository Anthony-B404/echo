<script setup lang="ts">
import * as z from "zod";
import type { FormSubmitEvent } from "@nuxt/ui";

const { t } = useI18n();
const route = useRoute();
const router = useRouter();
const { $localePath } = useNuxtApp();
const toast = useToast();
const { login } = useAuth();

definePageMeta({
  layout: "auth",
});

useSeoMeta({
  title: t("seo.completeSignup.title"),
  description: t("seo.completeSignup.description"),
});

const token = ref(route.query.token as string);
const isVerifying = ref(true);
const isValid = ref(false);
const userData = ref<{ email: string } | null>(null);
const selectedLogo = ref<File | null>(null);

// Verify magic link token on mount
onMounted(async () => {
  if (!token.value) {
    toast.add({
      title: t("auth.completeSignup.error"),
      description: t("auth.completeSignup.noToken"),
      color: "error",
    });
    router.push($localePath("signup"));
    return;
  }

  try {
    const config = useRuntimeConfig();
    const response = await $fetch<{ email: string; token: string }>(
      `${config.public.apiUrl}/verify-magic-link/${token.value}`,
    );

    userData.value = {
      email: response.email,
    };
    isValid.value = true;
  } catch (error: any) {
    toast.add({
      title: t("auth.completeSignup.error"),
      description: error.data?.message || t("auth.completeSignup.invalidToken"),
      color: "error",
    });
    router.push($localePath("signup"));
  } finally {
    isVerifying.value = false;
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
    const config = useRuntimeConfig();

    // Prepare FormData
    const formData = new FormData();
    formData.append("magicLinkToken", token.value);
    formData.append("firstName", event.data.firstName);
    formData.append("lastName", event.data.lastName);
    formData.append("organizationName", event.data.organizationName);

    if (selectedLogo.value) {
      formData.append("logo", selectedLogo.value);
    }

    const response = await $fetch<{ token: string; message: string }>(
      `${config.public.apiUrl}/register/complete`,
      {
        method: "POST",
        body: formData,
      }
    );

    // Store token using auth store
    await login(response.token);

    toast.add({
      title: t("auth.completeSignup.success"),
      description: t("auth.completeSignup.successDescription"),
      color: "success",
    });

    // Redirect to dashboard or app
    router.push($localePath("dashboard"));
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
  <div v-if="isVerifying" class="flex items-center justify-center py-12">
    <UIcon name="i-lucide-loader-2" class="text-primary h-8 w-8 animate-spin" />
  </div>

  <div v-else-if="isValid" class="mx-auto w-full max-w-4xl px-6">
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
