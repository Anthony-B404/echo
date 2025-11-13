<script setup lang="ts">
import * as z from "zod";
import type { FormError } from "@nuxt/ui";

const { t } = useI18n();

const passwordSchema = z.object({
  current: z.string().min(8, "Must be at least 8 characters"),
  new: z.string().min(8, "Must be at least 8 characters"),
});

type PasswordSchema = z.output<typeof passwordSchema>;

const password = reactive<Partial<PasswordSchema>>({
  current: undefined,
  new: undefined,
});

const validate = (state: Partial<PasswordSchema>): FormError[] => {
  const errors: FormError[] = [];
  if (state.current && state.new && state.current === state.new) {
    errors.push({ name: "new", message: "Passwords must be different" });
  }
  return errors;
};
</script>

<template>
  <UPageCard
    :title="t('pages.dashboard.settings.security.title')"
    :description="t('pages.dashboard.settings.security.description')"
    class="from-error/10 to-default bg-gradient-to-tl from-5%"
  >
    <template #footer>
      <UButton :label="t('common.buttons.deleteAccount')" color="error" />
    </template>
  </UPageCard>
</template>
