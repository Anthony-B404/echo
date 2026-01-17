# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

DH-Echo is a B2B2B SaaS application that transforms audio recordings (meetings, dictations, calls) into structured written documents using AI. Built with Nuxt 4 frontend and AdonisJS v6 backend with multi-tenant architecture and a reseller distribution model.

### Core Features (MVP)
- **Audio Workshop**: Upload (MP3, WAV) or record via microphone
- **Transformation Engine**: AI-powered transcription + intelligent restructuring via templates
- **Template Manager**: Customizable document templates (Medical reports, Legal summaries, Commercial action lists)
- **Dashboard & Export**: Audio library with PDF/Word export

### Business Context
- **Business Model**: B2B2B (DH-Echo → Resellers → Client Organizations → Users)
- **Target users**: Professionals (Lawyers, Doctors, Salespeople) via reseller partners
- **Value proposition**: "1-hour messy audio → 2-minute structured document"
- **UX principles**: Minimalist, reassuring, "Drag, Drop, Done"
- **Distribution**: No public signup - all users created by Reseller admins

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

- **Framework**: AdonisJS 6.19.1
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

**System Hierarchy (B2B2B Model)**:
```
Super Admin (DH-Echo staff)    → Access: /admin/*
    ↓
Reseller (Business partner)    → Access: /reseller/*
    ↓
Organization (Client company)  → Credits pool, users, audios
    ↓
User (End user)                → Access: /dashboard/*
```

**Credit Flow**: Super Admin → Reseller (pool) → Organization (pool) → Usage

- **Tenant Isolation**: All data is scoped by `currentOrganizationId` (user's active organization)
- **Critical Rule**: ALWAYS filter database queries by `currentOrganizationId` to prevent data leaks
- **Reseller Scope**: Reseller admins can only access organizations belonging to their reseller
- **User-Organization Relationship**: Users can belong to MULTIPLE organizations
- **Organization Context**: Users have a "current organization" that determines which data they see
- **Organization-Level Roles**: Owner (1), Administrator (2), and Member (3) - stored per-organization in `organization_user` pivot table
- **Role Verification**: Use `user.isOwnerOf(orgId)` and `user.hasOrganization(orgId)` methods
- **Organization Switching**: Users can switch between their organizations via `/api/organizations/:id/switch`
- **Public Signup Disabled**: All users are created by Reseller admins, no public registration

### Authentication & Authorization Flow

1. **User Creation**: Users are created by Reseller admins (no public signup)
   - Reseller creates organization → creates users within organization
   - Users receive magic link to complete setup
2. **Login**: Returns API token for Bearer auth (`/login/request-magic-link`)
3. **Role-Based Redirection**: After login, redirect based on `user.roleType`:
   - `super_admin` → `/admin`
   - `reseller_admin` → `/reseller`
   - `organization_user` → `/dashboard`
4. **Protected Routes**:
   - `/api/*` - All authenticated users
   - `/admin/*` - Super Admin only (`superAdmin` middleware)
   - `/reseller/*` - Reseller Admin only (`reseller` middleware)
5. **Middleware**: `auth_middleware.ts` validates tokens, `super_admin_middleware.ts` and `reseller_middleware.ts` check role access
6. **Policies**: Located in `backend/app/policies/` - always check tenant isolation in policies

### Invitation System

- **UUID-based**: Invitations use `identifier` (UUID) for secure public links
- **Expiration**: Invitations expire after set period (`expiresAt`)
- **Flow**: Create → Check validity → Accept
  - **New Users**: Creates user + links to organization with specified role
  - **Existing Users**: Adds organization to user's organizations (user can belong to multiple orgs)
- **Email Notifications**: Automatically sent via Resend when invitation created

### Credits System (Updated)

**Credit Flow**: Super Admin → Reseller pool → Organization pool → Usage

- **Organization-Level Credits**: Credits are now stored at the Organization level, not User level
- **Credit Check**: Verification happens only at audio transcription time in `transcription_job.ts`
- **No Access Control**: Users always have access to the application; credits are deducted on usage
- **Three-Tier Structure**:
  - `reseller.creditBalance` - Reseller's pool (topped up by Super Admin)
  - `organization.credits` - Organization's pool (distributed by Reseller)
  - `credit_transactions` - Audit trail of organization-level usage
- **Organization Methods**: `hasEnoughCredits(amount)`, `deductCredits(amount, description, userId, audioId?)`, `addCredits(amount, type, description, userId)`
- **Reseller Methods**: `hasEnoughCredits(amount)`, `distributeCredits(amount, orgId, description, userId)`, `addCredits(amount, description, userId)`

### Role-Based Access Control (RBAC)

**System-Level Access** (based on `user.roleType`):
| Role | Routes | Middleware |
|------|--------|------------|
| Super Admin | `/admin/*` | `superAdmin` middleware |
| Reseller Admin | `/reseller/*` | `reseller` middleware |
| Organization User | `/dashboard/*` | `auth` middleware |

**Frontend Permissions** (`useSettingsPermissions` composable):
```typescript
canAccessOrganization  // Owner only
canManageMembers       // Owner + Administrator
```

**Backend Policies** (`MemberPolicy`):
- `manageMember()`: Owner can manage anyone; Admin can only manage Members
- `changeRole()`: Owner can change any role (except to Owner); Admin can only change Members
- `deleteMember()`: Same rules as `manageMember()`

**Settings Page Access (Organization Users)**:
| Page | Access |
|------|--------|
| `/dashboard/settings/organization` | Owner only |
| `/dashboard/settings/members` | Owner + Administrator |
| `/dashboard/settings/security` | All authenticated users |
| `/dashboard/settings/notifications` | All authenticated users |
| `/dashboard/credits` | All authenticated users |

**Admin Page Access (Super Admin)**:
| Page | Access |
|------|--------|
| `/admin` | Dashboard with global stats |
| `/admin/resellers` | Manage resellers |
| `/admin/resellers/:id` | Reseller details & credits |

**Reseller Page Access (Reseller Admin)**:
| Page | Access |
|------|--------|
| `/reseller` | Dashboard |
| `/reseller/profile` | Reseller profile |
| `/reseller/credits` | Credit balance & transactions |
| `/reseller/organizations` | Manage client organizations |
| `/reseller/organizations/:id/users` | Manage organization users |
| `/reseller/organizations/:id/credits` | Distribute credits |

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

- **Controllers**: Thin controllers in `app/controllers/`:
  - Core: `UsersController`, `OrganizationsController`, `InvitationsController`, `CreditsController`, `AudioController`
  - Admin: `app/controllers/admin/` - `ResellersController`, `ResellerCreditsController`, `AdminStatsController`
  - Reseller: `app/controllers/reseller/` - `ResellerProfileController`, `ResellerCreditsController`, `ResellerOrganizationsController`, `ResellerUsersController`
- **Validators**: VineJS schemas in `app/validators/` - always validate user input
- **Models**: Lucid models in `app/models/` (User, Organization, Reseller, ResellerTransaction, CreditTransaction, Audio)
- **Policies**: Bouncer policies in `app/policies/` for authorization logic (OrganizationPolicy, InvitationPolicy, MemberPolicy)
- **Middleware**: Custom middleware in `app/middleware/`:
  - `auth` - Token validation
  - `superAdmin` - Super Admin access check
  - `reseller` - Reseller Admin access check
  - `pendingDeletion` - Block writes during GDPR deletion
  - `detect_user_locale` - i18n detection
- **Import Aliases**: Use `#controllers/*`, `#models/*`, `#validators/*`, etc. (defined in package.json)

## Database Schema

### Core Tables

- **resellers** (NEW): Reseller entities with `name`, `email`, `company`, `siret`, `creditBalance`, `isActive`
- **reseller_transactions** (NEW): Reseller credit transactions (`resellerId`, `amount`, `type`, `targetOrganizationId`, `performedByUserId`)
- **users**: Users with `currentOrganizationId`, `isSuperAdmin` (boolean), `resellerId` (FK for reseller admins)
- **organizations**: Organization entities with `name`, `logo`, `email`, `resellerId` (FK), `credits` (moved from users)
- **organization_user**: Pivot table linking users to organizations with `role` per organization (1=Owner, 2=Administrator, 3=Member)
- **invitations**: Pending invitations with `identifier` (UUID), `organizationId`, `role`, `expiresAt`
- **credit_transactions**: Credit usage history (`userId`, `organizationId`, `amount`, `balanceAfter`, `type`, `audioId`)
- **audios**: Audio files with transcription and analysis data
- **access_tokens**: API authentication tokens managed by AdonisJS Auth

### Key Relationships

- Reseller → Organizations (has many)
- Reseller → ResellerTransactions (has many)
- Reseller → Admin Users (has many via `user.resellerId`)
- User ↔ Organization (many-to-many via `organization_user` pivot)
- User → Current Organization (belongs to via `currentOrganizationId`)
- User → Reseller (belongs to via `resellerId` for reseller admins)
- Organization → Reseller (belongs to via `resellerId`)
- Organization → CreditTransactions (has many)
- Invitation → Organization (many-to-one)
- Audio → Organization (belongs to, multi-tenant)
- Access Token → User (tokenable polymorphic)

### User Roles

**System-Level Roles** (determined by `user.roleType` getter):
```typescript
export type UserRoleType = 'super_admin' | 'reseller_admin' | 'organization_user'
// - isSuperAdmin = true → 'super_admin'
// - resellerId != null → 'reseller_admin'
// - otherwise → 'organization_user'
```

**Organization-Level Roles** (per organization in pivot table):
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
# Application
APP_KEY=                    # Generate with: node ace generate:key
PORT=3333
HOST=localhost
NODE_ENV=development

# Database
DB_HOST=localhost
DB_PORT=5432
DB_USER=postgres
DB_PASSWORD=
DB_DATABASE=dh_echo_db

# Email (Resend)
RESEND_API_KEY=            # From resend.com for emails

# CORS
ALLOWED_ORIGINS=http://localhost:3000
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

### Public Signup Disabled

- **IMPORTANT**: Public registration is disabled - all users are created by Reseller admins
- Don't expect `/signup` endpoint to exist
- Users receive magic link to complete account setup after being created by reseller

### Credits at Organization Level (Not User Level)

```typescript
// ❌ Wrong - Old user-level credits
if (!user.hasEnoughCredits(amount)) { ... }

// ✅ Correct - Organization-level credits
const org = await Organization.findOrFail(user.currentOrganizationId)
if (!org.hasEnoughCredits(amount)) { ... }
```

### Reseller Scope Isolation

- **Always** verify organization belongs to reseller before operations in `/reseller/*` routes
- Use `ctx.reseller` (attached by middleware) to check scope

```typescript
// ✅ Correct - Verify organization belongs to reseller
const org = await Organization.query()
  .where('id', params.id)
  .where('resellerId', ctx.reseller!.id)
  .firstOrFail()
```

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

### Credits System

- **Credit Check**: Credits are verified only at audio processing time (`transcription_job.ts`)
- **Organization-Level**: Use `organization.hasEnoughCredits(amount)` before processing, `organization.deductCredits(...)` after
- **Insufficient Credits**: Returns error with `code: 'INSUFFICIENT_CREDITS'` when organization doesn't have enough credits
- **Frontend Handling**: Credits page at `/dashboard/credits` shows organization balance and transaction history
- **Reseller Credit Distribution**: Resellers must have enough credits in their pool before distributing to organizations

## Feature: Audio Analysis with Mistral AI

### Page Structure

La page d'analyse audio (`/dashboard/analyze` ou `/analyze`) doit contenir :

1. **Zone d'Upload Audio**
   - Drag & drop ou bouton de sélection de fichier
   - Formats supportés : MP3, WAV, M4A, OGG, FLAC
   - Affichage du nom du fichier et de sa taille après upload
   - Limite de taille recommandée : 25MB

2. **Zone de Prompt**
   - Textarea pour que l'utilisateur entre ses instructions
   - Exemples de prompts suggérés :
     - "Fais un résumé de cette conversation"
     - "Extrais les points clés et les actions à faire"
     - "Identifie les participants et leurs positions"
     - "Analyse le sentiment général de la conversation"

3. **Bouton de Traitement**
   - Déclenche la transcription puis l'analyse
   - État de chargement avec indicateur de progression

4. **Zone de Résultat**
   - Affichage du résumé/analyse généré
   - Option de copier le résultat
   - Option de télécharger en format texte

### API Mistral Integration

**Configuration Backend** (`.env`):
```bash
MISTRAL_API_KEY=your_mistral_api_key_here
```

**Endpoints à créer**:

```typescript
// POST /api/audio/transcribe
// Body: FormData avec le fichier audio
// Response: { transcription: string, duration: number }

// POST /api/audio/analyze
// Body: { transcription: string, prompt: string }
// Response: { analysis: string }

// POST /api/audio/process (endpoint combiné)
// Body: FormData avec audio + prompt
// Response: { transcription: string, analysis: string }
```

**Modèles Mistral recommandés**:
- **Transcription** : Utiliser `mistral-large-latest` ou le modèle audio si disponible
- **Analyse** : `mistral-large-latest` pour l'analyse texte selon le prompt

### Frontend Components

Créer dans `frontend/app/components/audio/`:

```
AudioUploader.vue      # Composant d'upload drag & drop
PromptInput.vue        # Textarea avec exemples de prompts
AnalysisResult.vue     # Affichage formaté du résultat
AudioAnalyzer.vue      # Composant parent orchestrant le flow
```

### Backend Controller

Créer `AudioController.ts` dans `backend/app/controllers/`:

```typescript
import type { HttpContext } from '@adonisjs/core/http'

export default class AudioController {
  // POST /api/audio/process
  async process({ request, response, i18n }: HttpContext) {
    // 1. Valider le fichier et le prompt
    // 2. Envoyer à Mistral pour transcription
    // 3. Envoyer la transcription + prompt pour analyse
    // 4. Retourner le résultat
  }
}
```

### Database Schema (optionnel)

Si vous voulez sauvegarder l'historique des analyses :

```typescript
// analyses table
{
  id: number
  userId: number
  organizationId: number  // Multi-tenant scope
  audioFilename: string
  audioDuration: number
  prompt: string
  transcription: text
  analysis: text
  createdAt: DateTime
}
```

### Error Handling

Gérer les cas suivants :
- Fichier trop volumineux (> limite)
- Format audio non supporté
- Erreur API Mistral (quota, timeout, etc.)
- Prompt vide ou invalide
- Transcription impossible (audio de mauvaise qualité)

### UI/UX Guidelines

- Utiliser les composants Nuxt UI existants (UButton, UTextarea, UCard, etc.)
- Afficher un skeleton loader pendant le traitement
- Permettre l'annulation du traitement
- Afficher le temps estimé/écoulé
- Design responsive pour mobile
