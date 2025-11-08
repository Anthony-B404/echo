<template>
  <div>
    <AutoForm
      class="w-full space-y-6"
      :schema="schema"
      :form="form"
      :field-config="{
        email: {
          hideLabel: true,
          label: 'Email',
          inputProps: {
            type: 'email',
            placeholder: t('emailPlaceholder'),
          },
        },
        password: {
          hideLabel: true,
          label: 'Mot de passe',
          inputProps: {
            type: 'password',
            placeholder: t('passwordPlaceholder'),
          },
        },
        rememberMe: {
          hideLabel: false,
          label: 'Se souvenir de moi',
        },
      }"
      @submit="onSubmit"
    >
      <Button :disabled="props.isLoading" class="w-full">
        <template v-if="props.isLoading">
          <ReloadIcon class="mr-2 h-4 w-4 animate-spin" />
          {{ t("pleaseWait") }}
        </template>
        <template v-else>
          {{ t("login") }}
        </template>
      </Button>
    </AutoForm>
  </div>
</template>

<script setup lang="ts">
import { ReloadIcon } from "@radix-icons/vue";
import * as z from "zod";
import { useForm } from "vee-validate";
import { toTypedSchema } from "@vee-validate/zod";
import { useI18n } from "vue-i18n";

const { t } = useI18n();

const props = defineProps<{
  isLoading: boolean;
}>();

const emit = defineEmits(["submit"]);

async function onSubmit(values: Record<string, any>) {
  emit("submit", {
    email: values.email,
    password: values.password,
    rememberMe: values.rememberMe,
  });
}

const schema = z.object({
  email: z.string({
    required_error: t("emailRequired"),
  }),
  password: z.string({
    required_error: t("passwordRequired"),
  }),
  rememberMe: z.boolean().optional().default(true),
});

const form = useForm({
  validationSchema: toTypedSchema(schema),
});
</script>
