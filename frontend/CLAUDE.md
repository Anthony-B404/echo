# CLAUDE.md - Frontend

This file provides guidance to Claude Code when working with the Nuxt 4 frontend.

## Technology Stack

- **Framework**: Nuxt 4.2.1 (SPA mode, SSR disabled)
- **UI Library**: Nuxt UI 4.1.0 (primary component library)
- **Styling**: Tailwind CSS v4 (via @tailwindcss/vite plugin)
- **State Management**: Pinia 3.0.4
- **Validation**: Zod 4.1.12
- **i18n**: @nuxtjs/i18n with French as default locale
- **TypeScript**: Strict mode enabled

## Directory Structure (Nuxt 4)

```
frontend/
├── app/                    # New Nuxt 4 directory (replaces root-level dirs)
│   ├── assets/
│   │   └── css/           # Global styles
│   │       └── main.css
│   ├── components/        # Auto-imported Vue components
│   ├── composables/       # Composition API functions
│   │   ├── useApi.ts
│   │   ├── useAuth.ts
│   │   ├── useRoles.ts
│   │   ├── useSettingsPermissions.ts
│   │   ├── useResellerProfile.ts      # Reseller profile data
│   │   ├── useResellerOrganizations.ts # Reseller org management
│   │   └── useResellers.ts            # Admin reseller management
│   ├── layouts/           # Layout components
│   │   ├── default.vue
│   │   ├── auth.vue
│   │   └── app.vue
│   ├── middleware/        # Route middleware
│   │   ├── auth.ts         # Authenticated users only
│   │   ├── admin.ts        # Super Admin only
│   │   ├── reseller.ts     # Reseller Admin only
│   │   └── pending-deletion.ts
│   ├── pages/             # File-based routing
│   │   ├── admin/         # Super Admin pages (NEW)
│   │   │   ├── index.vue           # Admin dashboard
│   │   │   └── resellers/          # Reseller management
│   │   │       ├── index.vue       # List resellers
│   │   │       ├── create.vue      # Create reseller
│   │   │       └── [id]/           # Reseller details
│   │   │           ├── index.vue   # Reseller info
│   │   │           └── credits.vue # Credit management
│   │   ├── reseller/      # Reseller Admin pages (NEW)
│   │   │   ├── index.vue           # Reseller dashboard
│   │   │   ├── profile.vue         # Reseller profile
│   │   │   ├── credits.vue         # Credit balance
│   │   │   ├── setup/[token].vue   # Initial setup page
│   │   │   └── organizations/      # Client org management
│   │   │       ├── index.vue       # List organizations
│   │   │       ├── create.vue      # Create organization
│   │   │       └── [id]/           # Organization details
│   │   │           ├── index.vue   # Org info
│   │   │           ├── users.vue   # User management
│   │   │           └── credits.vue # Credit distribution
│   │   └── dashboard/     # Regular user pages
│   │       └── settings/  # Settings pages with RBAC
│   │           ├── organization.vue # Owner only
│   │           ├── members.vue    # Owner + Admin
│   │           ├── security.vue   # All users
│   │           └── notifications.vue # All users
│   ├── stores/            # Pinia stores
│   └── app.vue            # Root component
├── public/                # Static assets
├── nuxt.config.ts         # Nuxt configuration
└── package.json
```

**Critical**: Everything is in `app/` directory, not at root level (Nuxt 4 structure).

## Development Commands

```bash
pnpm dev              # Development server (http://localhost:3000)
pnpm build            # Production build
pnpm preview          # Preview production build
pnpm typecheck        # TypeScript type checking
```

## Architecture Patterns

### File-Based Routing

Pages in `app/pages/` automatically create routes:
- `app/pages/index.vue` → `/`
- `app/pages/login.vue` → `/login`
- `app/pages/dashboard/index.vue` → `/dashboard`
- `app/pages/dashboard/settings.vue` → `/dashboard/settings`

### Auto-Imports

Components, composables, and utilities are auto-imported from:
- `app/components/` - Vue components
- `app/composables/` - Composition API functions
- `app/utils/` - Utility functions

### Layouts

Three main layouts in `app/layouts/`:
- `default.vue` - Public pages layout
- `auth.vue` - Authentication pages (login, signup)
- `app.vue` - Authenticated app pages (dashboard, settings)

Use with: `definePageMeta({ layout: 'auth' })`

### API Communication

- **Backend URL**: Configured in `.env` as `API_URL=http://localhost:3333`
- **Critical Rule**: ALWAYS use `useApi()` composable for API calls (adds Accept-Language header automatically)
- **Authentication**: Use `authenticatedFetch` from `useAuth()` for protected routes
- **Protected Routes**: All `/api/*` backend endpoints require authentication

**Pattern**:
```typescript
// Public API calls
const api = useApi()
await api('/register/request-magic-link', {
  method: 'POST',
  body: { email: 'user@example.com' }
})

// Authenticated API calls
const { authenticatedFetch } = useAuth()
await authenticatedFetch('/profile', {
  method: 'PUT',
  body: formData
})
```

**⚠️ Do NOT use `$fetch` directly** - it bypasses the Accept-Language header injection which breaks backend i18n.

### Internationalization (i18n)

- **Default Locale**: French (`fr`)
- **Supported Locales**: French, English
- **Usage**: `$t('key')` in templates, `t('key')` in scripts
- **Locale Switching**: Available in user settings/preferences

## Role-Based Access Control (RBAC)

### System-Level Access (Middleware)

Three route middleware control access based on user role type:

| Middleware | Route Pattern | User Type |
|------------|---------------|-----------|
| `admin` | `/admin/*` | Super Admin (`user.isSuperAdmin`) |
| `reseller` | `/reseller/*` | Reseller Admin (`user.resellerId != null`) |
| `auth` | `/dashboard/*` | All authenticated users |

**Login Redirection** (based on `user.roleType`):
```typescript
switch (roleType) {
  case 'super_admin': navigateTo('/admin'); break
  case 'reseller_admin': navigateTo('/reseller'); break
  default: navigateTo('/dashboard')
}
```

### useSettingsPermissions Composable

Controls access to settings pages based on user role in current organization:

```typescript
const {
  currentUserRole,
  isOwner,
  isAdministrator,
  isMember,
  canAccessOrganization,  // Owner only
  canManageMembers,       // Owner + Administrator
} = useSettingsPermissions()
```

### useRoles Composable

Utility functions for role management:

```typescript
const {
  getRoleLabel,          // Get localized role name
  getRoleOptions,        // Get role options for select
  hasAdminPrivileges,    // Check if Owner or Admin
} = useRoles()
```

### Reseller Composables (NEW)

```typescript
// Reseller profile data
const { profile, isLoading, refresh } = useResellerProfile()

// Reseller organization management
const { organizations, createOrganization, distributeCredits } = useResellerOrganizations()

// Admin reseller management (Super Admin only)
const { resellers, createReseller, addCredits } = useResellers()
```

### Page Access Matrix

**Super Admin Pages** (`/admin/*`):
| Page | Route | Access |
|------|-------|--------|
| Dashboard | `/admin` | Super Admin only |
| Resellers List | `/admin/resellers` | Super Admin only |
| Create Reseller | `/admin/resellers/create` | Super Admin only |
| Reseller Details | `/admin/resellers/[id]` | Super Admin only |
| Reseller Credits | `/admin/resellers/[id]/credits` | Super Admin only |

**Reseller Admin Pages** (`/reseller/*`):
| Page | Route | Access |
|------|-------|--------|
| Dashboard | `/reseller` | Reseller Admin only |
| Profile | `/reseller/profile` | Reseller Admin only |
| Credits | `/reseller/credits` | Reseller Admin only |
| Organizations | `/reseller/organizations` | Reseller Admin only |
| Create Org | `/reseller/organizations/create` | Reseller Admin only |
| Org Details | `/reseller/organizations/[id]` | Reseller Admin only |
| Org Users | `/reseller/organizations/[id]/users` | Reseller Admin only |
| Org Credits | `/reseller/organizations/[id]/credits` | Reseller Admin only |

**Organization User Pages** (`/dashboard/*`):
| Page | Route | Access |
|------|-------|--------|
| Organization | `/dashboard/settings/organization` | Owner only |
| Members | `/dashboard/settings/members` | Owner + Administrator |
| Security | `/dashboard/settings/security` | All authenticated |
| Notifications | `/dashboard/settings/notifications` | All authenticated |
| Credits | `/dashboard/credits` | All authenticated |

**Usage in pages**:
```vue
<script setup lang="ts">
// For organization-level access
const { canAccessOrganization, isOwner } = useSettingsPermissions()
if (!canAccessOrganization.value) {
  navigateTo('/dashboard')
}

// For system-level access (handled by middleware)
definePageMeta({
  middleware: ['admin'] // or 'reseller' or 'auth'
})
</script>
```

## Credits System (Updated)

**Important**: Credits are now stored at the **Organization** level, not the User level.

### Credit Flow
```
Super Admin → Reseller Pool → Organization Pool → Usage
```

### Credits Store (`app/stores/credits.ts`)

Manages organization credits state:

```typescript
const creditsStore = useCreditsStore()

// State
creditsStore.credits          // Current organization credit balance
creditsStore.transactions     // Transaction history

// Actions
await creditsStore.fetchBalance()
await creditsStore.fetchTransactions()
```

### Credits Page

Located at `/dashboard/credits`, shows:
- Current **organization** credit balance
- Transaction history (usage, purchases, bonuses, refunds)

### Handling Insufficient Credits

When API returns error with `code: 'INSUFFICIENT_CREDITS'`:

```typescript
// In audio processing
if (error.data?.code === 'INSUFFICIENT_CREDITS') {
  // Show error message with credits needed vs available
  // Contact organization admin or reseller for more credits
}
```

### Reseller Credit Management

**Reseller credits page** (`/reseller/credits`):
- Shows reseller pool balance
- Lists recent transactions (purchases, distributions)

**Credit distribution** (`/reseller/organizations/[id]/credits`):
- Distribute credits from reseller pool to organization
- View organization credit history

### Admin Credit Management

**Reseller credit management** (`/admin/resellers/[id]/credits`):
- Add credits to reseller pool
- View reseller transaction history

## Nuxt UI Components

Primary component library is **Nuxt UI 4.1.0**. Use Nuxt UI components instead of building custom ones:

```vue
<!-- Forms -->
<UInput v-model="value" />
<UTextarea v-model="text" />
<UButton>Click me</UButton>

<!-- Feedback -->
<UAlert />
<UNotification />
<UModal />

<!-- Navigation -->
<UCard />
<UTabs />
<UDropdown />
```

**Documentation**: https://ui.nuxt.com

## Styling with Tailwind CSS v4

- Use Tailwind utility classes for styling
- Global styles in `app/assets/css/main.css`
- Tailwind config extends Nuxt UI's default configuration
- Dark mode support via Nuxt UI's color mode system

## State Management with Pinia

Store pattern (when needed):

```typescript
// app/stores/example.ts
export const useExampleStore = defineStore('example', {
  state: () => ({
    data: []
  }),
  actions: {
    async fetchData() {
      // API call
    }
  }
})
```

### Key Stores

- **`useOrganizationStore`**: Current organization context, user role in org
- **`useCreditsStore`**: Credit balance, transaction history

## Validation with Zod

Use Zod for form validation:

```typescript
import { z } from 'zod'

const schema = z.object({
  email: z.string().email(),
  password: z.string().min(8)
})

type FormData = z.infer<typeof schema>
```

## Code Style & Conventions

### TypeScript

- Strict mode enabled
- Use type imports: `import type { User } from '~/types'`
- Define types/interfaces in `~/types` directory (when needed)

### Formatting

- Prettier with Tailwind plugin
- Run `pnpm format` to auto-format
- ESLint configuration follows Nuxt standards

### Component Structure

```vue
<script setup lang="ts">
// Imports
// Props/emits
// Composables
// Reactive state
// Computed
// Methods
// Lifecycle hooks
</script>

<template>
  <!-- Template -->
</template>

<style scoped>
/* Component-specific styles (rare, prefer Tailwind) */
</style>
```

## Environment Variables

Create `.env` file in `frontend/`:

```bash
API_URL=http://localhost:3333
```

Access in code: `useRuntimeConfig().public.apiUrl`

## Common Patterns

### Protected Pages

```vue
<script setup lang="ts">
definePageMeta({
  layout: 'app',
  middleware: 'auth' // If auth middleware exists
})
</script>
```

### API Calls

```typescript
// Use $fetch or useFetch
const { data, error } = await useFetch('/api/users', {
  baseURL: useRuntimeConfig().public.apiUrl,
  headers: {
    Authorization: `Bearer ${token}`
  }
})
```

### Form Handling

```vue
<script setup lang="ts">
const state = reactive({
  email: '',
  password: ''
})

const loading = ref(false)
const error = ref('')

async function handleSubmit() {
  loading.value = true
  try {
    // API call
  } catch (e) {
    error.value = e.message
  } finally {
    loading.value = false
  }
}
</script>
```

## Common Pitfalls

### Nuxt 4 Migration Issues

- **Old**: Components at root `components/`
- **New**: Components in `app/components/`
- **Old**: Pages at root `pages/`
- **New**: Pages in `app/pages/`

### Auto-Import Conflicts

- If auto-import doesn't work, check `nuxt.config.ts` imports configuration
- Restart dev server after adding new auto-import directories

### SSR/SPA Mode

- Project runs in **SPA mode** (SSR disabled)
- `process.server` checks not needed
- All code runs client-side only

### Nuxt UI Theming

- Don't fight with Nuxt UI's color system
- Use provided color modes and variants
- Extend theme in `nuxt.config.ts` if needed

### Role-Based UI

When building UI that depends on user role:

```vue
<script setup lang="ts">
const { isOwner, canManageMembers } = useSettingsPermissions()
</script>

<template>
  <!-- Show billing link only to owner -->
  <UButton v-if="isOwner" to="/dashboard/settings/billing">
    Billing
  </UButton>

  <!-- Show member management only to owner/admin -->
  <div v-if="canManageMembers">
    <!-- Member management UI -->
  </div>
</template>
```

### Credits UI Patterns

```vue
<!-- Show credits badge in header -->
<NuxtLink :to="localePath('/dashboard/credits')">
  <UIcon name="i-lucide-coins" />
  <span>{{ credits }}</span>
</NuxtLink>
```

## Testing

Currently no testing setup. When adding tests:
- Use Vitest for unit tests
- Use Playwright for E2E tests
- Place tests in `tests/` or `__tests__/` directories

## Build & Deployment

```bash
pnpm build          # Creates .output/ directory
pnpm preview        # Preview production build locally
```

Deployment target: SPA (static or server-side)
