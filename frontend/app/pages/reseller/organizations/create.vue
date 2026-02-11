<script setup lang="ts">
import { z } from 'zod'
import type {
  CreateOrganizationPayload,
  AddUserPayload,
  RenewalType,
  BusinessSector
} from '~/types/reseller'

definePageMeta({
  layout: 'reseller',
  middleware: ['auth', 'reseller']
})

const { t } = useI18n()
const localePath = useLocalePath()
const toast = useToast()

// Breadcrumb
const breadcrumbItems = computed(() => [
  {
    label: t('reseller.navigation.dashboard'),
    icon: 'i-lucide-home',
    to: localePath('/reseller')
  },
  {
    label: t('reseller.navigation.organizations'),
    icon: 'i-lucide-building-2',
    to: localePath('/reseller/organizations')
  },
  { label: t('reseller.organizations.create.title'), icon: 'i-lucide-plus' }
])

useSeoMeta({
  title: t('reseller.organizations.create.title')
})

const { createOrganization, addUser, loading, error } =
  useResellerOrganizations()
const { fetchProfile } = useResellerProfile()
const { sectorOptions } = useBusinessSectors()

// Available credits from reseller pool
const availableCredits = ref<number>(0)

onMounted(async () => {
  const profile = await fetchProfile()
  if (profile) {
    availableCredits.value = profile.creditBalance
  }
})

// Stepper configuration
const stepper = useTemplateRef('stepper')
const currentStep = ref('organization')

const steps = computed(() => [
  {
    value: 'organization',
    title: t('reseller.organizations.steps.organization'),
    description: t('reseller.organizations.steps.organizationDesc'),
    icon: 'i-lucide-building-2'
  },
  {
    value: 'credits',
    title: t('reseller.organizations.steps.credits'),
    description: t('reseller.organizations.steps.creditsDesc'),
    icon: 'i-lucide-coins'
  },
  {
    value: 'owner',
    title: t('reseller.organizations.steps.owner'),
    description: t('reseller.organizations.steps.ownerDesc'),
    icon: 'i-lucide-user-check'
  },
  {
    value: 'members',
    title: t('reseller.organizations.steps.members'),
    description: t('reseller.organizations.steps.membersDesc'),
    icon: 'i-lucide-users'
  }
])

// Form refs for validation
const orgFormRef = useTemplateRef('orgForm')
const creditsFormRef = useTemplateRef('creditsForm')
const ownerFormRef = useTemplateRef('ownerForm')

// Mapping field names to steps for backend error handling
const fieldToStep: Record<string, string> = {
  name: 'organization',
  email: 'organization',
  initialCredits: 'credits',
  subscriptionEnabled: 'credits',
  monthlyCreditsTarget: 'credits',
  renewalType: 'credits',
  renewalDay: 'credits',
  ownerEmail: 'owner',
  ownerFirstName: 'owner',
  ownerLastName: 'owner'
}

// Handle backend validation errors - navigate to step and show inline error
function handleBackendErrors (e: unknown): boolean {
  if (e && typeof e === 'object' && 'data' in e) {
    const data = (
      e as { data?: { errors?: Array<{ field: string; message: string }> } }
    ).data
    const errors = data?.errors

    if (Array.isArray(errors) && errors.length > 0 && errors[0]) {
      const firstError = errors[0]
      const targetStep = fieldToStep[firstError.field]

      if (targetStep) {
        // 1. Navigate to the step containing the errored field
        if (currentStep.value !== targetStep) {
          currentStep.value = targetStep
        }

        // 2. Inject error into the form for inline display
        nextTick(() => {
          let formRef
          if (targetStep === 'organization') {
            formRef = orgFormRef
          } else if (targetStep === 'credits') {
            formRef = creditsFormRef
          } else if (targetStep === 'owner') {
            formRef = ownerFormRef
          }
          formRef?.value?.setErrors([
            {
              name: firstError.field,
              message: firstError.message
            }
          ])
        })

        return true // Error was handled
      }
    }
  }

  return false // No validation error found
}

// Zod schemas for each step
const organizationSchema = computed(() =>
  z.object({
    name: z.string().min(2, t('reseller.organizations.validation.nameMin')),
    email: z
      .string()
      .email(t('reseller.organizations.validation.emailInvalid'))
  })
)

const creditsSchema = computed(() =>
  z
    .object({
      billingType: z.enum(['one_time', 'subscription']),
      initialCredits: z
        .number()
        .min(0, t('reseller.organizations.validation.initialCreditsMin'))
        .max(
          availableCredits.value,
          t('reseller.organizations.validation.initialCreditsMax')
        )
        .optional(),
      monthlyCreditsTarget: z
        .number()
        .min(1, t('reseller.subscription.validation.targetPositive'))
        .optional(),
      renewalType: z.enum(['first_of_month', 'anniversary']).optional(),
      renewalDay: z.number().min(1).max(28).optional()
    })
    .refine(
      (data) => {
        // If subscription, monthlyCreditsTarget is required
        if (data.billingType === 'subscription') {
          return (
            data.monthlyCreditsTarget !== undefined &&
            data.monthlyCreditsTarget > 0
          )
        }
        return true
      },
      {
        message: t('reseller.subscription.validation.targetRequired'),
        path: ['monthlyCreditsTarget']
      }
    )
    .refine(
      (data) => {
        // If subscription, renewalType is required
        if (data.billingType === 'subscription') {
          return data.renewalType !== undefined
        }
        return true
      },
      {
        message: t('reseller.subscription.validation.renewalTypeRequired'),
        path: ['renewalType']
      }
    )
)

const ownerSchema = computed(() =>
  z.object({
    ownerEmail: z
      .string()
      .email(t('reseller.organizations.validation.ownerEmailInvalid')),
    ownerFirstName: z
      .string()
      .min(2, t('reseller.organizations.validation.ownerFirstNameMin')),
    ownerLastName: z
      .string()
      .min(2, t('reseller.organizations.validation.ownerLastNameMin'))
  })
)

const memberSchema = computed(() =>
  z.object({
    email: z.string().email(t('reseller.users.validation.emailInvalid')),
    firstName: z.string().min(2, t('reseller.users.validation.firstNameMin')),
    lastName: z.string().min(2, t('reseller.users.validation.lastNameMin')),
    role: z.number()
  })
)

// Form states for each step
const organizationState = reactive({
  name: '',
  email: '',
  businessSectors: [] as BusinessSector[]
})

const creditsState = reactive({
  billingType: 'one_time' as 'one_time' | 'subscription',
  initialCredits: undefined as number | undefined,
  // Subscription fields
  monthlyCreditsTarget: undefined as number | undefined,
  renewalType: 'first_of_month' as RenewalType,
  renewalDay: 1
})

const ownerState = reactive({
  ownerEmail: '',
  ownerFirstName: '',
  ownerLastName: ''
})

const membersState = reactive({
  members: [] as Array<{
    email: string;
    firstName: string;
    lastName: string;
    role: 2 | 3;
  }>
})

// Helper function to set credits from preset buttons
function setCredits (amount: number) {
  creditsState.initialCredits = Math.min(amount, availableCredits.value)
}

// Computed for credit progress bar
const creditsUsedPercentage = computed(() => {
  if (availableCredits.value === 0) { return 0 }
  const used = creditsState.initialCredits || 0
  return Math.round((used / availableCredits.value) * 100)
})

// Billing type options
const billingTypeOptions = computed(() => [
  {
    value: 'one_time',
    label: t('reseller.organizations.billing.oneTime'),
    description: t('reseller.organizations.billing.oneTimeDesc'),
    icon: 'i-lucide-credit-card'
  },
  {
    value: 'subscription',
    label: t('reseller.organizations.billing.subscription'),
    description: t('reseller.organizations.billing.subscriptionDesc'),
    icon: 'i-lucide-refresh-cw'
  }
])

// Renewal type options
const renewalTypeOptions = computed(() => [
  {
    value: 'first_of_month',
    label: t('reseller.subscription.renewalType.firstOfMonth')
  },
  {
    value: 'anniversary',
    label: t('reseller.subscription.renewalType.anniversary')
  }
])

// Day options for anniversary renewal (1-28)
const renewalDayOptions = computed(() =>
  Array.from({ length: 28 }, (_, i) => ({
    value: i + 1,
    label: String(i + 1)
  }))
)

// Check if current step is valid (for disabling Next button)
const isCurrentStepValid = computed(() => {
  if (currentStep.value === 'organization') {
    // Explicitly access properties to trigger Vue reactivity
    const data = {
      name: organizationState.name,
      email: organizationState.email
    }
    const result = organizationSchema.value.safeParse(data)
    return result.success
  } else if (currentStep.value === 'credits') {
    // Explicitly access properties to trigger Vue reactivity
    const data = {
      billingType: creditsState.billingType,
      initialCredits: creditsState.initialCredits,
      monthlyCreditsTarget: creditsState.monthlyCreditsTarget,
      renewalType: creditsState.renewalType,
      renewalDay: creditsState.renewalDay
    }
    const result = creditsSchema.value.safeParse(data)
    return result.success
  } else if (currentStep.value === 'owner') {
    // Explicitly access properties to trigger Vue reactivity
    const data = {
      ownerEmail: ownerState.ownerEmail,
      ownerFirstName: ownerState.ownerFirstName,
      ownerLastName: ownerState.ownerLastName
    }
    const result = ownerSchema.value.safeParse(data)
    return result.success
  }

  // Members step is optional, but validate added members
  if (currentStep.value === 'members' && membersState.members.length > 0) {
    return membersState.members.every((m) => {
      const data = {
        email: m.email,
        firstName: m.firstName,
        lastName: m.lastName,
        role: m.role
      }
      return memberSchema.value.safeParse(data).success
    })
  }

  return true
})

// Navigation
async function nextStep () {
  // Validate current step form before proceeding
  if (currentStep.value === 'organization') {
    const form = orgFormRef.value
    if (form) {
      try {
        await form.validate({ silent: false })
      } catch {
        // Validation failed, errors will be displayed
        return
      }
    }
  } else if (currentStep.value === 'credits') {
    const form = creditsFormRef.value
    if (form) {
      try {
        await form.validate({ silent: false })
      } catch {
        // Validation failed, errors will be displayed
        return
      }
    }
  } else if (currentStep.value === 'owner') {
    const form = ownerFormRef.value
    if (form) {
      try {
        await form.validate({ silent: false })
      } catch {
        // Validation failed, errors will be displayed
        return
      }
    }
  }

  // Pre-fill owner email from organization email if empty (when moving from credits to owner)
  if (currentStep.value === 'credits' && !ownerState.ownerEmail) {
    ownerState.ownerEmail = organizationState.email
  }

  if (!isCurrentStepValid.value) { return }

  if (stepper.value?.hasNext) {
    stepper.value.next()
  }
}

function prevStep () {
  if (stepper.value?.hasPrev) {
    stepper.value.prev()
  }
}

// Members management
function addMember () {
  membersState.members.push({
    email: '',
    firstName: '',
    lastName: '',
    role: 3
  })
}

function removeMember (index: number) {
  membersState.members.splice(index, 1)
}

// Role options for select
const roleOptions = computed(() => [
  { value: 2, label: t('reseller.organizations.members.roleAdmin') },
  { value: 3, label: t('reseller.organizations.members.roleMember') }
])

// Submission state
const isSubmitting = ref(false)

// Submit form
async function handleSubmit () {
  if (!isCurrentStepValid.value) { return }

  isSubmitting.value = true
  try {
    // 1. Create organization with owner
    const payload: CreateOrganizationPayload = {
      name: organizationState.name,
      email: organizationState.email,
      ownerEmail: ownerState.ownerEmail,
      ownerFirstName: ownerState.ownerFirstName,
      ownerLastName: ownerState.ownerLastName,
      initialCredits: creditsState.initialCredits,
      // Business sectors
      businessSectors: organizationState.businessSectors,
      // Subscription configuration
      subscriptionEnabled: creditsState.billingType === 'subscription',
      ...(creditsState.billingType === 'subscription' && {
        monthlyCreditsTarget: creditsState.monthlyCreditsTarget,
        renewalType: creditsState.renewalType,
        renewalDay:
          creditsState.renewalType === 'anniversary'
            ? creditsState.renewalDay
            : undefined
      })
    }

    const result = await createOrganization(payload)

    if (result) {
      // 2. Add members if any
      if (membersState.members.length > 0) {
        for (const member of membersState.members) {
          try {
            const memberPayload: AddUserPayload = {
              email: member.email,
              firstName: member.firstName,
              lastName: member.lastName,
              role: member.role
            }
            await addUser(result.organization.id, memberPayload)
          } catch {
            // Continue with other members even if one fails
            toast.add({
              title: t('reseller.users.add.error'),
              description: `${member.email}`,
              color: 'warning'
            })
          }
        }
      }

      toast.add({
        title: t('reseller.organizations.create.success'),
        color: 'success'
      })
      navigateTo(
        localePath(`/reseller/organizations/${result.organization.id}`)
      )
    }
  } catch (e) {
    // Try to handle as backend validation error (show inline on field)
    if (!handleBackendErrors(e)) {
      // Fallback: show generic toast
      toast.add({
        title: error.value || t('reseller.organizations.create.error'),
        color: 'error'
      })
    }
  } finally {
    isSubmitting.value = false
  }
}

function handleCancel () {
  navigateTo(localePath('/reseller/organizations'))
}
</script>

<template>
  <div class="space-y-6 p-6">
    <!-- Breadcrumb -->
    <UBreadcrumb :items="breadcrumbItems" />

    <!-- Header -->
    <div>
      <h1 class="text-3xl font-bold text-gray-900 dark:text-white">
        {{ t("reseller.organizations.create.title") }}
      </h1>
      <p class="mt-1 text-gray-500 dark:text-gray-400">
        {{ t("reseller.organizations.create.subtitle") }}
      </p>
    </div>

    <!-- Stepper Card -->
    <UCard class="overflow-visible">
      <UStepper
        ref="stepper"
        v-model="currentStep"
        :items="steps"
        orientation="horizontal"
        :linear="true"
        class="stepper-no-click w-full"
        disabled
      >
        <template #content="{ item }">
          <div class="mt-6 min-h-[300px]">
            <!-- Step 1: Organization Info -->
            <div
              v-if="item.value === 'organization'"
              class="w-full space-y-6 lg:ml-[9%] lg:max-w-2xl 2xl:ml-[11%]"
            >
              <UForm
                ref="orgForm"
                :schema="organizationSchema"
                :state="organizationState"
                :validate-on="['blur', 'change']"
                class="space-y-5"
              >
                <h3 class="text-lg font-medium text-gray-900 dark:text-white">
                  {{ t("reseller.organizations.form.organizationInfo") }}
                </h3>

                <!-- Nom de l'organisation (full width) -->
                <UFormField name="name">
                  <template #label>
                    <span class="flex items-center gap-1.5">
                      <UIcon
                        name="i-lucide-building-2"
                        class="h-4 w-4 text-gray-500"
                      />
                      {{ t("reseller.organizations.fields.name") }}
                      <span class="text-error-500">*</span>
                    </span>
                  </template>
                  <UInput
                    v-model="organizationState.name"
                    class="w-full"
                    :placeholder="t('reseller.organizations.placeholders.name')"
                  />
                  <template #hint>
                    <span class="text-xs text-gray-500">
                      {{ t("reseller.organizations.hints.name") }}
                    </span>
                  </template>
                </UFormField>

                <!-- Email de l'organisation (full width) -->
                <UFormField name="email">
                  <template #label>
                    <span class="flex items-center gap-1.5">
                      <UIcon
                        name="i-lucide-mail"
                        class="h-4 w-4 text-gray-500"
                      />
                      {{ t("reseller.organizations.fields.email") }}
                      <span class="text-error-500">*</span>
                    </span>
                  </template>
                  <UInput
                    v-model="organizationState.email"
                    class="w-full"
                    type="email"
                    :placeholder="
                      t('reseller.organizations.placeholders.email')
                    "
                  />
                  <template #hint>
                    <span class="text-xs text-gray-500">
                      {{ t("reseller.organizations.hints.email") }}
                    </span>
                  </template>
                </UFormField>

                <!-- Business Sectors (optional) -->
                <UFormField name="businessSectors">
                  <template #label>
                    <span class="flex items-center gap-1.5">
                      <UIcon
                        name="i-lucide-briefcase"
                        class="h-4 w-4 text-gray-500"
                      />
                      {{ t("reseller.organizations.fields.businessSectors") }}
                    </span>
                  </template>
                  <UInputMenu
                    v-model="organizationState.businessSectors"
                    :items="sectorOptions"
                    multiple
                    value-key="value"
                    class="w-full"
                    :placeholder="
                      t('reseller.organizations.placeholders.businessSectors')
                    "
                  />

                  <template #hint>
                    <span class="text-xs text-gray-500">
                      {{ t("reseller.organizations.hints.businessSectors") }}
                    </span>
                  </template>
                </UFormField>
              </UForm>
            </div>

            <!-- Step 2: Credits & Billing -->
            <div
              v-else-if="item.value === 'credits'"
              class="w-full space-y-6 lg:ml-[9%] lg:max-w-2xl 2xl:ml-[11%]"
            >
              <UForm
                ref="creditsForm"
                :schema="creditsSchema"
                :state="creditsState"
                :validate-on="['blur', 'change']"
                class="space-y-6"
              >
                <div>
                  <h3 class="text-lg font-medium text-gray-900 dark:text-white">
                    {{ t("reseller.organizations.billing.title") }}
                  </h3>
                  <p class="mt-1 text-sm text-gray-500">
                    {{ t("reseller.organizations.billing.description") }}
                  </p>
                </div>

                <!-- Billing Type Selection -->
                <UFormField name="billingType">
                  <div class="grid grid-cols-1 gap-4 md:grid-cols-2">
                    <button
                      v-for="option in billingTypeOptions"
                      :key="option.value"
                      type="button"
                      class="relative flex cursor-pointer flex-col rounded-lg border-2 p-4 transition-all"
                      :class="[
                        creditsState.billingType === option.value
                          ? 'border-primary-500 bg-primary-50 dark:border-primary-400 dark:bg-primary-900/20'
                          : 'border-gray-200 hover:border-gray-300 dark:border-gray-700 dark:hover:border-gray-600',
                      ]"
                      @click="
                        creditsState.billingType = option.value as
                          | 'one_time'
                          | 'subscription'
                      "
                    >
                      <div class="flex items-center gap-3">
                        <div
                          class="flex h-10 w-10 items-center justify-center rounded-lg"
                        >
                          <UIcon
                            :name="option.icon"
                            class="h-5 w-5"
                            :class="[
                              creditsState.billingType === option.value
                                ? 'text-primary-600 dark:text-primary-400'
                                : 'text-gray-500 dark:text-gray-400',
                            ]"
                          />
                        </div>
                        <div class="text-left">
                          <p
                            class="font-medium"
                            :class="[
                              creditsState.billingType === option.value
                                ? 'text-primary-700 dark:text-primary-300'
                                : 'text-gray-900 dark:text-white',
                            ]"
                          >
                            {{ option.label }}
                          </p>
                          <p class="text-sm text-gray-500">
                            {{ option.description }}
                          </p>
                        </div>
                      </div>
                    </button>
                  </div>
                </UFormField>

                <USeparator />

                <!-- One-time mode: Initial credits only -->
                <div
                  v-if="creditsState.billingType === 'one_time'"
                  class="space-y-4"
                >
                  <UFormField name="initialCredits">
                    <template #label>
                      <span class="flex items-center gap-1.5">
                        <UIcon
                          name="i-lucide-coins"
                          class="h-4 w-4 text-gray-500"
                        />
                        {{ t("reseller.organizations.fields.initialCredits") }}
                      </span>
                    </template>
                    <div class="space-y-3">
                      <UInput
                        v-model.number="creditsState.initialCredits"
                        type="number"
                        class="w-full"
                        :placeholder="
                          t(
                            'reseller.organizations.placeholders.initialCredits',
                          )
                        "
                        :min="0"
                        :max="availableCredits"
                      />

                      <!-- Preset buttons -->
                      <div class="flex flex-wrap gap-2">
                        <UButton
                          size="sm"
                          variant="soft"
                          color="neutral"
                          :disabled="availableCredits < 100"
                          @click="setCredits(100)"
                        >
                          100
                        </UButton>
                        <UButton
                          size="sm"
                          variant="soft"
                          color="neutral"
                          :disabled="availableCredits < 500"
                          @click="setCredits(500)"
                        >
                          500
                        </UButton>
                        <UButton
                          size="sm"
                          variant="soft"
                          color="neutral"
                          :disabled="availableCredits < 1000"
                          @click="setCredits(1000)"
                        >
                          1000
                        </UButton>
                        <UButton
                          size="sm"
                          variant="soft"
                          color="primary"
                          :disabled="availableCredits === 0"
                          @click="setCredits(availableCredits)"
                        >
                          {{ t("reseller.organizations.credits.max") }}
                        </UButton>
                      </div>

                      <!-- Progress bar -->
                      <div class="flex items-center gap-3">
                        <UProgress
                          :model-value="creditsUsedPercentage"
                          class="flex-1"
                          size="sm"
                        />
                        <span class="text-sm whitespace-nowrap text-gray-500">
                          {{
                            t("reseller.organizations.form.availableCredits", {
                              count: availableCredits,
                            })
                          }}
                        </span>
                      </div>
                    </div>
                  </UFormField>
                </div>

                <!-- Subscription mode: Monthly target + renewal config -->
                <div
                  v-else-if="creditsState.billingType === 'subscription'"
                  class="space-y-5"
                >
                  <!-- Monthly Credits Target -->
                  <UFormField name="monthlyCreditsTarget">
                    <template #label>
                      <span class="flex items-center gap-1.5">
                        <UIcon
                          name="i-lucide-target"
                          class="h-4 w-4 text-gray-500"
                        />
                        {{
                          t("reseller.subscription.fields.monthlyCreditsTarget")
                        }}
                        <span class="text-error-500">*</span>
                      </span>
                    </template>
                    <UInput
                      v-model.number="creditsState.monthlyCreditsTarget"
                      type="number"
                      class="w-full"
                      :placeholder="
                        t(
                          'reseller.subscription.placeholders.monthlyCreditsTarget',
                        )
                      "
                      :min="1"
                    />
                    <template #hint>
                      <span class="text-xs text-gray-500">
                        {{
                          t(
                            "reseller.subscription.fields.monthlyCreditsTargetDescription",
                          )
                        }}
                      </span>
                    </template>
                  </UFormField>

                  <!-- Renewal Type -->
                  <UFormField name="renewalType">
                    <template #label>
                      <span class="flex items-center gap-1.5">
                        <UIcon
                          name="i-lucide-calendar"
                          class="h-4 w-4 text-gray-500"
                        />
                        {{ t("reseller.subscription.fields.renewalType") }}
                        <span class="text-error-500">*</span>
                      </span>
                    </template>
                    <USelect
                      v-model="creditsState.renewalType"
                      :items="renewalTypeOptions"
                      value-key="value"
                      class="w-full"
                    />
                    <template #hint>
                      <span class="text-xs text-gray-500">
                        {{
                          t(
                            "reseller.subscription.fields.renewalTypeDescription",
                          )
                        }}
                      </span>
                    </template>
                  </UFormField>

                  <!-- Renewal Day (only for anniversary) -->
                  <UFormField
                    v-if="creditsState.renewalType === 'anniversary'"
                    name="renewalDay"
                  >
                    <template #label>
                      <span class="flex items-center gap-1.5">
                        <UIcon
                          name="i-lucide-calendar-days"
                          class="h-4 w-4 text-gray-500"
                        />
                        {{ t("reseller.subscription.fields.renewalDay") }}
                        <span class="text-error-500">*</span>
                      </span>
                    </template>
                    <USelect
                      v-model="creditsState.renewalDay"
                      :items="renewalDayOptions"
                      value-key="value"
                      class="w-32"
                    />
                    <template #hint>
                      <span class="text-xs text-gray-500">
                        {{
                          t(
                            "reseller.subscription.fields.renewalDayDescription",
                          )
                        }}
                      </span>
                    </template>
                  </UFormField>

                  <USeparator />

                  <!-- Initial Credits (optional for subscription) -->
                  <UFormField name="initialCredits">
                    <template #label>
                      <span class="flex items-center gap-1.5">
                        <UIcon
                          name="i-lucide-coins"
                          class="h-4 w-4 text-gray-500"
                        />
                        {{
                          t(
                            "reseller.organizations.billing.initialCreditsOptional",
                          )
                        }}
                      </span>
                    </template>
                    <div class="space-y-3">
                      <UInput
                        v-model.number="creditsState.initialCredits"
                        type="number"
                        class="w-full"
                        :placeholder="
                          t(
                            'reseller.organizations.placeholders.initialCredits',
                          )
                        "
                        :min="0"
                        :max="availableCredits"
                      />

                      <!-- Preset buttons -->
                      <div class="flex flex-wrap gap-2">
                        <UButton
                          size="sm"
                          variant="soft"
                          color="neutral"
                          :disabled="availableCredits < 100"
                          @click="setCredits(100)"
                        >
                          100
                        </UButton>
                        <UButton
                          size="sm"
                          variant="soft"
                          color="neutral"
                          :disabled="availableCredits < 500"
                          @click="setCredits(500)"
                        >
                          500
                        </UButton>
                        <UButton
                          size="sm"
                          variant="soft"
                          color="neutral"
                          :disabled="availableCredits < 1000"
                          @click="setCredits(1000)"
                        >
                          1000
                        </UButton>
                        <UButton
                          size="sm"
                          variant="soft"
                          color="primary"
                          :disabled="availableCredits === 0"
                          @click="setCredits(availableCredits)"
                        >
                          {{ t("reseller.organizations.credits.max") }}
                        </UButton>
                      </div>

                      <!-- Progress bar -->
                      <div class="flex items-center gap-3">
                        <UProgress
                          :model-value="creditsUsedPercentage"
                          class="flex-1"
                          size="sm"
                        />
                        <span class="text-sm whitespace-nowrap text-gray-500">
                          {{
                            t("reseller.organizations.form.availableCredits", {
                              count: availableCredits,
                            })
                          }}
                        </span>
                      </div>
                    </div>
                    <template #hint>
                      <span class="text-xs text-gray-500">
                        {{
                          t("reseller.organizations.billing.initialCreditsHint")
                        }}
                      </span>
                    </template>
                  </UFormField>
                </div>
              </UForm>
            </div>

            <!-- Step 3: Owner Info -->
            <div
              v-else-if="item.value === 'owner'"
              class="w-full space-y-6 lg:ml-[9%] lg:max-w-2xl 2xl:ml-[11%]"
            >
              <UForm
                ref="ownerForm"
                :schema="ownerSchema"
                :state="ownerState"
                :validate-on="['blur', 'change']"
                class="space-y-5"
              >
                <div>
                  <h3 class="text-lg font-medium text-gray-900 dark:text-white">
                    {{ t("reseller.organizations.form.ownerInfo") }}
                  </h3>
                  <p class="mt-1 text-sm text-gray-500">
                    {{ t("reseller.organizations.form.ownerDescription") }}
                  </p>
                </div>

                <!-- Email du propriétaire (full width) -->
                <UFormField name="ownerEmail">
                  <template #label>
                    <span class="flex items-center gap-1.5">
                      <UIcon
                        name="i-lucide-mail"
                        class="h-4 w-4 text-gray-500"
                      />
                      {{ t("reseller.organizations.fields.ownerEmail") }}
                      <span class="text-error-500">*</span>
                    </span>
                  </template>
                  <UInput
                    v-model="ownerState.ownerEmail"
                    class="w-full"
                    type="email"
                    :placeholder="
                      t('reseller.organizations.placeholders.ownerEmail')
                    "
                  />
                  <template #hint>
                    <span class="text-xs text-gray-500">
                      {{ t("reseller.organizations.hints.ownerEmail") }}
                    </span>
                  </template>
                </UFormField>

                <!-- Prénom et Nom côte à côte -->
                <div class="grid grid-cols-1 gap-6 md:grid-cols-2">
                  <UFormField name="ownerFirstName">
                    <template #label>
                      <span class="flex items-center gap-1.5">
                        <UIcon
                          name="i-lucide-user"
                          class="h-4 w-4 text-gray-500"
                        />
                        {{ t("reseller.organizations.fields.ownerFirstName") }}
                        <span class="text-error-500">*</span>
                      </span>
                    </template>
                    <UInput
                      v-model="ownerState.ownerFirstName"
                      class="w-full"
                      :placeholder="
                        t('reseller.organizations.placeholders.ownerFirstName')
                      "
                    />
                  </UFormField>

                  <UFormField name="ownerLastName">
                    <template #label>
                      <span class="flex items-center gap-1.5">
                        <UIcon
                          name="i-lucide-user"
                          class="h-4 w-4 text-gray-500"
                        />
                        {{ t("reseller.organizations.fields.ownerLastName") }}
                        <span class="text-error-500">*</span>
                      </span>
                    </template>
                    <UInput
                      v-model="ownerState.ownerLastName"
                      class="w-full"
                      :placeholder="
                        t('reseller.organizations.placeholders.ownerLastName')
                      "
                    />
                  </UFormField>
                </div>
              </UForm>
            </div>

            <!-- Step 3: Members (Optional) -->
            <div v-else-if="item.value === 'members'" class="w-full space-y-6">
              <div class="space-y-4">
                <div class="flex items-center justify-between">
                  <div>
                    <h3
                      class="text-lg font-medium text-gray-900 dark:text-white"
                    >
                      {{ t("reseller.organizations.members.title") }}
                    </h3>
                    <p class="text-sm text-gray-500">
                      {{ t("reseller.organizations.members.description") }}
                    </p>
                  </div>
                  <UButton
                    color="primary"
                    variant="soft"
                    icon="i-lucide-plus"
                    @click="addMember"
                  >
                    {{ t("reseller.organizations.members.addMember") }}
                  </UButton>
                </div>

                <!-- Members list -->
                <div
                  v-if="membersState.members.length === 0"
                  class="py-8 text-center"
                >
                  <UIcon
                    name="i-lucide-users"
                    class="mx-auto h-12 w-12 text-gray-300 dark:text-gray-600"
                  />
                  <p class="mt-2 text-sm text-gray-500">
                    {{ t("reseller.organizations.members.noMembers") }}
                  </p>
                  <p class="text-xs text-gray-400">
                    {{ t("reseller.organizations.members.skipInfo") }}
                  </p>
                </div>

                <div v-else class="space-y-4">
                  <div
                    v-for="(member, index) in membersState.members"
                    :key="index"
                    class="space-y-4 rounded-lg border border-gray-200 p-4 dark:border-gray-700"
                  >
                    <div class="flex items-center justify-between">
                      <span
                        class="text-sm font-medium text-gray-700 dark:text-gray-300"
                      >
                        {{
                          t("reseller.organizations.members.memberNumber", {
                            number: index + 1,
                          })
                        }}
                      </span>
                      <UButton
                        color="error"
                        variant="ghost"
                        size="xs"
                        icon="i-lucide-trash-2"
                        @click="removeMember(index)"
                      >
                        {{ t("reseller.organizations.members.removeMember") }}
                      </UButton>
                    </div>

                    <!-- Email sur toute la largeur -->
                    <UFormField>
                      <template #label>
                        <span class="flex items-center gap-1.5">
                          {{ t("reseller.organizations.members.fields.email") }}
                          <span class="text-error-500">*</span>
                        </span>
                      </template>
                      <UInput
                        v-model="member.email"
                        class="w-full"
                        type="email"
                        :placeholder="
                          t('reseller.organizations.members.placeholders.email')
                        "
                      />
                    </UFormField>

                    <!-- Prénom et Nom côte à côte -->
                    <div class="grid grid-cols-1 gap-6 md:grid-cols-2">
                      <UFormField>
                        <template #label>
                          <span class="flex items-center gap-1.5">
                            {{
                              t(
                                "reseller.organizations.members.fields.firstName",
                              )
                            }}
                            <span class="text-error-500">*</span>
                          </span>
                        </template>
                        <UInput
                          v-model="member.firstName"
                          class="w-full"
                          :placeholder="
                            t(
                              'reseller.organizations.members.placeholders.firstName',
                            )
                          "
                        />
                      </UFormField>

                      <UFormField>
                        <template #label>
                          <span class="flex items-center gap-1.5">
                            {{
                              t(
                                "reseller.organizations.members.fields.lastName",
                              )
                            }}
                            <span class="text-error-500">*</span>
                          </span>
                        </template>
                        <UInput
                          v-model="member.lastName"
                          class="w-full"
                          :placeholder="
                            t(
                              'reseller.organizations.members.placeholders.lastName',
                            )
                          "
                        />
                      </UFormField>
                    </div>

                    <!-- Rôle sur toute la largeur -->
                    <UFormField>
                      <template #label>
                        <span class="flex items-center gap-1.5">
                          {{ t("reseller.organizations.members.fields.role") }}
                          <span class="text-error-500">*</span>
                        </span>
                      </template>
                      <USelect
                        v-model="member.role"
                        class="w-full"
                        :items="roleOptions"
                        value-key="value"
                        label-key="label"
                      />
                    </UFormField>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <!-- Navigation buttons -->
          <div
            class="mt-8 flex justify-between border-t border-gray-200 pt-4 dark:border-gray-700"
          >
            <div>
              <UButton
                v-if="item.value !== 'organization'"
                color="neutral"
                variant="ghost"
                icon="i-lucide-arrow-left"
                @click="prevStep"
              >
                {{ t("reseller.organizations.stepper.previous") }}
              </UButton>
              <UButton
                v-else
                color="neutral"
                variant="outline"
                @click="handleCancel"
              >
                {{ t("common.buttons.cancel") }}
              </UButton>
            </div>

            <div>
              <UButton
                v-if="item.value !== 'members'"
                color="primary"
                trailing-icon="i-lucide-arrow-right"
                :disabled="!isCurrentStepValid"
                @click="nextStep"
              >
                {{ t("reseller.organizations.stepper.next") }}
              </UButton>
              <UButton
                v-else
                color="primary"
                icon="i-lucide-check"
                :loading="isSubmitting || loading"
                :disabled="!isCurrentStepValid"
                @click="handleSubmit"
              >
                {{
                  isSubmitting
                    ? t("reseller.organizations.stepper.creating")
                    : t("reseller.organizations.stepper.create")
                }}
              </UButton>
            </div>
          </div>
        </template>
      </UStepper>
    </UCard>
  </div>
</template>
