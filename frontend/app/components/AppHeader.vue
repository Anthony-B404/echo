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
        <AppLogo class="h-8 w-32" />
      </NuxtLink>
    </template>

    <UNavigationMenu :items="items" variant="link" />

    <template #right>
      <UColorModeButton />

      <UButton
        label="Sign up"
        color="neutral"
        trailing-icon="i-lucide-arrow-right"
        class="hidden lg:inline-flex"
        :to="$localePath('signup')"
      />
    </template>

    <template #body>
      <UNavigationMenu :items="items" orientation="vertical" class="-mx-2.5" />

      <USeparator class="my-6" />

      <UButton
        label="Sign up"
        color="neutral"
        :to="$localePath('signup')"
        block
      />
    </template>
  </UHeader>
</template>
