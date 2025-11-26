<script setup lang="ts">
import type { Period, Range, Stat } from "~/types";

const { t } = useI18n();

const props = defineProps<{
  period: Period;
  range: Range;
}>();

function formatCurrency(value: number): string {
  return value.toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  });
}

const baseStats = computed(() => [
  {
    title: t('components.home.stats.customers'),
    icon: "i-lucide-users",
    minValue: 400,
    maxValue: 1000,
    minVariation: -15,
    maxVariation: 25,
  },
  {
    title: t('components.home.stats.conversions'),
    icon: "i-lucide-chart-pie",
    minValue: 1000,
    maxValue: 2000,
    minVariation: -10,
    maxVariation: 20,
  },
  {
    title: t('components.home.revenue'),
    icon: "i-lucide-circle-dollar-sign",
    minValue: 200000,
    maxValue: 500000,
    minVariation: -20,
    maxVariation: 30,
    formatter: formatCurrency,
  },
  {
    title: t('components.home.stats.orders'),
    icon: "i-lucide-shopping-cart",
    minValue: 100,
    maxValue: 300,
    minVariation: -5,
    maxVariation: 15,
  },
]);

const { data: stats } = await useAsyncData<Stat[]>(
  "stats",
  async () => {
    return baseStats.value.map((stat) => {
      const value = randomInt(stat.minValue, stat.maxValue);
      const variation = randomInt(stat.minVariation, stat.maxVariation);

      return {
        title: stat.title,
        icon: stat.icon,
        value: stat.formatter ? stat.formatter(value) : value,
        variation,
      };
    });
  },
  {
    watch: [() => props.period, () => props.range],
    default: () => [],
  },
);
</script>

<template>
  <UPageGrid class="gap-4 sm:gap-6 lg:grid-cols-4 lg:gap-px">
    <UPageCard
      v-for="(stat, index) in stats"
      :key="index"
      :icon="stat.icon"
      :title="stat.title"
      :to="$localePath('dashboard-customers')"
      variant="subtle"
      :ui="{
        container: 'gap-y-1.5',
        wrapper: 'items-start',
        leading:
          'p-2.5 rounded-full bg-primary/10 ring ring-inset ring-primary/25 flex-col',
        title: 'font-normal text-muted text-xs uppercase',
      }"
      class="first:rounded-l-lg last:rounded-r-lg hover:z-1 lg:rounded-none"
    >
      <div class="flex items-center gap-2">
        <span class="text-highlighted text-2xl font-semibold">
          {{ stat.value }}
        </span>

        <UBadge
          :color="stat.variation > 0 ? 'success' : 'error'"
          variant="subtle"
          class="text-xs"
        >
          {{ stat.variation > 0 ? "+" : "" }}{{ stat.variation }}%
        </UBadge>
      </div>
    </UPageCard>
  </UPageGrid>
</template>
