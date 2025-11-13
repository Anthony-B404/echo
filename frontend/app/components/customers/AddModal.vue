<script setup lang="ts">
import * as z from "zod";
import type { FormSubmitEvent } from "@nuxt/ui";

const { t } = useI18n();

const schema = z.object({
  name: z.string().min(2, t('components.customers.addModal.validation.nameTooShort')),
  email: z.string().email(t('components.customers.addModal.validation.invalidEmail')),
});
const open = ref(false);

type Schema = z.output<typeof schema>;

const state = reactive<Partial<Schema>>({
  name: undefined,
  email: undefined,
});

const toast = useToast();
async function onSubmit(event: FormSubmitEvent<Schema>) {
  toast.add({
    title: t('components.customers.addModal.successTitle'),
    description: t('components.customers.addModal.successDescription', { name: event.data.name }),
    color: "success",
  });
  open.value = false;
}
</script>

<template>
  <UModal
    v-model:open="open"
    :title="t('components.customers.addModal.title')"
    :description="t('components.customers.addModal.description')"
  >
    <UButton :label="t('components.customers.addModal.button')" icon="i-lucide-plus" />

    <template #body>
      <UForm
        :schema="schema"
        :state="state"
        class="space-y-4"
        @submit="onSubmit"
      >
        <UFormField :label="t('common.labels.name')" :placeholder="t('components.customers.addModal.namePlaceholder')" name="name">
          <UInput v-model="state.name" class="w-full" />
        </UFormField>
        <UFormField
          :label="t('common.labels.email')"
          :placeholder="t('components.customers.addModal.emailPlaceholder')"
          name="email"
        >
          <UInput v-model="state.email" class="w-full" />
        </UFormField>
        <div class="flex justify-end gap-2">
          <UButton
            :label="t('common.buttons.cancel')"
            color="neutral"
            variant="subtle"
            @click="open = false"
          />
          <UButton
            :label="t('common.buttons.create')"
            color="primary"
            variant="solid"
            type="submit"
          />
        </div>
      </UForm>
    </template>
  </UModal>
</template>
