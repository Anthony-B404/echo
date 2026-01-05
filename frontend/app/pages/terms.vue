<script setup lang="ts">
const { t } = useI18n();

definePageMeta({
  layout: "auth",
});

useSeoMeta({
  title: t("seo.terms.title"),
  description: t("seo.terms.description"),
});
</script>

<template>
  <div class="mx-auto max-w-3xl px-4 py-8">
    <h1 class="mb-6 text-2xl font-bold">{{ $t("terms.title") }}</h1>

    <div class="prose prose-sm dark:prose-invert">
      <p class="text-muted mb-4">
        {{ $t("terms.lastUpdated") }}
      </p>

      <section class="mb-8">
        <h2 class="mb-3 text-lg font-semibold">{{ $t("terms.sections.usage.title") }}</h2>
        <p>{{ $t("terms.sections.usage.content") }}</p>
      </section>

      <section class="mb-8">
        <h2 class="mb-3 text-lg font-semibold">{{ $t("terms.sections.privacy.title") }}</h2>
        <p>{{ $t("terms.sections.privacy.content") }}</p>
      </section>

      <section class="mb-8">
        <h2 class="mb-3 text-lg font-semibold">{{ $t("terms.sections.limitations.title") }}</h2>
        <p>{{ $t("terms.sections.limitations.content") }}</p>
      </section>
    </div>

    <div class="mt-8">
      <UButton
        :to="$localePath('index')"
        variant="ghost"
        icon="i-lucide-arrow-left"
      >
        {{ $t("terms.backToHome") }}
      </UButton>
    </div>
  </div>
</template>
