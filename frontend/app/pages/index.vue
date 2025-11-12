<script setup lang="ts">
const { t } = useI18n();

definePageMeta({
  layout: "default",
});

// Helper to parse ***text*** syntax into HTML with text-primary class
const parseStyledText = (text: string) => {
  return text.replace(
    /\*\*\*([^*]+)\*\*\*/g,
    '<span class="text-primary">$1</span>',
  );
};

const page = computed(() => ({
  seo: {
    title: t("home.seo.title"),
    description: t("home.seo.description"),
  },
  title: t("home.hero.title"),
  description: t("home.hero.description"),
  hero: {
    links: [
      {
        label: t("home.hero.getStarted"),
        icon: "i-lucide-arrow-right",
        trailing: true,
        color: "primary",
        to: "https://ui.nuxt.com/docs/getting-started/installation/nuxt",
        target: "_blank",
        size: "xl",
      },
      {
        label: t("home.hero.cloneGithub"),
        icon: "i-simple-icons-github",
        size: "xl",
        color: "neutral",
        variant: "outline",
        to: "https://github.com/nuxt-ui-templates/landing",
        target: "_blank",
      },
    ],
  },
  section: {
    title: t("home.section.title"),
    description: t("home.section.description"),
    images: {
      mobile: "/images/macbook-mobile.svg",
      desktop: "/images/macbook.svg",
    },
    features: [
      {
        title: t("home.section.features.optimizeFocus.title"),
        description: t("home.section.features.optimizeFocus.description"),
        class: "border-l border-primary pl-4",
      },
      {
        title: t("home.section.features.trackHours.title"),
        description: t("home.section.features.trackHours.description"),
        class: "border-l border-default pt-4 pl-4",
      },
      {
        title: t("home.section.features.improveWorkflow.title"),
        description: t("home.section.features.improveWorkflow.description"),
        class: "border-l border-default pt-4 pl-4",
      },
    ],
  },
  features: {
    title: t("home.features.title"),
    description: t("home.features.description"),
    features: [
      {
        title: t("home.features.items.aiTracking.title"),
        description: t("home.features.items.aiTracking.description"),
        icon: "i-lucide-wand-sparkles",
        ui: {
          leading:
            "bg-accented/50 p-2 rounded-md border border-muted border-dashed",
        },
      },
      {
        title: t("home.features.items.distractionAlerts.title"),
        description: t("home.features.items.distractionAlerts.description"),
        icon: "i-lucide-bell-ring",
        ui: {
          leading:
            "bg-accented/50 p-2 rounded-md border border-muted border-dashed",
        },
      },
      {
        title: t("home.features.items.codeSnippets.title"),
        description: t("home.features.items.codeSnippets.description"),
        icon: "i-lucide-code-xml",
        ui: {
          leading:
            "bg-accented/50 p-2 rounded-md border border-muted border-dashed",
        },
      },
      {
        title: t("home.features.items.deepWork.title"),
        description: t("home.features.items.deepWork.description"),
        icon: "i-lucide-moon",
        ui: {
          leading:
            "bg-accented/50 p-2 rounded-md border border-muted border-dashed",
        },
      },
      {
        title: t("home.features.items.collaborative.title"),
        description: t("home.features.items.collaborative.description"),
        icon: "i-lucide-mouse-pointer-2",
        ui: {
          leading:
            "bg-accented/50 p-2 rounded-md border border-muted border-dashed",
        },
      },
      {
        title: t("home.features.items.analytics.title"),
        description: t("home.features.items.analytics.description"),
        icon: "i-lucide-chart-line",
        ui: {
          leading:
            "bg-accented/50 p-2 rounded-md border border-muted border-dashed",
        },
      },
    ],
  },
  steps: {
    title: t("home.steps.title"),
    description: t("home.steps.description"),
    items: [
      {
        title: t("home.steps.items.connect.title"),
        description: t("home.steps.items.connect.description"),
        image: {
          light: "/images/light/connect.svg",
          dark: "/images/dark/connect.svg",
        },
      },
      {
        title: t("home.steps.items.track.title"),
        description: t("home.steps.items.track.description"),
        image: {
          light: "/images/light/optimize.svg",
          dark: "/images/dark/optimize.svg",
        },
      },
      {
        title: t("home.steps.items.optimize.title"),
        description: t("home.steps.items.optimize.description"),
        image: {
          light: "/images/light/track.svg",
          dark: "/images/dark/track.svg",
        },
      },
    ],
  },
  pricing: {
    title: t("home.pricing.title"),
    description: t("home.pricing.description"),
    plans: [
      {
        title: t("home.pricing.plans.pro.title"),
        description: t("home.pricing.plans.pro.description"),
        price: "$199",
        billing_period: t("home.pricing.month"),
        billing_cycle: "",
        highlight: false,
        features: [
          t("home.pricing.plans.pro.features.tracking"),
          t("home.pricing.plans.pro.features.alerts"),
          t("home.pricing.plans.pro.features.library"),
          t("home.pricing.plans.pro.features.deepWork"),
          t("home.pricing.plans.pro.features.dashboard"),
          t("home.pricing.plans.pro.features.support"),
        ],
        button: {
          label: t("home.pricing.buyNow"),
          color: "neutral",
          variant: "outline",
          to: "#",
        },
      },
      {
        title: t("home.pricing.plans.team.title"),
        description: t("home.pricing.plans.team.description"),
        price: "$199",
        billing_period: t("home.pricing.month"),
        billing_cycle: "",
        highlight: true,
        features: [
          t("home.pricing.plans.team.features.everything"),
          t("home.pricing.plans.team.features.teamAnalytics"),
          t("home.pricing.plans.team.features.sharing"),
          t("home.pricing.plans.team.features.crossTeam"),
          t("home.pricing.plans.team.features.synchronized"),
          t("home.pricing.plans.team.features.teamSupport"),
        ],
        button: {
          label: t("home.pricing.buyNow"),
          variant: "subtle",
          to: "#",
        },
      },
    ],
  },
  testimonials: {
    title: t("home.testimonials.title"),
    description: t("home.testimonials.description"),
    items: [
      {
        quote: t("home.testimonials.items.sarah.quote"),
        user: {
          name: t("home.testimonials.items.sarah.name"),
          description: t("home.testimonials.items.sarah.role"),
          target: "_blank",
          avatar: {
            src: "https://ipx.nuxt.com/f_auto,s_192x192/gh_avatar/SarahM19",
          },
        },
      },
      {
        quote: t("home.testimonials.items.sebastien.quote"),
        user: {
          name: t("home.testimonials.items.sebastien.name"),
          description: t("home.testimonials.items.sebastien.role"),
          target: "_blank",
          avatar: {
            src: "https://ipx.nuxt.com/f_auto,s_192x192/gh_avatar/atinux",
          },
        },
      },
      {
        quote: t("home.testimonials.items.benjamin.quote"),
        user: {
          name: t("home.testimonials.items.benjamin.name"),
          description: t("home.testimonials.items.benjamin.role"),
          target: "_blank",
          avatar: {
            src: "https://ipx.nuxt.com/f_auto,s_192x192/gh_avatar/benjamincanac",
          },
        },
      },
    ],
  },
  cta: {
    title: t("home.cta.title"),
    description: t("home.cta.description"),
    links: [
      {
        label: t("home.cta.startBuilding"),
        to: "https://ui.nuxt.com/docs/getting-started/installation/nuxt",
        target: "_blank",
        trailingIcon: "i-lucide-arrow-right",
      },
      {
        label: t("home.cta.viewGithub"),
        to: "https://github.com/nuxt-ui-templates/landing",
        target: "_blank",
        variant: "subtle",
        icon: "i-simple-icons-github",
      },
    ],
  },
}));

useSeoMeta({
  title: page.value.seo?.title || page.value.title,
  ogTitle: page.value.seo?.title || page.value.title,
  description: page.value.seo?.description || page.value.description,
  ogDescription: page.value.seo?.description || page.value.description,
});
</script>

<template>
  <div class="relative">
    <div class="hidden lg:block">
      <UColorModeImage
        light="/images/light/line-1.svg"
        dark="/images/dark/line-1.svg"
        class="pointer-events-none absolute top-0 left-0 h-[650px] object-cover pb-10"
      />
    </div>

    <UPageHero
      :title="page.title"
      :description="page.description"
      :links="page.hero.links"
      :ui="{
        container: 'md:pt-18 lg:pt-20',
        title: 'max-w-3xl mx-auto',
      }"
    >
      <template #top>
        <HomeHeroBackground />
      </template>
    </UPageHero>

    <UPageSection
      :description="page.section.description"
      :features="page.section.features"
      orientation="horizontal"
      :ui="{
        container: 'lg:px-0 2xl:px-20 mx-0 max-w-none md:mr-10',
        features: 'gap-0',
      }"
      reverse
    >
      <template #title>
        <h2
          class="sm:leading-11"
          v-html="parseStyledText(page.section.title)"
        />
      </template>
      <img
        :src="page.section.images.desktop"
        :alt="page.section.title"
        class="left-0 hidden w-full max-w-2xl lg:block 2xl:hidden"
      />
      <img
        :src="page.section.images.mobile"
        :alt="page.section.title"
        class="block lg:hidden 2xl:block 2xl:w-full 2xl:max-w-2xl"
      />
    </UPageSection>

    <USeparator :ui="{ border: 'border-primary/30' }" />

    <UPageSection
      id="features"
      :description="page.features.description"
      :features="page.features.features"
      :ui="{
        title: 'text-left @container relative flex',
        description: 'text-left',
      }"
      class="relative overflow-hidden"
    >
      <template #title>
        <h2 class="leading-9" v-html="parseStyledText(page.features.title)" />
        <div class="hidden @min-[1150px]:block">
          <UColorModeImage
            light="/images/light/line-2.svg"
            dark="/images/dark/line-2.svg"
            class="absolute top-0 right-0 size-full translate-x-[70%] scale-95 transform"
          />
        </div>
      </template>

      <div
        class="bg-primary absolute top-10 -left-10 z-10 size-[300px] rounded-full opacity-30 blur-[200px]"
      />
      <div
        class="bg-primary absolute -right-10 -bottom-10 z-10 size-[300px] rounded-full opacity-30 blur-[200px]"
      />
    </UPageSection>

    <USeparator :ui="{ border: 'border-primary/30' }" />

    <UPageSection
      id="steps"
      :description="page.steps.description"
      class="relative overflow-hidden"
    >
      <template #title>
        <h2 v-html="parseStyledText(page.steps.title)" />
      </template>
      <template #headline>
        <UColorModeImage
          light="/images/light/line-3.svg"
          dark="/images/dark/line-3.svg"
          class="absolute -top-10 right-1/2 h-24 sm:top-0"
        />
      </template>

      <template #features>
        <UPageCard
          v-for="(step, index) in page.steps.items"
          :key="index"
          class="group"
          :ui="{ container: 'p-4 sm:p-4', title: 'flex items-center gap-1' }"
        >
          <UColorModeImage
            v-if="step.image"
            :light="step.image?.light"
            :dark="step.image?.dark"
            :alt="step.title"
            class="size-full"
          />

          <div class="flex flex-col gap-2">
            <span class="text-lg font-semibold">
              {{ step.title }}
            </span>
            <span class="text-muted text-sm">
              {{ step.description }}
            </span>
          </div>
        </UPageCard>
      </template>
    </UPageSection>

    <UPageSection
      id="pricing"
      class="mb-32 overflow-hidden"
      :description="page.pricing.description"
      :plans="page.pricing.plans"
      :ui="{ title: 'text-left @container relative', description: 'text-left' }"
    >
      <template #title>
        <h2 v-html="parseStyledText(page.pricing.title)" />
      </template>

      <UPricingPlans scale>
        <UPricingPlan
          v-for="(plan, index) in page.pricing.plans"
          :key="index"
          :title="plan.title"
          :description="plan.description"
          :price="plan.price"
          :billing-period="plan.billing_period"
          :billing-cycle="plan.billing_cycle"
          :highlight="plan.highlight"
          :scale="plan.highlight"
          variant="soft"
          :features="plan.features"
          :button="plan.button"
        />
      </UPricingPlans>
    </UPageSection>

    <UPageSection
      id="testimonials"
      :description="page.testimonials.description"
      :items="page.testimonials.items"
    >
      <template #title>
        <h2 v-html="parseStyledText(page.testimonials.title)" />
      </template>
      <template #headline>
        <UColorModeImage
          light="/images/light/line-5.svg"
          dark="/images/dark/line-5.svg"
          class="absolute -top-10 right-1/2 h-24 sm:top-0"
        />
      </template>

      <UContainer>
        <UPageColumns class="xl:columns-3">
          <UPageCard
            v-for="(testimonial, index) in page.testimonials.items"
            :key="index"
            variant="subtle"
            :description="testimonial.quote"
            :ui="{
              description:
                'before:content-[open-quote] after:content-[close-quote]',
            }"
          >
            <template #footer>
              <UUser v-bind="testimonial.user" size="xl" />
            </template>
          </UPageCard>
        </UPageColumns>
      </UContainer>
    </UPageSection>

    <USeparator />

    <UPageCTA
      :description="page.cta.description"
      :links="page.cta.links"
      variant="naked"
      class="@container overflow-hidden"
    >
      <template #title>
        <h2 v-html="parseStyledText(page.cta.title)" />
        <div class="@max-[1280px]:hidden">
          <UColorModeImage
            light="/images/light/line-6.svg"
            dark="/images/dark/line-6.svg"
            class="absolute -top-10 left-10 h-full sm:top-0"
          />
          <UColorModeImage
            light="/images/light/line-7.svg"
            dark="/images/dark/line-7.svg"
            class="absolute right-0 bottom-0 h-full"
          />
        </div>
      </template>

      <LazyHomeStarsBg />
    </UPageCTA>
  </div>
</template>
