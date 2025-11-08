<template>
  <div class="flex">
    <Sidebar @toggle="isExpanded = !isExpanded" />
    <main
      class="flex-1 transition-all duration-300"
      :style="{ marginLeft: isExpanded ? '16rem' : '4rem' }"
    >
      <Header />
      <NuxtPage class="mt-10 p-6" />
    </main>
  </div>
</template>

<script setup lang="ts">
import { ref } from "vue";
import Header from "@/components/headers/Header.vue";

const isExpanded = ref(true);
</script>
