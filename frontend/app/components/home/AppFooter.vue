<script setup lang="ts">
const { t } = useI18n();

const columns = computed(() => [
  {
    label: t('footer.resources.title'),
    children: [
      {
        label: t('footer.resources.helpCenter'),
      },
      {
        label: t('footer.resources.docs'),
      },
      {
        label: t('footer.resources.roadmap'),
      },
      {
        label: t('footer.resources.changelog'),
      },
    ],
  },
  {
    label: t('footer.features.title'),
    children: [
      {
        label: t('footer.features.affiliates'),
      },
      {
        label: t('footer.features.portal'),
      },
      {
        label: t('footer.features.jobs'),
      },
      {
        label: t('footer.features.sponsors'),
      },
    ],
  },
  {
    label: t('footer.company.title'),
    children: [
      {
        label: t('footer.company.about'),
      },
      {
        label: t('footer.company.pricing'),
      },
      {
        label: t('footer.company.careers'),
      },
      {
        label: t('footer.company.blog'),
      },
    ],
  },
]);

const toast = useToast();

const email = ref("");
const loading = ref(false);

function onSubmit() {
  loading.value = true;

  toast.add({
    title: t('footer.newsletter.subscribed'),
    description: t('footer.newsletter.subscribedMessage'),
  });
}
</script>

<template>
  <USeparator icon="i-simple-icons-nuxtdotjs" class="h-px" />

  <UFooter :ui="{ top: 'border-b border-default' }">
    <template #top>
      <UContainer>
        <UFooterColumns :columns="columns">
          <template #right>
            <form @submit.prevent="onSubmit">
              <UFormField
                name="email"
                :label="$t('footer.newsletter.label')"
                size="lg"
              >
                <UInput
                  v-model="email"
                  type="email"
                  class="w-full"
                  :placeholder="$t('footer.newsletter.placeholder')"
                >
                  <template #trailing>
                    <UButton type="submit" size="xs" :label="$t('footer.newsletter.subscribe')" />
                  </template>
                </UInput>
              </UFormField>
            </form>
          </template>
        </UFooterColumns>
      </UContainer>
    </template>

    <template #left>
      <p class="text-muted text-sm">
        {{ $t('footer.builtWith') }} • © {{ new Date().getFullYear() }}
      </p>
    </template>

    <template #right>
      <UButton
        to="https://go.nuxt.com/discord"
        target="_blank"
        icon="i-simple-icons-discord"
        aria-label="Nuxt on Discord"
        color="neutral"
        variant="ghost"
      />
      <UButton
        to="https://go.nuxt.com/x"
        target="_blank"
        icon="i-simple-icons-x"
        aria-label="Nuxt on X"
        color="neutral"
        variant="ghost"
      />
      <UButton
        to="https://github.com/nuxt-ui-templates/landing"
        target="_blank"
        icon="i-simple-icons-github"
        aria-label="Nuxt UI on GitHub"
        color="neutral"
        variant="ghost"
      />
    </template>
  </UFooter>
</template>
