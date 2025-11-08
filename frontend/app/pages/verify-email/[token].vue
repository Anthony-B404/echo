<template>
  <div class="flex h-full items-center justify-center">
    <div class="flex w-full max-w-md lg:p-8">
      <div class="mx-auto flex w-full flex-col justify-center space-y-6">
        <div class="flex flex-col space-y-2 text-center">
          <h1 class="text-2xl font-semibold tracking-tight">
            Vérification de votre email
          </h1>
          <div v-if="isLoading" class="flex flex-col items-center">
            <p class="mt-2 text-sm text-muted-foreground">
              Vérification en cours...
            </p>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from "vue";
import { useRoute, navigateTo } from "#app";
import { useApi } from "@/composables/useApi";
import { Icon } from "@iconify/vue";
import { definePageMeta } from "#imports";
import { toast } from "@/components/ui/toast";
import { useAuthStore } from "@/stores/authStore";

const authStore = useAuthStore();
const route = useRoute();
const token = route.params.token as string;
const isLoading = ref(true);

onMounted(async () => {
  const { get } = useApi();
  try {
    await get(`/verify-email/${token}`);

    authStore.setIsEmailVerified(true);

    toast({
      title: "Email vérifié avec succès !",
    });
  } catch (error) {
    toast({
      title: "Le lien de vérification est invalide ou a expiré",
      variant: "destructive",
    });
  } finally {
    navigateTo("/");
  }
});

definePageMeta({
  layout: "visitor",
});
</script>
