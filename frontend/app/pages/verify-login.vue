<script setup lang="ts">
const { t } = useI18n();
const route = useRoute();
const router = useRouter();
const toast = useToast();

definePageMeta({
  layout: "auth",
});

useSeoMeta({
  title: t("seo.verifyLogin.title"),
  description: t("seo.verifyLogin.description"),
});

const token = ref(route.query.token as string);
const isVerifying = ref(true);

// Verify magic link token and auto-login on mount
onMounted(async () => {
  if (!token.value) {
    toast.add({
      title: t("auth.verifyLogin.error"),
      description: t("auth.verifyLogin.noToken"),
      color: "error",
    });
    router.push("/login");
    return;
  }

  try {
    const config = useRuntimeConfig();
    const { login } = useAuth();

    const response = await $fetch<{ token: string }>(
      `${config.public.apiUrl}/verify-magic-link/${token.value}`,
    );

    // Store token using auth store
    await login(response.token);

    toast.add({
      title: t("auth.verifyLogin.success"),
      description: t("auth.verifyLogin.successDescription"),
      color: "success",
    });

    // Redirect to dashboard
    router.push("/dashboard");
  } catch (error: any) {
    toast.add({
      title: t("auth.verifyLogin.error"),
      description: error.data?.message || t("auth.verifyLogin.invalidToken"),
      color: "error",
    });
    router.push("/login");
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
          {{ $t("auth.verifyLogin.verifying") }}
        </h1>
        <p class="text-muted-foreground">
          {{ $t("auth.verifyLogin.pleaseWait") }}
        </p>
      </div>
    </div>
  </div>
</template>
