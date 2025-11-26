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
│   ├── layouts/           # Layout components
│   │   ├── default.vue
│   │   ├── auth.vue
│   │   └── app.vue
│   ├── pages/             # File-based routing
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

**Note**: No `useApi.ts` or `authStore.ts` in git (removed during migration).

### Layouts

Three main layouts in `app/layouts/`:
- `default.vue` - Public pages layout
- `auth.vue` - Authentication pages (login, signup)
- `app.vue` - Authenticated app pages (dashboard, settings)

Use with: `definePageMeta({ layout: 'auth' })`

### API Communication

- **Backend URL**: Configured in `.env` as `API_URL=http://localhost:3333`
- **Authentication**: Use `Authorization: Bearer <token>` header for protected routes
- **Protected Routes**: All `/api/*` backend endpoints require authentication

### Internationalization (i18n)

- **Default Locale**: French (`fr`)
- **Supported Locales**: French, English
- **Usage**: `$t('key')` in templates, `t('key')` in scripts
- **Locale Switching**: Available in user settings/preferences

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
