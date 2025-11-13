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

- **Tenant Isolation**: All data is scoped by `organizationId` foreign key
- **Critical Rule**: ALWAYS filter database queries by `organizationId` to prevent data leaks
- **User-Organization Relationship**: Users belong to exactly one organization
- **Roles**: Owner (1) and Member (2) with Bouncer policies for authorization

### Authentication & Authorization Flow

1. **Signup**: Creates organization + owner user in transaction (`/signup`)
2. **Login**: Returns API token for Bearer auth (`/login`)
3. **Protected Routes**: All `/api/*` routes require `Authorization: Bearer <token>` header
4. **Middleware**: `auth_middleware.ts` validates tokens, `initialize_bouncer_middleware.ts` sets up policies
5. **Policies**: Located in `backend/app/policies/` - always check tenant isolation in policies

### Invitation System

- **UUID-based**: Invitations use `identifier` (UUID) for secure public links
- **Expiration**: Invitations expire after set period (`expiresAt`)
- **Flow**: Create → Check validity → Accept (creates new user + links to organization)
- **Email Notifications**: Automatically sent via Resend when invitation created

### Frontend Architecture (Nuxt 4 Structure)

- **New Directory**: Everything in `frontend/app/` instead of root
- **Layouts**: `app/layouts/` - `default.vue`, `auth.vue`, `app.vue`
- **Pages**: `app/pages/` with file-based routing
- **Components**: `app/components/` for Vue components
- **Assets**: `app/assets/css/main.css` for global styles
- **No Composables/Stores in Git**: Removed `useApi.ts` and `authStore.ts` during migration

### Backend Architecture (AdonisJS)

- **Controllers**: Thin controllers in `app/controllers/` (UsersController, OrganizationsController, InvitationsController)
- **Validators**: VineJS schemas in `app/validators/` - always validate user input
- **Models**: Lucid models in `app/models/` (User, Organization, Invitation)
- **Policies**: Bouncer policies in `app/policies/` for authorization logic (OrganizationPolicy, InvitationPolicy)
- **Import Aliases**: Use `#controllers/*`, `#models/*`, `#validators/*`, etc. (defined in package.json)

## Database Schema

### Core Tables

- **users**: Multi-tenant users with `organizationId`, `role`, `isOwner` flags
- **organizations**: Tenant entities with `name`, `logo`, `email`
- **invitations**: Pending invitations with `identifier` (UUID), `organizationId`, `role`, `expiresAt`
- **access_tokens**: API authentication tokens managed by AdonisJS Auth

### Key Relationships

- User → Organization (many-to-one)
- Invitation → Organization (many-to-one)
- Access Token → User (tokenable polymorphic)

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

- **NEVER** fetch data without filtering by `organizationId`
- Always use Bouncer policies to check tenant access
- Test organization isolation in all new features

### Email Verification

- Users must verify email before full access
- Check `emailVerified` flag before sensitive operations
- Resend verification endpoint: `POST /resend-verification`

### API Token Management

- Tokens are in `access_tokens` table
- Always invalidate tokens on logout
- Check token validity with `GET /check-token`

### Nuxt 4 Specifics

- Auto-imports work from `app/` directory
- Use `defineNuxtConfig` with `compatibilityDate`
- Layouts must be in `app/layouts/`
- Components auto-imported from `app/components/`
