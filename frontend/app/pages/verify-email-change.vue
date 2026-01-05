<script setup lang="ts">
const { t } = useI18n();
const route = useRoute();
const router = useRouter();
const { $localePath } = useNuxtApp();
const toast = useToast();
const { fetchUser } = useAuth();
const api = useApi();

definePageMeta({
  layout: "auth",
});

useSeoMeta({
  title: t("seo.verifyEmailChange.title"),
  description: t("seo.verifyEmailChange.description"),
});

const token = ref(route.query.token as string);
const isVerifying = ref(true);

// Verify email change token on mount
onMounted(async () => {
  if (!token.value) {
    toast.add({
      title: t("auth.verifyEmailChange.error"),
      description: t("auth.verifyEmailChange.noToken"),
      color: "error",
    });
    router.push($localePath("index"));
    return;
  }

  try {
    await api(`/verify-email-change/${token.value}`);

    // Refresh user data in Pinia store to get updated email
    await fetchUser();

    toast.add({
      title: t("auth.verifyEmailChange.success"),
      description: t("auth.verifyEmailChange.successDescription"),
      color: "success",
    });

    // Redirect to dashboard
    router.push($localePath("dashboard"));
  } catch (error: any) {
    toast.add({
      title: t("auth.verifyEmailChange.error"),
      description: error.data?.message || t("auth.verifyEmailChange.invalidToken"),
      color: "error",
    });
    router.push($localePath("index"));
  } finally {
    isVerifying.value = false;
  }
});
</script>

<template>
  <div class="flex min-h-[60vh] items-center justify-center">
    <div class="text-center">
      <div v-if="isVerifying" class="space-y-4">
        <div class="flex justify-center">
          <div class="bg-primary/10 rounded-full p-4">
            <UIcon name="i-lucide-loader-2" class="text-primary h-12 w-12 animate-spin" />
          </div>
        </div>
        <h1 class="text-foreground text-2xl font-bold">
          {{ $t("auth.verifyEmailChange.verifying") }}
        </h1>
        <p class="text-muted-foreground">
          {{ $t("auth.verifyEmailChange.pleaseWait") }}
        </p>
      </div>
    </div>
  </div>
</template>
