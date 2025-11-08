<template>
  <div>
    <header
      class="relative flex items-center justify-between px-4 py-3 shadow-sm"
    >
      <div class="flex items-center space-x-6">
        <NuxtLink
          to="/"
          class="flex items-center transition-opacity hover:opacity-80"
        >
          <img
            src="https://picsum.photos/200/100"
            alt="Logo"
            class="h-8 w-auto"
          />
        </NuxtLink>
        <NavigationMenu>
          <NavigationMenuList class="flex space-x-2">
            <NavigationMenuItem>
              <NuxtLink to="/">
                <NavigationMenuLink
                  class="rounded-md px-3 py-2 transition-colors hover:bg-gray-100 dark:hover:bg-gray-800"
                >
                  {{ t("header.dashboard") }}
                </NavigationMenuLink>
              </NuxtLink>
            </NavigationMenuItem>
            <NavigationMenuItem>
              <NuxtLink to="/forms">
                <NavigationMenuLink
                  class="rounded-md px-3 py-2 transition-colors hover:bg-gray-100 dark:hover:bg-gray-800"
                >
                  {{ t("header.forms") }}
                </NavigationMenuLink>
              </NuxtLink>
            </NavigationMenuItem>
          </NavigationMenuList>
        </NavigationMenu>
      </div>
      <div class="flex items-center space-x-4">
        <Dialog>
          <DialogTrigger asChild>
            <Button variant="default" class="flex items-center gap-2">
              <Icon icon="radix-icons:paper-plane" />
              Envoyer
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{{ t("dialog.sendForm.title") }}</DialogTitle>
              <DialogDescription>{{
                t("dialog.sendForm.description")
              }}</DialogDescription>
            </DialogHeader>

            <div class="flex flex-col gap-4">
              <div class="flex flex-col gap-2">
                <Label>Classe</Label>
                <Select v-model="selectedClass">
                  <SelectTrigger>
                    <SelectValue :placeholder="t('form.selectClass')" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem
                      v-for="classe in classes"
                      :key="classe.id"
                      :value="classe.id"
                    >
                      {{ classe.name }}
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div class="flex flex-col gap-2">
                <Label>Module</Label>
                <Select
                  v-model="selectedModule"
                  :disabled="formStore.modules.length === 0"
                >
                  <SelectTrigger>
                    <SelectValue :placeholder="t('form.selectModule')" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem
                      v-for="module in formStore.modules"
                      :key="module.id"
                      :value="module.id"
                    >
                      {{ module.name }}
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <DialogFooter>
              <DialogClose as-child>
                <Button variant="outline">{{
                  t("dialog.sendForm.cancel")
                }}</Button>
              </DialogClose>
              <DialogClose as-child>
                <Button @click="confirmSendForm">{{
                  t("dialog.sendForm.send")
                }}</Button>
              </DialogClose>
            </DialogFooter>
          </DialogContent>
        </Dialog>
        <Dialog>
          <DialogTrigger asChild>
            <Button v-if="isAdmin" variant="default" @click="defineTitle">
              Sauvegarder
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{{ t("dialog.saveTemplate.title") }}</DialogTitle>
              <DialogDescription>{{
                t("dialog.saveTemplate.description")
              }}</DialogDescription>
            </DialogHeader>

            <div class="flex flex-col gap-4">
              <div class="flex flex-col gap-2">
                <Label>{{ t("dialog.saveTemplate.templateTitle") }}</Label>
                <Input
                  v-model="formStore.formTitle"
                  placeholder="{{ t('dialog.saveTemplate.templatePlaceholder') }}"
                />
              </div>

              <div class="flex flex-col gap-2">
                <Label>{{ t("dialog.saveTemplate.modules") }}</Label>
                <TagsInputWithCombobox
                  :selected="formStore.modules"
                  :items="modules"
                  @update:modelValue="updateModules"
                />
              </div>
            </div>

            <DialogFooter>
              <DialogClose as-child>
                <Button variant="outline">{{
                  t("dialog.saveTemplate.cancel")
                }}</Button>
              </DialogClose>
              <DialogClose as-child>
                <Button @click="formStore.saveAsTemplate">{{
                  t("dialog.saveTemplate.save")
                }}</Button>
              </DialogClose>
            </DialogFooter>
          </DialogContent>
        </Dialog>
        <Button variant="ghost" @click="goToPreview">
          <Icon icon="radix-icons:eye-open" class="h-5 w-5" />
        </Button>
        <Button variant="ghost" size="icon" @click="isDark = !isDark">
          <Icon
            v-if="isDark"
            icon="radix-icons:sun"
            class="h-5 w-5 transition-all"
          />
          <Icon v-else icon="radix-icons:moon" class="h-5 w-5 transition-all" />
          <span class="sr-only">
            {{ isDark ? t("header.lightMode") : t("header.darkMode") }}
          </span>
        </Button>
      </div>
    </header>
  </div>
</template>

<script setup lang="ts">
import { Icon } from "@iconify/vue";
import { computed, ref, onMounted } from "vue";
import { useI18n } from "vue-i18n";
import { navigateTo } from "#app";
import { useAuthStore, UserRole } from "@/stores/authStore";
import { useFormStore } from "@/stores/formStore";
import { useApi } from "@/composables/useApi";
import { toast } from "@/components/ui/toast";

const { t } = useI18n();
const authStore = useAuthStore();
const formStore = useFormStore();
const isAdmin = computed(() => authStore.role === UserRole.ADMIN);

interface Class {
  id: number;
  name: string;
}

// @ts-ignore
const colorMode = useColorMode();

const isDark = computed({
  get() {
    return colorMode.value === "dark";
  },
  set() {
    colorMode.preference = colorMode.value === "dark" ? "light" : "dark";
  },
});

const goToPreview = () => {
  formStore.savePreviewData();
  window.open("/fill-form", "_blank");
};

const modules = ref<{ id: number; name: string }[]>([]);

const updateModules = (moduleIds: number[]) => {
  formStore.modules = modules.value.filter((m) => moduleIds.includes(m.id));
};

const fetchModules = async () => {
  try {
    const response = await useApi().get("/modules", true);
    modules.value = response;
    if (modules.value.length === 1) {
      selectedModule.value = modules.value[0].id;
      formStore.modules = [modules.value[0]];
    }
  } catch (error) {
    console.error("Erreur lors de la récupération des modules:", error);
    toast({
      title: t("toast.error.title"),
      description: t("toast.error.modules"),
      variant: "destructive",
    });
  }
};

const classes = ref<Class[]>([]);

const fetchClasses = async () => {
  const response = await useApi().get("/classes", true);
  classes.value = response;
  if (classes.value.length === 1) {
    selectedClass.value = classes.value[0].id;
  }
};

const defineTitle = () => {
  if (formStore.id === 0) {
    const htmlTitle = formStore.formData[0]?.items[0]?.title || "";
    // Créer un élément div temporaire pour parser le HTML
    const tempDiv = document.createElement("div");
    tempDiv.innerHTML = htmlTitle;
    // Récupérer le texte sans les balises HTML
    formStore.formTitle = tempDiv.textContent || "";
  }
};

const selectedClass = ref<number | null>(null);
const selectedModule = ref<number | null>(null);
const confirmSendForm = () => {
  if (selectedClass.value && selectedModule.value) {
    sendForm();
  } else {
    toast({
      title: t("toast.error.title"),
      description: t("toast.error.selection"),
      variant: "destructive",
    });
  }
};

const sendForm = async () => {
  const { post } = useApi();
  try {
    await post(
      `/form-submissions`,
      {
        title: formStore.formTitle,
        formData: JSON.stringify(formStore.formData),
        classId: selectedClass.value,
        moduleId: selectedModule.value,
      },
      true,
    );
    toast({
      title: t("toast.success.title"),
      description: t("toast.success.description"),
    });
  } catch (error) {
    toast({
      title: t("toast.error.title"),
      description: t("toast.error.send"),
      variant: "destructive",
    });
    console.error("Erreur lors de l'envoi du formulaire:", error);
  }
};

onMounted(() => {
  fetchModules();
  fetchClasses();
});
</script>
