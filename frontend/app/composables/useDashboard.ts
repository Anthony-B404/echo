import { createSharedComposable } from "@vueuse/core";

const _useDashboard = () => {
  const route = useRoute();
  const router = useRouter();
  const localePath = useLocalePath();
  const isNotificationsSlideoverOpen = ref(false);

  defineShortcuts({
    "g-h": () => router.push(localePath("/dashboard")),
    "g-i": () => router.push(localePath("/dashboard/inbox")),
    "g-c": () => router.push(localePath("/dashboard/customers")),
    "g-s": () => router.push(localePath("/dashboard/settings")),
    n: () =>
      (isNotificationsSlideoverOpen.value =
        !isNotificationsSlideoverOpen.value),
  });

  watch(
    () => route.fullPath,
    () => {
      isNotificationsSlideoverOpen.value = false;
    },
  );

  return {
    isNotificationsSlideoverOpen,
  };
};

export const useDashboard = createSharedComposable(_useDashboard);
