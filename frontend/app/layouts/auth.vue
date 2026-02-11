<template>
  <div class="flex min-h-screen flex-col bg-slate-50 dark:bg-slate-950">
    <main class="flex flex-1 items-center justify-center px-4 py-8">
      <div class="max-w-lg w-full">
        <div class="mb-8 flex justify-center">
          <NuxtLink to="/" class="flex items-center gap-2">
            <img src="/favicon.svg" alt="DH-Echo" class="h-10 w-10">
            <span class="text-2xl font-bold text-highlighted">DH-Echo</span>
          </NuxtLink>
        </div>
        <UPageCard variant="subtle" class="w-full">
          <slot />
        </UPageCard>
      </div>
    </main>
    <AppFooter />
  </div>
</template>
