<script setup lang="ts">
defineProps<{
  icon?: string
  title: string
  description?: string
}>()
</script>

<template>
  <div class="flex flex-col items-center justify-center py-12 text-center">
    <div class="w-16 h-16 rounded-full bg-elevated flex items-center justify-center mb-4">
      <UIcon :name="icon || 'i-lucide-inbox'" class="w-8 h-8 text-muted" />
    </div>
    <h3 class="text-lg font-medium text-highlighted mb-1">{{ title }}</h3>
    <p v-if="description" class="text-sm text-muted max-w-sm">{{ description }}</p>
    <slot />
  </div>
</template>
