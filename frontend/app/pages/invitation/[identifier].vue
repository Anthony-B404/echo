<template>
  <div class="flex h-full items-center justify-center">
    <div class="flex w-full max-w-md lg:p-8">
      <div class="mx-auto flex w-full flex-col justify-center space-y-6">
        <div class="flex flex-col space-y-2 text-center">
          <img
            v-if="organizationLogo"
            :src="organizationLogo"
            alt="Logo de l'organisation"
            class="mx-auto h-16 w-16 rounded-full"
          />
          <h1 class="text-2xl font-semibold tracking-tight">
            Finaliser votre inscription
          </h1>
          <p class="text-sm text-muted-foreground">
            Vous avez été invité à rejoindre {{ organizationName }}
          </p>
        </div>

        <Form
          @submit="handleSubmit"
          :validation-schema="toTypedSchema(formSchema)"
          class="space-y-4"
        >
          <FormField v-slot="{ componentField }" name="fullName">
            <FormItem>
              <FormLabel>Nom complet</FormLabel>
              <FormControl>
                <Input type="text" v-bind="componentField" />
              </FormControl>
              <FormMessage />
            </FormItem>
          </FormField>

          <FormField v-slot="{ componentField }" name="password">
            <FormItem>
              <FormLabel>Mot de passe</FormLabel>
              <FormControl>
                <Input type="password" v-bind="componentField" />
              </FormControl>
              <FormMessage />
            </FormItem>
          </FormField>

          <FormField v-slot="{ componentField }" name="confirmPassword">
            <FormItem>
              <FormLabel>Confirmation du mot de passe</FormLabel>
              <FormControl>
                <Input type="password" v-bind="componentField" />
              </FormControl>
              <FormMessage />
            </FormItem>
          </FormField>

          <Button type="submit" class="w-full">
            Finaliser l'inscription
          </Button>
        </Form>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from "vue";
import { useRoute, navigateTo } from "#app";
import { useApi } from "@/composables/useApi";
import { toast } from "@/components/ui/toast";
import * as z from "zod";
import { toTypedSchema } from "@vee-validate/zod";
import { definePageMeta } from "#imports";

const route = useRoute();
const identifier = route.params.identifier as string;
const organizationName = ref("");
const organizationLogo = ref("");
const isLoading = ref(true);

const formSchema = z
  .object({
    fullName: z.string().min(1, "Le nom complet est requis"),
    password: z
      .string()
      .min(8, "Le mot de passe doit contenir au moins 8 caractères"),
    confirmPassword: z.string(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Les mots de passe doivent correspondre",
    path: ["confirmPassword"],
  });

onMounted(async () => {
  const { get } = useApi();
  try {
    const response = await get(`/check-invitation/${identifier}`);
    organizationName.value = response.organizationName;
    organizationLogo.value = response.organizationLogo;
  } catch (error) {
    toast({
      title: "Erreur",
      description: "Cette invitation n'est pas valide ou a expiré.",
      variant: "destructive",
    });
    navigateTo("/login");
  } finally {
    isLoading.value = false;
  }
});

const handleSubmit = async (values: z.infer<typeof formSchema>) => {
  const { post } = useApi();
  try {
    await post(`/accept-invitation`, {
      identifier,
      fullName: values.fullName,
      password: values.password,
    });

    toast({
      title: "Succès",
      description:
        "Votre compte a été créé avec succès. Vous pouvez maintenant vous connecter.",
    });

    navigateTo("/login");
  } catch (error) {
    toast({
      title: "Erreur",
      description:
        "Une erreur est survenue lors de la création de votre compte.",
      variant: "destructive",
    });
  }
};

definePageMeta({
  layout: "visitor",
});
</script>
