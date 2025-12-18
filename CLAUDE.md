# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**Audio Analysis SaaS** - Une application SaaS permettant aux utilisateurs d'analyser et transcrire des fichiers audio à l'aide de l'IA Mistral.

### Fonctionnalités Principales

1. **Upload Audio** : Les utilisateurs peuvent uploader des fichiers audio (MP3, WAV, M4A, etc.)
2. **Prompt Personnalisé** : L'utilisateur entre un prompt décrivant ce qu'il souhaite obtenir (résumé, extraction de points clés, analyse de sentiment, etc.)
3. **Transcription** : Utilisation de l'API Mistral pour transcrire l'audio en texte
4. **Analyse IA** : L'API Mistral analyse la transcription selon le prompt de l'utilisateur
5. **Résumé** : Génération d'un résumé/analyse conforme aux instructions du prompt

### Workflow Utilisateur

```mermaid
graph LR
    A[Upload Audio] --> B[Saisie Prompt]
    B --> C[Transcription Mistral]
    C --> D[Analyse selon Prompt]
    D --> E[Affichage Résultat]
```

### Stack Technique

Ce projet est basé sur un boilerplate multi-tenant SaaS avec Nuxt 4 frontend et AdonisJS v6 backend. Le projet utilise Nuxt UI pour l'interface et une architecture `app/` directory.

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
- **Billing**: Lemon Squeezy integration for subscriptions
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

### Billing & Trial System (Lemon Squeezy)

- **Trial Period**: New users get a trial period (configurable days)
- **Subscription Provider**: Lemon Squeezy for payment processing
- **Access Control**: `TrialGuardMiddleware` checks user access (trial OR active subscription)
- **Owner-Based Access**: Members inherit access from their organization owner's subscription
- **Subscription States**: `active`, `cancelled`, `expired`, `paused`, `past_due`, `unpaid`, `on_trial`

**User Trial Fields**:
- `trialStartedAt`, `trialEndsAt`, `trialUsed`
- Methods: `isOnTrial()`, `getTrialDaysRemaining()`, `isTrialExpired()`, `hasAccess()`

**Subscription Model**:
- `lemonSqueezySubscriptionId`, `lemonSqueezyCustomerId`, `lemonSqueezyVariantId`
- `status`, `cardBrand`, `cardLastFour`, `currentPeriodEnd`
- Method: `isActive()` - returns true for `active` or `on_trial` status

**Access Check Flow**:
1. User requests protected resource
2. `TrialGuardMiddleware` checks access:
   - If Owner: checks own `hasAccess()` (trial OR subscription)
   - If Member/Admin: checks organization owner's `hasAccess()`
3. Returns 402 with `SUBSCRIPTION_ENDED` code if no access

**Checkout Localization**:
- Automatically maps user locale to billing country (FR → France, EN → US)
- Checkout URLs include `checkout[billing_address][country]` parameter

### Role-Based Access Control (RBAC)

**Frontend Permissions** (`useSettingsPermissions` composable):
```typescript
canAccessOrganization  // Owner only
canAccessBilling       // Owner only
canManageMembers       // Owner + Administrator
```

**Backend Policies** (`MemberPolicy`):
- `manageMember()`: Owner can manage anyone; Admin can only manage Members
- `changeRole()`: Owner can change any role (except to Owner); Admin can only change Members
- `deleteMember()`: Same rules as `manageMember()`

**Settings Page Access**:
| Page | Access |
|------|--------|
| `/dashboard/settings/billing` | Owner only |
| `/dashboard/settings/organization` | Owner only |
| `/dashboard/settings/members` | Owner + Administrator |
| `/dashboard/settings/security` | All authenticated users |
| `/dashboard/settings/notifications` | All authenticated users |

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

- **Controllers**: Thin controllers in `app/controllers/` (UsersController, OrganizationsController, InvitationsController, BillingController, WebhooksController)
- **Validators**: VineJS schemas in `app/validators/` - always validate user input
- **Models**: Lucid models in `app/models/` (User, Organization, OrganizationUser, Invitation, Subscription)
- **Policies**: Bouncer policies in `app/policies/` for authorization logic (OrganizationPolicy, InvitationPolicy, MemberPolicy)
- **Middleware**: Custom middleware in `app/middleware/` (auth, trial_guard, detect_user_locale, initialize_bouncer)
- **Import Aliases**: Use `#controllers/*`, `#models/*`, `#validators/*`, etc. (defined in package.json)

## Database Schema

### Core Tables

- **users**: Users with `currentOrganizationId` (active organization context), trial fields (`trialStartedAt`, `trialEndsAt`, `trialUsed`)
- **organizations**: Organization entities with `name`, `logo`, `email`
- **organization_user**: Pivot table linking users to organizations with `role` per organization (1=Owner, 2=Administrator, 3=Member)
- **invitations**: Pending invitations with `identifier` (UUID), `organizationId`, `role`, `expiresAt`
- **subscriptions**: Lemon Squeezy subscription data (`lemonSqueezySubscriptionId`, `status`, `cardBrand`, `cardLastFour`, `currentPeriodEnd`)
- **access_tokens**: API authentication tokens managed by AdonisJS Auth

### Key Relationships

- User ↔ Organization (many-to-many via `organization_user` pivot)
- User → Current Organization (belongs to via `currentOrganizationId`)
- User → Subscription (has one)
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
DB_DATABASE=boilerplate_db

# Email (Resend)
RESEND_API_KEY=            # From resend.com for emails

# Billing (Lemon Squeezy)
LEMON_SQUEEZY_API_KEY=     # From lemonsqueezy.com
LEMON_SQUEEZY_STORE_ID=    # Your store ID
LEMON_SQUEEZY_VARIANT_ID=  # Product variant ID
LEMON_SQUEEZY_WEBHOOK_SECRET=  # Webhook signing secret

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
- Billing messages in `messages.billing.*` and `messages.trial.*` namespaces

### Billing & Subscription Issues

- **Trial Access**: Check `user.hasAccess()` which returns true if on trial OR has active subscription
- **Member Access**: Members don't have their own subscriptions - they inherit from organization owner
- **Webhook Sync**: Lemon Squeezy webhooks update subscription status automatically via `WebhooksController`
- **402 Response**: When access is denied, API returns 402 with `code: 'SUBSCRIPTION_ENDED'`
- **Frontend Handling**: Use `trial` store and `AccessBlockedModal` component to handle access denial

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
