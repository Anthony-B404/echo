# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This Project is a multi-tenant SaaS boilerplate with Nuxt 4 frontend and AdonisJS v6 backend. The project recently migrated from shadcn-vue to Nuxt UI and from Nuxt 3 to Nuxt 4 with a new directory structure (`app/` instead of traditional Nuxt directories).

## Technology Stack

### Frontend (Nuxt 4)

- **Framework**: Nuxt 4.2.1 (SSR disabled, SPA mode)
- **UI Library**: Nuxt UI 4.1.0 (primary UI components)
- **Styling**: Tailwind CSS v4 (via @tailwindcss/vite plugin)
- **State Management**: Pinia 3.0.4
- **Validation**: Zod 4.1.12
- **i18n**: @nuxtjs/i18n with French as default locale
- **Directory Structure**: New Nuxt 4 `app/` directory instead of root-level components/pages

### Backend (AdonisJS v6)

- **Framework**: AdonisJS 6.14.1
- **ORM**: Lucid ORM with PostgreSQL
- **Auth**: @adonisjs/auth v9 with API tokens
- **Authorization**: @adonisjs/bouncer v3 with policies
- **Validation**: VineJS (@vinejs/vine)
- **Email**: @adonisjs/mail with Resend integration
- **i18n**: @adonisjs/i18n v2.2.3 with French and English support
- **Templating**: Edge.js for email templates, MJML for email layouts

## Development Commands

### Frontend (`/frontend`)

```bash
pnpm dev              # Development server (http://localhost:3000)
pnpm build            # Production build
pnpm preview          # Preview production build
pnpm typecheck        # TypeScript type checking
```

### Backend (`/backend`)

```bash
pnpm dev              # Development server with HMR (http://localhost:3333)
pnpm build            # Production build
pnpm start            # Start production server
pnpm test             # Run Japa tests
pnpm lint             # ESLint
pnpm format           # Prettier
pnpm typecheck        # TypeScript type checking

# AdonisJS Ace commands
node ace migration:run              # Run migrations
node ace migration:rollback         # Rollback last migration
node ace make:controller Name       # Generate controller
node ace make:model Name            # Generate model
node ace make:migration name        # Generate migration
node ace generate:key               # Generate APP_KEY
```

## Architecture Patterns

### Multi-Tenant Architecture

- **Tenant Isolation**: All data is scoped by `currentOrganizationId` (user's active organization)
- **Critical Rule**: ALWAYS filter database queries by `currentOrganizationId` to prevent data leaks
- **User-Organization Relationship**: Users can belong to MULTIPLE organizations
- **Organization Context**: Users have a "current organization" that determines which data they see
- **Roles**: Owner (1), Administrator (2), and Member (3) - stored per-organization in `organization_user` pivot table
- **Role Verification**: Use `user.isOwnerOf(orgId)` and `user.hasOrganization(orgId)` methods
- **Organization Switching**: Users can switch between their organizations via `/api/organizations/:id/switch`

### Authentication & Authorization Flow

1. **Signup**: Creates organization + owner user in transaction (`/signup`)
2. **Login**: Returns API token for Bearer auth (`/login`)
3. **Protected Routes**: All `/api/*` routes require `Authorization: Bearer <token>` header
4. **Middleware**: `auth_middleware.ts` validates tokens, `initialize_bouncer_middleware.ts` sets up policies
5. **Policies**: Located in `backend/app/policies/` - always check tenant isolation in policies

### Invitation System

- **UUID-based**: Invitations use `identifier` (UUID) for secure public links
- **Expiration**: Invitations expire after set period (`expiresAt`)
- **Flow**: Create → Check validity → Accept
  - **New Users**: Creates user + links to organization with specified role
  - **Existing Users**: Adds organization to user's organizations (user can belong to multiple orgs)
- **Email Notifications**: Automatically sent via Resend when invitation created

### Internationalization (i18n)

- **Auto-detection**: Middleware `detect_user_locale_middleware.ts` reads `Accept-Language` header
- **Supported Languages**: French (default) and English
- **Translation Files**: Located in `backend/resources/lang/{locale}/`
  - `messages.json`: Application messages (auth, errors, success messages)
  - `emails.json`: Email content and subjects
  - `validation.json`: VineJS validation error messages
- **Usage in Controllers**: Access via `i18n` from HttpContext: `i18n.t('messages.auth.invalid_credentials')`
- **Usage in Templates**: Pass `i18n` to Edge templates and use: `{{ i18n.t('emails.verification.subject') }}`
- **Validation Integration**: VineJS automatically uses i18n messages via `start/validator.ts`
- **Critical Rule**: ALWAYS use `i18n.t()` for user-facing messages, never hardcode strings

### Frontend Architecture (Nuxt 4 Structure)

- **New Directory**: Everything in `frontend/app/` instead of root
- **Layouts**: `app/layouts/` - `default.vue`, `auth.vue`, `app.vue`
- **Pages**: `app/pages/` with file-based routing
- **Components**: `app/components/` for Vue components
- **Assets**: `app/assets/css/main.css` for global styles
- **Composables**: `app/composables/` for reusable composition functions (useAuth, useApi)

### API Communication Pattern

- **Critical Rule**: ALWAYS use `useApi()` composable for API calls, NEVER use `$fetch` directly
- **Automatic i18n**: `useApi()` automatically adds `Accept-Language` header based on current locale
- **Reactive**: Header updates when user changes language during session
- **Location**: `frontend/app/composables/useApi.ts`

**Usage**:
```typescript
// In components/pages - Public API calls
const api = useApi()
const data = await api('/endpoint', {
  method: 'POST',
  body: {...}
})

// For authenticated requests
const { authenticatedFetch } = useAuth()
const data = await authenticatedFetch('/protected-endpoint')
```

**Why not `$fetch` directly?**
- Missing automatic `Accept-Language` header
- Not reactive to locale changes
- Backend requires locale for i18n responses
- Inconsistent with project patterns

### Backend Architecture (AdonisJS)

- **Controllers**: Thin controllers in `app/controllers/` (UsersController, OrganizationsController, InvitationsController)
- **Validators**: VineJS schemas in `app/validators/` - always validate user input
- **Models**: Lucid models in `app/models/` (User, Organization, OrganizationUser, Invitation)
- **Policies**: Bouncer policies in `app/policies/` for authorization logic (OrganizationPolicy, InvitationPolicy)
- **Import Aliases**: Use `#controllers/*`, `#models/*`, `#validators/*`, etc. (defined in package.json)

## Database Schema

### Core Tables

- **users**: Users with `currentOrganizationId` (active organization context)
- **organizations**: Organization entities with `name`, `logo`, `email`
- **organization_user**: Pivot table linking users to organizations with `role` per organization (1=Owner, 2=Administrator, 3=Member)
- **invitations**: Pending invitations with `identifier` (UUID), `organizationId`, `role`, `expiresAt`
- **access_tokens**: API authentication tokens managed by AdonisJS Auth

### Key Relationships

- User ↔ Organization (many-to-many via `organization_user` pivot)
- User → Current Organization (belongs to via `currentOrganizationId`)
- Invitation → Organization (many-to-one)
- Access Token → User (tokenable polymorphic)

### User Roles (per organization)

```typescript
export enum UserRole {
  Owner = 1,         // Full control of organization
  Administrator = 2, // Can manage users and settings
  Member = 3         // Basic access to organization resources
}
```

## Configuration & Environment

### Backend `.env` Requirements

```bash
APP_KEY=                    # Generate with: node ace generate:key
PORT=3333
DB_HOST=localhost
DB_PORT=5432
DB_USER=postgres
DB_PASSWORD=
DB_DATABASE=boilerplate_db
RESEND_API_KEY=            # From resend.com for emails
```

### Frontend `.env` Requirements

```bash
API_URL=http://localhost:3333
```

## Code Style & Conventions

### TypeScript

- Strict mode enabled in both frontend and backend
- Use type imports: `import type { User } from '#models/user'`
- AdonisJS import aliases for backend paths

### Formatting

- **Backend**: AdonisJS Prettier config (`@adonisjs/prettier-config`)
- **Frontend**: Custom Prettier with Tailwind plugin
- Run `pnpm format` to auto-format

## Common Pitfalls

### Multi-Tenant Issues

- **NEVER** fetch data without filtering by `currentOrganizationId` (user's active organization)
- Always use `user.hasOrganization(orgId)` before accessing organization data
- Always use `user.isOwnerOf(orgId)` for owner-only operations
- Always use Bouncer policies to check tenant access
- Test organization isolation in all new features
- Remember: Users can belong to multiple organizations

### Current Organization Context

- **ALWAYS** ensure user has `currentOrganizationId` set before accessing organization-scoped data
- Handle case where user might not have a current organization selected
- Organization switching updates `currentOrganizationId` - verify membership first

### API Token Management

- Tokens are in `access_tokens` table
- Always invalidate tokens on logout
- Check token validity with `GET /check-token`

### Nuxt 4 Specifics

- Auto-imports work from `app/` directory
- Use `defineNuxtConfig` with `compatibilityDate`
- Layouts must be in `app/layouts/`
- Components auto-imported from `app/components/`

### Internationalization (i18n)

- **NEVER** hardcode user-facing messages in controllers or templates
- Always use `i18n.t('category.key')` for all messages
- When adding new messages, update BOTH `en/` and `fr/` translation files
- Pass `i18n` to Edge templates when rendering emails: `htmlView('emails/template', { i18n })`
- Test with different `Accept-Language` headers to verify translations work
- Translation keys follow pattern: `{file}.{category}.{message}` (e.g., `messages.auth.invalid_credentials`)
