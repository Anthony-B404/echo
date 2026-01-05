<script setup lang="ts">
import type { DropdownMenuItem } from "@nuxt/ui";
import type { FormSubmitEvent } from "@nuxt/ui";
import { useOrganizationStore } from "~/stores/organization";
import { storeToRefs } from "pinia";
import * as z from "zod";

const { t } = useI18n();
const config = useRuntimeConfig();
const toast = useToast();
const { authenticatedFetch, user } = useAuth();

defineProps<{
  collapsed?: boolean;
}>();

// Récupérer l'organisation depuis le store
const organizationStore = useOrganizationStore();
const { organization, organizations, loading } = storeToRefs(organizationStore);

// Charger toutes les organisations au montage
onMounted(() => {
  if (organizations.value.length === 0) {
    organizationStore.fetchUserOrganizations();
  }
});

// État de la modale de création d'organisation
const createOrgModalOpen = ref(false);
const submitting = ref(false);
const formRef = ref();
const fileRef = ref<HTMLInputElement>();
const logoPreview = ref<string>();

// Schéma de validation Zod
const schema = z.object({
  name: z.preprocess(
    (val) => val ?? "",
    z.string().superRefine((val, ctx) => {
      if (!val || val.length === 0) {
        ctx.addIssue({
          code: "custom",
          message: t(
            "components.teams.createOrganizationModal.validation.nameRequired",
          ),
        });
      } else if (val.length < 2) {
        ctx.addIssue({
          code: "custom",
          message: t(
            "components.teams.createOrganizationModal.validation.nameTooShort",
          ),
        });
      }
    }),
  ),
  email: z.preprocess(
    (val) => val ?? "",
    z.string().superRefine((val, ctx) => {
      if (!val || val.length === 0) {
        ctx.addIssue({
          code: "custom",
          message: t(
            "components.teams.createOrganizationModal.validation.emailRequired",
          ),
        });
      } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(val)) {
        ctx.addIssue({
          code: "custom",
          message: t(
            "components.teams.createOrganizationModal.validation.invalidEmail",
          ),
        });
      }
    }),
  ),
  logo: z.string().optional(),
});

type Schema = z.output<typeof schema>;

// État du formulaire
const state = reactive<Partial<Schema>>({
  name: undefined,
  email: undefined,
});

// Calculer l'URL du logo
const logoUrl = computed(() => {
  if (!organization.value?.logo) {
    return null;
  }
  return `${config.public.apiUrl}/${organization.value.logo}`;
});

// Créer l'objet team à partir de l'organisation
const currentTeam = computed(() => {
  if (!organization.value) {
    return {
      label: t("components.teams.loading"),
      avatar: undefined,
    };
  }

  return {
    label: organization.value.name,
    avatar: logoUrl.value
      ? {
          src: logoUrl.value,
          alt: organization.value.name,
        }
      : undefined,
  };
});

// Ouvrir la modale de création d'organisation
const openCreateOrgModal = () => {
  // Pré-remplir l'email avec celui de l'utilisateur
  state.email = user.value?.email;
  createOrgModalOpen.value = true;
};

// Gérer le changement de fichier logo
function onFileChange(e: Event) {
  const input = e.target as HTMLInputElement;

  if (!input.files?.length) {
    return;
  }

  logoPreview.value = URL.createObjectURL(input.files[0]!);
}

// Ouvrir le sélecteur de fichier
function onFileClick() {
  fileRef.value?.click();
}

// Supprimer le logo
function onRemoveLogo() {
  logoPreview.value = undefined;
  // Clear file input
  if (fileRef.value) {
    fileRef.value.value = "";
  }
}

// Switcher vers une autre organisation
async function switchOrganization(orgId: number) {
  try {
    // Appeler l'API pour changer d'organisation
    await authenticatedFetch(`/organizations/${orgId}/switch`, {
      method: "POST",
    });

    // Recharger toutes les organisations (mise à jour du isCurrent)
    await organizationStore.fetchUserOrganizations();

    // Afficher un toast de succès
    toast.add({
      title: t("common.messages.success"),
      description: t("components.teams.organizationSwitched"),
      color: "success",
    });
  } catch (error: any) {
    toast.add({
      title: t("common.messages.error"),
      description:
        error.data?.message || t("components.teams.organizationSwitchError"),
      color: "error",
    });
  }
}

// Soumission du formulaire de création d'organisation
async function onSubmit(event: FormSubmitEvent<Schema>) {
  submitting.value = true;

  try {
    // Préparer FormData avec le format attendu par le backend
    const formData = new FormData();
    formData.append(
      "organization",
      JSON.stringify({
        name: event.data.name,
        email: event.data.email,
      }),
    );

    // Ajouter le logo si un fichier a été sélectionné
    const fileInput = fileRef.value;
    if (fileInput?.files && fileInput.files.length > 0) {
      const file = fileInput.files[0];
      if (file) {
        formData.append("logo", file);
      }
    }

    // Créer l'organisation
    const response = await authenticatedFetch<{
      message: string;
      organization: { id: number; name: string; email: string };
    }>("/organizations", {
      method: "POST",
      body: formData,
    });

    // Switcher vers la nouvelle organisation
    await authenticatedFetch(
      `/organizations/${response.organization.id}/switch`,
      {
        method: "POST",
      },
    );

    // Rafraîchir les données de toutes les organisations
    await organizationStore.fetchUserOrganizations();

    // Afficher un toast de succès
    toast.add({
      title: t("components.teams.createOrganizationModal.successTitle"),
      description: t(
        "components.teams.createOrganizationModal.successDescription",
      ),
      color: "success",
    });

    // Fermer la modal et réinitialiser le formulaire
    createOrgModalOpen.value = false;
    state.name = undefined;
    state.email = undefined;
    logoPreview.value = undefined;
    if (fileRef.value) {
      fileRef.value.value = "";
    }
  } catch (error: any) {
    // Afficher un toast d'erreur
    toast.add({
      title: t("components.teams.createOrganizationModal.errorTitle"),
      description:
        error.data?.message ||
        t("components.teams.createOrganizationModal.errorDescription"),
      color: "error",
    });
  } finally {
    submitting.value = false;
  }
}

const items = computed<DropdownMenuItem[][]>(() => {
  const localePath = useLocalePath();

  // Construire la liste des organisations
  const organizationItems = organizations.value.map((org) => {
    return {
      id: `org-${org.id}`,
      label: org.name,
      avatar: org.logo
        ? {
            src: `${config.public.apiUrl}/${org.logo}`,
            alt: org.name,
          }
        : undefined,
      // Show check icon if current
      trailingIcon: org.isCurrent ? "i-lucide-check" : undefined,
      class: org.isCurrent ? "bg-primary/10" : undefined,
      onClick: () => {
        if (!org.isCurrent) {
          switchOrganization(org.id);
        }
      },
    };
  });

  return [
    organizationItems,
    [
      {
        label: t("components.teams.createTeam"),
        icon: "i-lucide-circle-plus",
        onClick: openCreateOrgModal,
      },
      {
        label: t("components.teams.manageTeams"),
        icon: "i-lucide-cog",
        to: localePath("/dashboard/settings/organization"),
      },
    ],
  ];
});
</script>

<template>
  <UDropdownMenu
    :items="items"
    :content="{ align: 'center', collisionPadding: 12 }"
    :ui="{
      content: collapsed ? 'w-40' : 'w-(--reka-dropdown-menu-trigger-width)',
    }"
  >
    <UButton
      v-bind="{
        ...currentTeam,
        label: collapsed ? undefined : currentTeam?.label,
        trailingIcon: collapsed ? undefined : 'i-lucide-chevrons-up-down',
      }"
      color="neutral"
      variant="ghost"
      block
      :square="collapsed"
      :disabled="loading"
      class="data-[state=open]:bg-elevated"
      :class="[!collapsed && 'py-2']"
      :ui="{
        trailingIcon: 'text-dimmed',
      }"
    />

  </UDropdownMenu>

  <!-- Modale de création d'organisation -->
  <UModal
    v-model:open="createOrgModalOpen"
    :title="$t('components.teams.createOrganizationModal.title')"
    :description="$t('components.teams.createOrganizationModal.description')"
    :ui="{ footer: 'justify-end' }"
  >
    <template #body>
      <UForm
        ref="formRef"
        :schema="schema"
        :state="state"
        class="space-y-4"
        @submit="onSubmit"
      >
        <UFormField
          :label="
            $t('components.teams.createOrganizationModal.organizationName')
          "
          name="name"
        >
          <UInput
            v-model="state.name"
            :placeholder="
              $t(
                'components.teams.createOrganizationModal.organizationNamePlaceholder',
              )
            "
            icon="i-lucide-building"
            size="lg"
            class="w-full"
          />
        </UFormField>

        <UFormField
          :label="
            $t('components.teams.createOrganizationModal.organizationEmail')
          "
          name="email"
        >
          <UInput
            v-model="state.email"
            type="email"
            :placeholder="
              $t(
                'components.teams.createOrganizationModal.organizationEmailPlaceholder',
              )
            "
            icon="i-lucide-mail"
            size="lg"
            class="w-full"
          />
        </UFormField>

        <UFormField
          :label="$t('components.teams.createOrganizationModal.logo')"
          name="logo"
        >
          <div class="flex items-center gap-3">
            <UAvatar :src="logoPreview" :alt="state.name || 'Logo'" size="lg" />
            <UButton
              :label="$t('common.buttons.choose')"
              color="neutral"
              size="md"
              @click="onFileClick"
            />
            <UButton
              v-if="logoPreview"
              :label="$t('common.buttons.delete')"
              color="error"
              variant="ghost"
              size="md"
              @click="onRemoveLogo"
            />
            <input
              ref="fileRef"
              type="file"
              class="hidden"
              accept=".jpg, .jpeg, .png, .gif"
              @change="onFileChange"
            />
          </div>
        </UFormField>
      </UForm>
    </template>

    <template #footer="{ close }">
      <UButton
        :label="$t('common.buttons.cancel')"
        color="neutral"
        variant="outline"
        :disabled="submitting"
        @click="close"
      />
      <UButton
        :label="$t('common.buttons.create')"
        color="primary"
        :loading="submitting"
        @click="formRef?.submit()"
      />
    </template>
  </UModal>
</template>
