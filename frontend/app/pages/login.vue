<template>
  <div class="flex h-full items-center justify-center">
    <div class="flex w-full max-w-md lg:p-8">
      <div class="mx-auto flex w-full flex-col justify-center space-y-6">
        <div class="flex flex-col space-y-2 text-center">
          <h1 class="text-2xl font-semibold tracking-tight">
            {{ $t("login") }}
          </h1>
          <p class="text-sm text-muted-foreground">
            {{ $t("loginInstructions") }}
          </p>
        </div>
        <UserAuthForm :is-loading="isLoading" @submit="signIn" />

        <!-- Link to Signup -->
        <div class="text-center text-sm">
          <span class="text-muted-foreground">{{ $t("noAccountYet") }}</span>
          <NuxtLink to="/signup" class="ml-1 text-primary hover:underline">
            {{ $t("signupHere") }}
          </NuxtLink>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { useRuntimeConfig } from "#app";
import { ref } from "vue";
import { navigateTo } from "#app";
import { toast } from "@/components/ui/toast";
import { useI18n } from "vue-i18n";
import { useAuthStore } from "@/stores/authStore";
import { definePageMeta } from "#imports";
import { useApi } from "@/composables/useApi";

const { t } = useI18n();

const isLoading = ref(false);
const api = useApi();

const signIn = async ({
  email,
  password,
  rememberMe,
}: {
  email: string;
  password: string;
  rememberMe: boolean;
}) => {
  isLoading.value = true;

  const { post } = useApi();

  await post("/login", { email, password })
    .then((response) => {
      const authStore = useAuthStore();
      authStore.login(
        response.user.role,
        response.token.token,
        response.user.fullName,
        rememberMe,
        response.user.emailVerified,
      );
      navigateTo("/");
    })
    .catch(() => {
      toast({
        title: t("loginError"),
        description: t("checkCredentials"),
        variant: "destructive",
      });
    })
    .finally(() => {
      isLoading.value = false;
    });
};

definePageMeta({
  layout: "visitor",
});
</script>
