<script setup lang="ts">
import * as z from "zod";
import type { FormSubmitEvent } from "@nuxt/ui";

const { t } = useI18n();
const route = useRoute();
const router = useRouter();
const { $localePath } = useNuxtApp();
const toast = useToast();
const { login } = useAuth();
const api = useApi();

definePageMeta({
  layout: "auth",
});

useSeoMeta({
  title: t("seo.resellerSetup.title"),
  description: t("seo.resellerSetup.description"),
});

const token = ref(route.params.token as string);
const isVerifying = ref(true);
const isValid = ref(false);
const isExpired = ref(false);
const isSubmitting = ref(false);
const userData = ref<{
  email: string;
  firstName: string | null;
  lastName: string | null;
  organizationName: string | null;
} | null>(null);
const fileRef = ref<HTMLInputElement>();

// Verify magic link token on mount
onMounted(async () => {
  if (!token.value) {
    toast.add({
      title: t("auth.resellerSetup.error"),
      description: t("auth.resellerSetup.noToken"),
      color: "error",
    });
    router.push($localePath("index"));
    return;
  }

  try {
    const response = await api<{
      email: string;
      firstName: string | null;
      lastName: string | null;
      organizationName: string | null;
      token: string;
      isDisabled: boolean;
    }>(`/verify-magic-link/${token.value}`);

    // Check if the response contains a token (means user is already onboarded - login flow)
    // In that case, the user should use the verify-login page instead
    if (response.token && !response.firstName && !response.lastName) {
      // This shouldn't happen for setup flow, redirect to index
      toast.add({
        title: t("auth.resellerSetup.alreadyCompleted"),
        description: t("auth.resellerSetup.alreadyCompletedDescription"),
        color: "warning",
      });
      router.push($localePath("index"));
      return;
    }

    userData.value = {
      email: response.email,
      firstName: response.firstName,
      lastName: response.lastName,
      organizationName: response.organizationName,
    };
    isValid.value = true;

    // Pre-fill form with existing data
    if (response.firstName) {
      state.firstName = response.firstName;
    }
    if (response.lastName) {
      state.lastName = response.lastName;
    }
    if (response.organizationName) {
      state.organizationName = response.organizationName;
    }
  } catch (error: any) {
    if (error.status === 401) {
      isExpired.value = true;
    } else {
      toast.add({
        title: t("auth.resellerSetup.error"),
        description: error.data?.message || t("auth.resellerSetup.tokenInvalid"),
        color: "error",
      });
    }
    isValid.value = false;
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

// Logo management functions
function onFileChange(e: Event) {
  const input = e.target as HTMLInputElement;

  if (!input.files?.length) {
    return;
  }

  state.logo = URL.createObjectURL(input.files[0]!);
}

function onFileClick() {
  fileRef.value?.click();
}

function onRemoveLogo() {
  state.logo = undefined;
  // Clear file input
  if (fileRef.value) {
    fileRef.value.value = "";
  }
}

// Get logo URL (for preview)
const logoUrl = computed(() => {
  if (!state.logo) return undefined;

  // If it's a blob URL (local preview), use it directly
  if (state.logo.startsWith("blob:")) {
    return state.logo;
  }

  return state.logo;
});

async function onSubmit(event: FormSubmitEvent<Schema>) {
  isSubmitting.value = true;
  try {
    // Prepare FormData
    const formData = new FormData();
    formData.append("magicLinkToken", token.value);
    formData.append("firstName", event.data.firstName);
    formData.append("lastName", event.data.lastName);
    formData.append("organizationName", event.data.organizationName);

    // Add logo if file was selected
    const fileInput = fileRef.value;
    if (fileInput?.files && fileInput.files.length > 0) {
      formData.append("logo", fileInput.files[0]);
    }

    const response = await api<{ token: string; message: string }>(
      "/complete-registration",
      {
        method: "POST",
        body: formData,
      },
    );

    // Store token using auth store
    await login(response.token);

    toast.add({
      title: t("auth.resellerSetup.success"),
      description: t("auth.resellerSetup.successDescription"),
      color: "success",
    });

    // Redirect to dashboard
    router.push($localePath("dashboard"));
  } catch (error: any) {
    toast.add({
      title: t("auth.resellerSetup.error"),
      description: error.data?.message || t("auth.resellerSetup.errorDescription"),
      color: "error",
    });
  } finally {
    isSubmitting.value = false;
  }
}
</script>

<template>
  <!-- Loading state -->
  <div v-if="isVerifying" class="flex min-h-[60vh] items-center justify-center">
    <div class="text-center">
      <div class="space-y-4">
        <div class="flex justify-center">
          <div class="bg-primary/10 rounded-full p-4">
            <UIcon name="i-lucide-loader-2" class="text-primary h-12 w-12 animate-spin" />
          </div>
        </div>
        <h1 class="text-foreground text-2xl font-bold">
          {{ $t("auth.resellerSetup.verifying") }}
        </h1>
        <p class="text-muted-foreground">
          {{ $t("auth.resellerSetup.pleaseWait") }}
        </p>
      </div>
    </div>
  </div>

  <!-- Token expired -->
  <div v-else-if="isExpired" class="flex min-h-[60vh] items-center justify-center">
    <div class="text-center">
      <div class="space-y-4">
        <div class="flex justify-center">
          <div class="bg-warning/10 rounded-full p-4">
            <UIcon name="i-lucide-clock" class="text-warning h-12 w-12" />
          </div>
        </div>
        <h1 class="text-foreground text-2xl font-bold">
          {{ $t("auth.resellerSetup.tokenExpired") }}
        </h1>
        <p class="text-muted-foreground max-w-md">
          {{ $t("auth.resellerSetup.tokenExpiredDescription") }}
        </p>
        <UButton :to="$localePath('index')" class="mt-4">
          {{ $t("common.actions.backToHome") }}
        </UButton>
      </div>
    </div>
  </div>

  <!-- Token invalid -->
  <div v-else-if="!isValid" class="flex min-h-[60vh] items-center justify-center">
    <div class="text-center">
      <div class="space-y-4">
        <div class="flex justify-center">
          <div class="bg-error/10 rounded-full p-4">
            <UIcon name="i-lucide-x-circle" class="text-error h-12 w-12" />
          </div>
        </div>
        <h1 class="text-foreground text-2xl font-bold">
          {{ $t("auth.resellerSetup.tokenInvalid") }}
        </h1>
        <p class="text-muted-foreground max-w-md">
          {{ $t("auth.resellerSetup.tokenInvalidDescription") }}
        </p>
        <UButton :to="$localePath('index')" class="mt-4">
          {{ $t("common.actions.backToHome") }}
        </UButton>
      </div>
    </div>
  </div>

  <!-- Valid token - Show form -->
  <div v-else class="mx-auto w-full max-w-4xl px-6">
    <div class="mb-10 text-center">
      <div class="mb-6 flex justify-center">
        <div class="bg-primary/10 rounded-full p-4">
          <UIcon name="i-lucide-store" class="text-primary h-8 w-8" />
        </div>
      </div>
      <h1 class="text-foreground mb-3 text-3xl font-bold tracking-tight">
        {{ $t("auth.resellerSetup.title") }}
      </h1>
      <p class="text-muted-foreground text-base">
        {{ $t("auth.resellerSetup.subtitle") }}
      </p>
      <p v-if="userData" class="text-muted-foreground mt-2 text-sm font-medium">
        {{ userData.email }}
      </p>
    </div>

    <UForm
      :schema="schema"
      :state="state"
      class="space-y-5"
      @submit="onSubmit"
    >
      <UFormField :label="$t('auth.resellerSetup.firstName')" name="firstName">
        <UInput
          v-model="state.firstName"
          :placeholder="$t('auth.resellerSetup.firstNamePlaceholder')"
          class="w-full"
          size="lg"
        />
      </UFormField>

      <UFormField :label="$t('auth.resellerSetup.lastName')" name="lastName">
        <UInput
          v-model="state.lastName"
          :placeholder="$t('auth.resellerSetup.lastNamePlaceholder')"
          class="w-full"
          size="lg"
        />
      </UFormField>

      <UFormField :label="$t('auth.resellerSetup.organizationName')" name="organizationName">
        <UInput
          v-model="state.organizationName"
          :placeholder="$t('auth.resellerSetup.organizationNamePlaceholder')"
          class="w-full"
          size="lg"
        />
      </UFormField>

      <UFormField :label="$t('auth.resellerSetup.logo')" name="logo">
        <div class="flex flex-wrap items-center gap-3">
          <UAvatar :src="logoUrl" alt="Logo" size="lg" />
          <UButton
            :label="$t('common.buttons.choose')"
            color="neutral"
            @click="onFileClick"
          />
          <UButton
            v-if="state.logo"
            :label="$t('common.actions.remove')"
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
        <p class="text-muted-foreground mt-1 text-sm">
          {{ $t("auth.resellerSetup.logoHint") }}
        </p>
      </UFormField>

      <UButton
        type="submit"
        block
        class="mt-6"
        size="lg"
        :loading="isSubmitting"
        :disabled="isSubmitting"
      >
        {{ $t("auth.resellerSetup.submit") }}
      </UButton>
    </UForm>
  </div>
</template>
