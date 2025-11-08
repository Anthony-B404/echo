<template>
  <div>
    <h1 class="mb-8 text-3xl font-bold">
      {{ $t("welcome") }}, {{ authStore.userName }} 👋
    </h1>

    <div class="mx-auto grid max-w-7xl grid-cols-1 gap-8">
      <Card class="shadow-lg transition-shadow duration-300 hover:shadow-xl">
        <CardHeader>
          <CardTitle class="text-2xl">{{
            $t("departmentComparison")
          }}</CardTitle>
        </CardHeader>
        <CardContent>
          <AreaChart
            :data="departementsData"
            :colors="['#F44336', '#4CAF50', '#2196F3']"
            :categories="['informatique', 'economie', 'droit']"
            index="month"
          />
        </CardContent>
      </Card>

      <div class="grid grid-cols-1 gap-8 md:grid-cols-2 lg:grid-cols-3">
        <Card class="shadow-md transition-shadow duration-300 hover:shadow-lg">
          <CardHeader>
            <CardTitle>{{ $t("surveysCompleted") }}</CardTitle>
          </CardHeader>
          <CardContent>
            <p class="text-center text-5xl font-bold text-primary">
              {{ numberOfSurveys }}
            </p>
            <p class="mt-2 text-center text-sm text-gray-600">
              {{ $t("totalThisYear") }}
            </p>
          </CardContent>
        </Card>

        <Card class="shadow-md transition-shadow duration-300 hover:shadow-lg">
          <CardHeader>
            <CardTitle>{{ $t("surveyParticipation") }}</CardTitle>
          </CardHeader>
          <CardContent>
            <div class="relative pt-1">
              <div
                class="mb-4 flex h-4 overflow-hidden rounded bg-blue-200 text-xs"
              >
                <div
                  :style="{ width: `${completionRate}%` }"
                  class="flex flex-col justify-center whitespace-nowrap bg-blue-500 text-center text-white shadow-none transition-all duration-500 ease-in-out"
                ></div>
              </div>
              <div class="text-center text-lg font-semibold">
                {{ completionRate }}% {{ $t("completed") }}
              </div>
            </div>
          </CardContent>
        </Card>

        <Card class="shadow-md transition-shadow duration-300 hover:shadow-lg">
          <CardHeader>
            <CardTitle>{{ $t("overallSatisfaction") }}</CardTitle>
          </CardHeader>
          <CardContent>
            <div class="flex flex-col items-center justify-center">
              <div class="mb-2 text-5xl font-bold text-primary">
                {{ overallSatisfaction }}%
              </div>
              <p class="mt-4 text-center text-sm text-gray-600">
                {{ $t("basedOnThisYearResponses") }}
              </p>
            </div>
          </CardContent>
        </Card>

        <Card class="shadow-md transition-shadow duration-300 hover:shadow-lg">
          <CardHeader>
            <CardTitle>{{ $t("newSurvey") }}</CardTitle>
          </CardHeader>
          <CardContent class="flex flex-col items-center">
            <p class="mb-4 text-center">{{ $t("createNewSurveyQuickly") }}</p>
            <NuxtLink to="/forms">
              <Button class="w-full">{{ $t("createSurvey") }}</Button>
            </NuxtLink>
          </CardContent>
        </Card>

        <Card class="shadow-md transition-shadow duration-300 hover:shadow-lg">
          <CardHeader>
            <CardTitle>{{ $t("addTeacher") }}</CardTitle>
          </CardHeader>
          <CardContent class="flex flex-col items-center">
            <p class="mb-4 text-center">
              {{ $t("addTeacherAndManageClasses") }}
            </p>
            <NuxtLink>
              <Button class="w-full">{{
                $t("addTeacherAndManageClasses")
              }}</Button>
            </NuxtLink>
          </CardContent>
        </Card>

        <Card class="shadow-md transition-shadow duration-300 hover:shadow-lg">
          <CardHeader>
            <CardTitle>{{ $t("recentResults") }}</CardTitle>
          </CardHeader>
          <CardContent class="flex flex-col items-center">
            <p class="mb-4 text-center">{{ $t("viewLatestResults") }}</p>
            <NuxtLink>
              <Button class="w-full">{{ $t("viewResults") }}</Button>
            </NuxtLink>
          </CardContent>
        </Card>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { useI18n } from "vue-i18n";
import { useAuthStore } from "@/stores/authStore";

const authStore = useAuthStore();
const { t } = useI18n();

const numberOfSurveys = 150;
const completionRate = 85;

const departementsData = [
  { month: t("jan"), informatique: 85, economie: 80, droit: 75 },
  { month: t("feb"), informatique: 87, economie: 82, droit: 78 },
  { month: t("mar"), informatique: 85, economie: 80, droit: 75 },
  { month: t("apr"), informatique: 87, economie: 82, droit: 78 },
  { month: t("may"), informatique: 85, economie: 80, droit: 75 },
  { month: t("jun"), informatique: 87, economie: 82, droit: 78 },
  { month: t("jul"), informatique: 85, economie: 80, droit: 75 },
  { month: t("aug"), informatique: 87, economie: 82, droit: 78 },
  { month: t("sep"), informatique: 85, economie: 80, droit: 75 },
  { month: t("oct"), informatique: 87, economie: 82, droit: 78 },
  { month: t("nov"), informatique: 85, economie: 80, droit: 75 },
  { month: t("dec"), informatique: 87, economie: 82, droit: 78 },
];

const overallSatisfaction = 80;
</script>
