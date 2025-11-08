<template>
  <div class="relative">
    <div
      :class="[
        'fixed left-0 top-0 h-full overflow-y-auto shadow-lg transition-all duration-300',
        isExpanded ? 'w-64' : 'w-16',
      ]"
    >
      <div class="space-y-4 py-4">
        <div class="px-3 py-2">
          <div class="mb-10 flex items-center justify-center">
            <img
              v-if="isExpanded"
              src="https://picsum.photos/200/100"
              alt="Logo"
            />
            <img
              v-else
              src="https://picsum.photos/50/50"
              alt="Logo"
              class="rounded-full"
            />
          </div>
          <Button
            variant="outline"
            size="icon"
            @click="toggleSidebar"
            :class="[
              'fixed top-16 z-20 rounded-full p-1 shadow-md transition-all duration-300',
              isExpanded ? 'left-60' : 'left-12',
            ]"
          >
            <Icon
              :icon="
                isExpanded
                  ? 'radix-icons:chevron-left'
                  : 'radix-icons:chevron-right'
              "
              class="h-[1rem] w-[1rem]"
            />
          </Button>
          <div class="space-y-1">
            <Button
              :variant="$route.path === '/' ? 'secondary' : 'ghost'"
              :class="[
                'w-full',
                isExpanded ? 'justify-start' : 'justify-center px-2',
              ]"
              @click="navigateTo('/')"
            >
              <Icon
                icon="radix-icons:dashboard"
                class="h-[1rem] w-[1rem]"
                :class="isExpanded ? 'mr-2' : 'flex-shrink-0'"
              />
              <span v-if="isExpanded">{{ t("sidebar.dashboard") }}</span>
            </Button>
            <Button
              :variant="$route.path === '/forms' ? 'secondary' : 'ghost'"
              :class="[
                'w-full',
                isExpanded ? 'justify-start' : 'justify-center px-2',
              ]"
              @click="navigateTo('/forms')"
            >
              <Icon
                icon="radix-icons:rows"
                class="h-[1rem] w-[1rem]"
                :class="isExpanded ? 'mr-2' : 'flex-shrink-0'"
              />
              <span v-if="isExpanded">{{ t("sidebar.forms") }}</span>
            </Button>
            <Button
              :variant="$route.path === '/responses' ? 'secondary' : 'ghost'"
              :class="[
                'w-full',
                isExpanded ? 'justify-start' : 'justify-center px-2',
              ]"
              @click="navigateTo('/responses')"
            >
              <Icon
                icon="radix-icons:bar-chart"
                class="h-[1rem] w-[1rem]"
                :class="isExpanded ? 'mr-2' : 'flex-shrink-0'"
              />
              <span v-if="isExpanded">{{ t("sidebar.responses") }}</span>
            </Button>
            <Button
              :variant="
                $route.path === '/class-management' ? 'secondary' : 'ghost'
              "
              :class="[
                'w-full',
                isExpanded ? 'justify-start' : 'justify-center px-2',
              ]"
              @click="navigateTo('/class-management')"
            >
              <Icon
                icon="ic:baseline-school"
                class="h-[1rem] w-[1rem]"
                :class="isExpanded ? 'mr-2' : 'flex-shrink-0'"
              />
              <span v-if="isExpanded">{{ t("sidebar.classManagement") }}</span>
            </Button>
            <Button
              :variant="
                $route.path === '/teacher-management' ? 'secondary' : 'ghost'
              "
              :class="[
                'w-full',
                isExpanded ? 'justify-start' : 'justify-center px-2',
              ]"
              @click="navigateTo('/teacher-management')"
            >
              <Icon
                icon="mdi:teacher"
                class="h-[1rem] w-[1rem]"
                :class="isExpanded ? 'mr-2' : 'flex-shrink-0'"
              />
              <span v-if="isExpanded">{{
                t("sidebar.trainerManagement")
              }}</span>
            </Button>
            <Button
              :variant="
                $route.path === '/organization-settings' ? 'secondary' : 'ghost'
              "
              :class="[
                'w-full',
                isExpanded ? 'justify-start' : 'justify-center px-2',
              ]"
              @click="navigateTo('/organization-settings')"
            >
              <Icon
                icon="radix-icons:gear"
                class="h-[1rem] w-[1rem]"
                :class="isExpanded ? 'mr-2' : 'flex-shrink-0'"
              />
              <span v-if="isExpanded">{{ t("sidebar.settings") }}</span>
            </Button>
          </div>
        </div>
      </div>
      <div class="absolute bottom-3 left-0 w-full px-3">
        <DropdownMenu>
          <DropdownMenuTrigger as-child>
            <Button
              :variant="isExpanded ? 'outline' : 'ghost'"
              class="flex h-12 w-full items-center justify-center gap-2"
              :class="isExpanded ? 'justify-start shadow-lg' : 'p-0'"
            >
              <Avatar class="h-8 w-8">
                <AvatarFallback>{{ userNameFirstLetter }}</AvatarFallback>
              </Avatar>
              <span v-if="isExpanded" class="text-sm font-medium">{{
                authStore.userName
              }}</span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent class="w-56">
            <DropdownMenuLabel>{{ t("sidebar.myAccount") }}</DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuGroup>
              <DropdownMenuItem>
                <Icon
                  icon="radix-icons:person"
                  class="mr-3 h-[1rem] w-[1rem]"
                />
                <span>{{ t("sidebar.profile") }}</span>
              </DropdownMenuItem>
              <DropdownMenuItem>
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke-width="1.5"
                  stroke="currentColor"
                  class="mr-3 h-[1rem] w-[1rem]"
                >
                  <path
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m3.75 9v7.5m2.25-6.466a9.016 9.016 0 0 0-3.461-.203c-.536.072-.974.478-1.021 1.017a4.559 4.559 0 0 0-.018.402c0 .464.336.844.775.994l2.95 1.012c.44.15.775.53.775.994 0 .136-.006.27-.018.402-.047.539-.485.945-1.021 1.017a9.077 9.077 0 0 1-3.461-.203M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z"
                  />
                </svg>
                <span>{{ t("sidebar.billing") }}</span>
              </DropdownMenuItem>
              <DropdownMenuItem>
                <Icon icon="radix-icons:gear" class="mr-3 h-[1rem] w-[1rem]" />
                <span>{{ t("sidebar.settings") }}</span>
              </DropdownMenuItem>
              <DropdownMenuItem @click="logout">
                <Icon icon="radix-icons:exit" class="mr-3 h-[1rem] w-[1rem]" />
                <span>{{ t("sidebar.logout") }}</span>
              </DropdownMenuItem>
            </DropdownMenuGroup>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
      <Separator orientation="vertical" class="absolute right-0 top-0 h-full" />
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from "vue";
import { Icon } from "@iconify/vue";
import { navigateTo } from "#app";
import { useI18n } from "vue-i18n";
import { useAuthStore } from "@/stores/authStore";

const authStore = useAuthStore();

const { t } = useI18n();

const emit = defineEmits(["toggle"]);

const isExpanded = ref(true);
const userNameFirstLetter = computed(() => {
  const names = authStore.userName.split(" ");
  return names.length > 1
    ? names[0].charAt(0).toUpperCase() + names[1].charAt(0).toUpperCase()
    : names[0].charAt(0).toUpperCase();
});

const toggleSidebar = () => {
  isExpanded.value = !isExpanded.value;
  emit("toggle", isExpanded.value);
};

const logout = () => {
  authStore.logout();
  navigateTo("/login");
};
</script>
