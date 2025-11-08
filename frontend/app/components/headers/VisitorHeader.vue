<template>
  <div>
    <header
      class="relative flex items-center justify-between px-4 py-3 shadow-sm"
    >
      <div class="flex items-center space-x-6">
        <img
          src="https://picsum.photos/200/100"
          alt="Logo"
          class="h-8 w-auto"
        />
      </div>
      <div class="flex items-center space-x-4">
        <Button variant="ghost" size="icon" @click="isDark = !isDark">
          <Icon
            v-if="isDark"
            icon="radix-icons:sun"
            class="h-5 w-5 transition-all"
          />
          <Icon v-else icon="radix-icons:moon" class="h-5 w-5 transition-all" />
          <span class="sr-only">{{
            isDark ? t("header.lightMode") : t("header.darkMode")
          }}</span>
        </Button>
      </div>
    </header>
  </div>
</template>

<script setup lang="ts">
import { Icon } from "@iconify/vue";
import { computed } from "vue";
import { useI18n } from "vue-i18n";
const { t } = useI18n();

// @ts-ignore
const colorMode = useColorMode();

const isDark = computed({
  get() {
    return colorMode.value === "dark";
  },
  set() {
    colorMode.preference = colorMode.value === "dark" ? "light" : "dark";
  },
});
</script>
