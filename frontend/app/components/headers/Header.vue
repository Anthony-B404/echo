<template>
  <div>
    <header class="relative flex items-center justify-end px-4 py-2">
      <Button variant="ghost" size="icon" @click="isDark = !isDark">
        <Icon
          v-if="isDark"
          icon="radix-icons:sun"
          class="h-[1.2rem] w-[1.2rem] transition-all"
        />
        <Icon
          v-else
          icon="radix-icons:moon"
          class="h-[1.2rem] w-[1.2rem] transition-all"
        />
      </Button>
      <Separator
        orientation="horizontal"
        class="absolute bottom-0 left-0 w-full"
      />
    </header>
  </div>
</template>

<script setup lang="ts">
import { Icon } from "@iconify/vue";
import { computed } from "vue";

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
