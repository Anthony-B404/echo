<template>
  <div class="flex h-full items-center justify-center">
    <div class="flex w-full max-w-md lg:p-8">
      <div class="mx-auto flex w-full flex-col justify-center space-y-6">
        <div class="flex flex-col space-y-2 text-center">
          <h1 class="text-2xl font-semibold tracking-tight">
            Vérification de votre email requise
          </h1>
          <p class="text-sm text-muted-foreground">
            Veuillez vérifier votre email avant de continuer. Un lien de
            vérification vous a été envoyé.
          </p>

          <div class="mt-4 flex flex-col gap-4">
            <Button @click="resendVerification" :disabled="isLoading">
              {{
                isLoading
                  ? "Envoi en cours..."
                  : "Renvoyer le lien de vérification"
              }}
            </Button>
            <Button variant="outline" @click="logout"> Se déconnecter </Button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { onMounted, ref } from "vue";
import { useAuthStore } from "@/stores/authStore";
import { useApi } from "@/composables/useApi";
import { toast } from "@/components/ui/toast";
import { navigateTo } from "#app";
import { definePageMeta } from "#imports";

const authStore = useAuthStore();
const isLoading = ref(false);

const resendVerification = async () => {
  const { post } = useApi();
  isLoading.value = true;

  try {
    await post("/resend-verification", {}, true);
    toast({
      title: "Email envoyé",
      description: "Un nouveau lien de vérification vous a été envoyé.",
    });
  } catch (error) {
    toast({
      title: "Erreur",
      description:
        "Impossible d'envoyer le lien de vérification. Veuillez réessayer plus tard.",
      variant: "destructive",
    });
  } finally {
    isLoading.value = false;
  }
};

const logout = () => {
  authStore.logout();
  navigateTo("/login");
};

onMounted(async () => {
  const { get } = useApi();
  get("/check-email-verification", true).then((response) => {
    authStore.setIsEmailVerified(response.emailVerified);
    if (response.emailVerified) {
      navigateTo("/");
    }
  });
});

definePageMeta({
  layout: "visitor",
});
</script>
