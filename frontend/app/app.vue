<script setup lang="ts">
const colorMode = useColorMode();
const themeStore = useThemeStore();

const color = computed(() =>
  colorMode.value === "dark" ? "#171717" : "white",
);

useHead({
  meta: [
    { name: "viewport", content: "width=device-width, initial-scale=1" },
    { key: "theme-color", name: "theme-color", content: color },
  ],
  link: [{ rel: "icon", href: "/favicon.ico" }],
  htmlAttrs: {
    lang: "fr",
  },
});

onMounted(() => {
  themeStore.restoreTheme();
});
</script>

<template>
  <UApp :toaster="{ expand: false }">
    <NuxtLoadingIndicator />

    <UMain>
      <NuxtLayout>
        <NuxtPage />
      </NuxtLayout>
    </UMain>
  </UApp>
</template>
