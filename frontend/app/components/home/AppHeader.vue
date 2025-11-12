<script setup lang="ts">
const { t } = useI18n();
const nuxtApp = useNuxtApp();
const { activeHeadings, updateHeadings } = useScrollspy();

const items = computed(() => [
  {
    label: t("nav.features"),
    to: "#features",
    active:
      activeHeadings.value.includes("features") &&
      !activeHeadings.value.includes("pricing"),
  },
  {
    label: t("nav.pricing"),
    to: "#pricing",
    active: activeHeadings.value.includes("pricing"),
  },
  {
    label: t("nav.testimonials"),
    to: "#testimonials",
    active:
      activeHeadings.value.includes("testimonials") &&
      !activeHeadings.value.includes("pricing"),
  },
]);

nuxtApp.hooks.hookOnce("page:finish", () => {
  updateHeadings(
    [
      document.querySelector("#features"),
      document.querySelector("#pricing"),
      document.querySelector("#testimonials"),
    ].filter(Boolean) as Element[],
  );
});
</script>

<template>
  <UHeader>
    <template #left>
      <NuxtLink :to="$localePath('index')">
        <HomeAppLogo class="h-8 w-32" />
      </NuxtLink>
    </template>

    <template #right>
      <UNavigationMenu :items="items" variant="link" class="hidden lg:block" />

      <UButton
        :label="$t('nav.downloadApp')"
        variant="subtle"
        class="hidden lg:block"
      />

      <UColorModeButton />
    </template>

    <template #body>
      <UNavigationMenu :items="items" orientation="vertical" class="-mx-2.5" />
      <UButton
        class="mt-4"
        :label="$t('nav.downloadApp')"
        variant="subtle"
        block
      />
    </template>
  </UHeader>
</template>
