<script setup lang="ts">
import { computed, ref, watch } from "vue";
import { breakpointsTailwind } from "@vueuse/core";
import type { Mail } from "~/types";

definePageMeta({
  middleware: "auth",
});

const { t } = useI18n();

const tabItems = computed(() => [
  {
    label: t('pages.dashboard.inbox.all'),
    value: "all",
  },
  {
    label: t('pages.dashboard.inbox.unread'),
    value: "unread",
  },
]);
const selectedTab = ref("all");

const { data: mails } = await useFetch<Mail[]>("/api/mails", {
  default: () => [],
});

// Filter mails based on the selected tab
const filteredMails = computed(() => {
  if (selectedTab.value === "unread") {
    return mails.value.filter((mail) => !!mail.unread);
  }

  return mails.value;
});

const selectedMail = ref<Mail | null>();

const isMailPanelOpen = computed({
  get() {
    return !!selectedMail.value;
  },
  set(value: boolean) {
    if (!value) {
      selectedMail.value = null;
    }
  },
});

// Reset selected mail if it's not in the filtered mails
watch(filteredMails, () => {
  if (!filteredMails.value.find((mail) => mail.id === selectedMail.value?.id)) {
    selectedMail.value = null;
  }
});

const breakpoints = useBreakpoints(breakpointsTailwind);
const isMobile = breakpoints.smaller("lg");
</script>

<template>
  <UDashboardPanel
    id="inbox-1"
    :default-size="25"
    :min-size="20"
    :max-size="30"
    resizable
  >
    <UDashboardNavbar :title="t('pages.dashboard.inbox.title')">
      <template #leading>
        <UDashboardSidebarCollapse />
      </template>
      <template #trailing>
        <UBadge :label="filteredMails.length" variant="subtle" />
      </template>

      <template #right>
        <UTabs
          v-model="selectedTab"
          :items="tabItems"
          :content="false"
          size="xs"
        />
      </template>
    </UDashboardNavbar>
    <InboxList v-model="selectedMail" :mails="filteredMails" />
  </UDashboardPanel>

  <InboxMail
    v-if="selectedMail"
    :mail="selectedMail"
    @close="selectedMail = null"
  />
  <div v-else class="hidden flex-1 items-center justify-center lg:flex">
    <UIcon name="i-lucide-inbox" class="text-dimmed size-32" />
  </div>

  <ClientOnly>
    <USlideover v-if="isMobile" v-model:open="isMailPanelOpen">
      <template #content>
        <InboxMail
          v-if="selectedMail"
          :mail="selectedMail"
          @close="selectedMail = null"
        />
      </template>
    </USlideover>
  </ClientOnly>
</template>
