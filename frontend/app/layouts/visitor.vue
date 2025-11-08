<template>
  <main class="flex min-h-screen flex-col">
    <VisitorHeader />
    <NuxtPage class="flex-grow p-6" />
  </main>
</template>

<script setup lang="ts">
import VisitorHeader from "@/components/headers/VisitorHeader.vue";
</script>
