# CLAUDE.md - Backend

This file provides guidance to Claude Code when working with the AdonisJS v6 backend.

## Technology Stack

- **Framework**: AdonisJS 6.19.1
- **ORM**: Lucid ORM with PostgreSQL
- **Authentication**: @adonisjs/auth v9 with API tokens
- **Authorization**: @adonisjs/bouncer v3 with policies
- **Validation**: VineJS (@vinejs/vine)
- **Email**: @adonisjs/mail with Resend integration
- **i18n**: @adonisjs/i18n v2.2.3 (French and English)
- **Templating**: Edge.js for email templates, MJML for email layouts
- **TypeScript**: Strict mode enabled

## Directory Structure

```
backend/
├── app/
│   ├── controllers/       # HTTP controllers (thin layer)
│   ├── models/            # Lucid ORM models
│   ├── validators/        # VineJS validation schemas
│   ├── policies/          # Bouncer authorization policies
│   └── middleware/        # Custom middleware
├── database/
│   └── migrations/        # Database migrations
├── resources/
│   ├── lang/              # i18n translation files
│   │   ├── en/
│   │   │   ├── messages.json
│   │   │   ├── emails.json
│   │   │   └── validation.json
│   │   └── fr/
│   │       ├── messages.json
│   │       ├── emails.json
│   │       └── validation.json
│   └── views/             # Edge templates (emails)
├── start/
│   ├── routes.ts          # Route definitions
│   ├── kernel.ts          # Middleware stack
│   └── validator.ts       # VineJS i18n integration
├── config/                # Configuration files
├── tests/                 # Japa tests
└── package.json
```

## Development Commands

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
node ace make:validator name        # Generate validator
node ace make:policy Name           # Generate policy
node ace generate:key               # Generate APP_KEY
```

## Multi-Tenant Architecture

### System Hierarchy

The system implements a B2B2B model with four tiers:

```
Super Admin (DH-Echo staff)
    │ Access: /admin/*
    │ Can: Create resellers, add credits to resellers
    ▼
Reseller (Business partner)
    │ Access: /reseller/*
    │ Can: Create orgs, distribute credits, manage users
    ▼
Organization (Client company)
    │ Contains: Credits pool, users, audios
    ▼
User (End user)
    │ Access: /dashboard/*
    │ Can: Use the service, consume credits
```

### Credit Flow

```
Super Admin adds credits → Reseller (pool) → Organization (pool) → Usage
```

### Critical Rules

1. **ALWAYS filter queries by `currentOrganizationId`** - Never fetch data without tenant isolation
2. **User-Organization**: Each user can belong to MULTIPLE organizations
3. **Current Organization Context**: All operations use the user's currently active organization (`currentOrganizationId`)
4. **Policies**: Always use Bouncer policies to verify tenant access with `hasOrganization()` and `isOwnerOf()` methods
5. **Transactions**: Use database transactions for multi-model operations
6. **Organization Switching**: Users can switch between their organizations via API endpoint
7. **Reseller Scope**: Reseller admins can only access organizations belonging to their reseller
8. **Public Signup Disabled**: All users are created by Reseller admins, no public registration

### Database Schema

#### Core Tables

**resellers** (NEW)

- `id` - Primary key
- `name` - Reseller contact name
- `email` - Reseller email
- `phone` - Phone number (optional)
- `company` - Company name
- `siret` - French company registration number (optional)
- `address` - Address (optional)
- `creditBalance` - Credit pool available for distribution
- `isActive` - Boolean flag to enable/disable reseller
- `notes` - Admin notes (optional)
- `createdAt`, `updatedAt` - Timestamps

**reseller_transactions** (NEW)

- `id` - Primary key
- `resellerId` - Foreign key to resellers
- `amount` - Credit amount (positive for purchases, negative for distributions)
- `type` - Transaction type: `purchase`, `distribution`, `adjustment`
- `targetOrganizationId` - Foreign key to organizations (for distributions)
- `description` - Optional description
- `performedByUserId` - Who performed the action (Super Admin or Reseller Admin)
- `createdAt` - Transaction timestamp

**users**

- `id` - Primary key
- `email` - Unique email
- `fullName` - User full name (optional)
- `firstName` - User first name (optional)
- `lastName` - User last name (optional)
- `avatar` - Avatar URL (optional)
- `googleId` - Google OAuth ID (optional)
- `currentOrganizationId` - Foreign key to organizations (active organization context)
- `onboardingCompleted` - Boolean flag
- `magicLinkToken` - Token for magic link authentication (optional)
- `magicLinkExpiresAt` - Expiration date for magic link
- `pendingEmail` - Email pending change (optional)
- `emailChangeToken` - Token for email change confirmation (optional)
- `emailChangeExpiresAt` - Expiration date for email change token
- `isSuperAdmin` - Boolean flag for Super Admin access (NEW)
- `resellerId` - Foreign key to resellers for Reseller Admins (NEW, optional)
- `disabled` - Boolean flag if user is disabled

**credit_transactions**

- `id` - Primary key
- `userId` - Foreign key to users (who triggered the usage)
- `organizationId` - Foreign key to organizations (NEW - credits are now at org level)
- `amount` - Credit amount (positive for additions, negative for deductions)
- `balanceAfter` - Balance after transaction
- `type` - Transaction type: `usage`, `purchase`, `bonus`, `refund`
- `description` - Optional description
- `audioId` - Foreign key to audios (for usage transactions)
- `createdAt` - Transaction timestamp

**organizations**

- `id` - Primary key
- `name` - Organization name
- `logo` - Logo URL (optional)
- `email` - Organization email
- `resellerId` - Foreign key to resellers (NEW - which reseller manages this org)
- `credits` - Credit balance for audio processing (NEW - moved from users)

**organization_user** (Pivot Table)

- `id` - Primary key
- `userId` - Foreign key to users
- `organizationId` - Foreign key to organizations
- `role` - 1 (Owner), 2 (Administrator), or 3 (Member)
- Unique constraint on `[userId, organizationId]`

**invitations**

- `id` - Primary key
- `identifier` - UUID (for public invitation links)
- `organizationId` - Foreign key to organizations
- `email` - Invitee email
- `role` - 1 (Owner), 2 (Administrator), or 3 (Member)
- `expiresAt` - Expiration date

**access_tokens**

- Managed by @adonisjs/auth
- Polymorphic relation to User model

### Relationships

```typescript
// Reseller model
@hasMany(() => Organization)
declare organizations: HasMany<typeof Organization>

@hasMany(() => ResellerTransaction)
declare transactions: HasMany<typeof ResellerTransaction>

@hasMany(() => User)  // Reseller admin users
declare adminUsers: HasMany<typeof User>

// Helper methods
hasEnoughCredits(amount: number): boolean
async distributeCredits(amount, organizationId, description, performedByUserId): Promise<ResellerTransaction>
async addCredits(amount, description, performedByUserId): Promise<ResellerTransaction>
async adjustCredits(amount, description, performedByUserId): Promise<ResellerTransaction>

// User model
@manyToMany(() => Organization, {
  pivotTable: 'organization_user',
  pivotColumns: ['role']
})
declare organizations: ManyToMany<typeof Organization>

@belongsTo(() => Organization, {
  foreignKey: 'currentOrganizationId'
})
declare currentOrganization: BelongsTo<typeof Organization>

@belongsTo(() => Reseller)  // For reseller admin users
declare reseller: BelongsTo<typeof Reseller>

// Helper methods
async isOwnerOf(organizationId: number): Promise<boolean>
async hasOrganization(organizationId: number): Promise<boolean>
get roleType(): 'super_admin' | 'reseller_admin' | 'organization_user'
isResellerAdmin(): boolean

// Organization model
@manyToMany(() => User, {
  pivotTable: 'organization_user',
  pivotColumns: ['role']
})
declare users: ManyToMany<typeof User>

@hasMany(() => Invitation)
declare invitations: HasMany<typeof Invitation>

@belongsTo(() => Reseller)  // Which reseller manages this org
declare reseller: BelongsTo<typeof Reseller>

// Helper methods
async getOwner(): Promise<User | null>
hasEnoughCredits(amount: number): boolean
async deductCredits(amount, description, userId, audioId?): Promise<CreditTransaction>
async addCredits(amount, type, description, userId): Promise<CreditTransaction>
```

### User Roles

#### System-Level Roles (User Type)

Determined by `user.roleType` getter:

```typescript
export type UserRoleType = 'super_admin' | 'reseller_admin' | 'organization_user'

// Determined by:
// - isSuperAdmin = true → 'super_admin'
// - resellerId != null → 'reseller_admin'
// - otherwise → 'organization_user'
```

- **Super Admin** (`isSuperAdmin = true`): DH-Echo staff with access to `/admin/*` routes
  - Can manage all resellers
  - Can add/remove credits to reseller pools
  - Can view global statistics
- **Reseller Admin** (`resellerId != null`): Reseller employee with access to `/reseller/*` routes
  - Can create/manage organizations for their reseller
  - Can distribute credits from reseller pool to organizations
  - Can create/manage users within their organizations
- **Organization User** (default): Regular user with access to `/dashboard/*` routes
  - Can use the audio processing service
  - Access based on organization membership

#### Organization-Level Roles (Within an Organization)

```typescript
export enum UserRole {
  Owner = 1,
  Administrator = 2,
  Member = 3,
}
```

- **Owner**: Full control of organization (create, update, delete, settings)
- **Administrator**: Can manage users (members only) and some settings
- **Member**: Basic access to organization resources

### Role-Based Permissions (MemberPolicy)

```typescript
// MemberPolicy - Granular member management permissions
manageMember(user, targetUser, organizationId)
// Owner: can manage anyone (except themselves)
// Admin: can only manage Members (not Owner, other Admins, or themselves)
// Member: cannot manage anyone

changeRole(user, targetUser, organizationId, newRole)
// Owner: can change any role (except to Owner)
// Admin: can only change Member's role
// Member: cannot change roles
// Nobody can change their own role or assign Owner role

deleteMember(user, targetUser, organizationId)
// Same rules as manageMember
```

### Organization Management

#### Switching Organizations

Users can switch their active organization context:

```typescript
// POST /api/organizations/:id/switch
const user = auth.user!
if (!(await user.hasOrganization(organizationId))) {
  return response.forbidden({ message: 'Access denied' })
}
user.currentOrganizationId = organizationId
await user.save()
```

#### Listing User Organizations

```typescript
// GET /api/organizations
await auth.user!.load('organizations')
return response.ok(auth.user!.organizations)
```

#### Creating Organizations

```typescript
// POST /api/organizations
const organization = await Organization.create({ name, email })
await organization.related('users').attach({
  [userId]: { role: UserRole.Owner },
})
user.currentOrganizationId = organization.id
await user.save()
```

## Credits System

### Overview (Updated)

- **Organization-Level Credits**: Credits are now stored at the Organization level, not User level
- **Credit Flow**: Super Admin → Reseller pool → Organization pool → Usage
- **No Access Control**: Users always have access; credits are verified only at processing time
- **Credit Check**: Happens in `transcription_job.ts` before processing audio

### Three-Tier Credit Structure

```
1. Reseller Pool (reseller.creditBalance)
   - Topped up by Super Admin
   - Distributed to organizations by Reseller Admin

2. Organization Pool (organization.credits)
   - Receives credits from Reseller
   - Consumed by audio processing

3. Credit Transactions (credit_transactions table)
   - Tracks all organization-level credit movements
   - Includes userId, organizationId, audioId for audit trail
```

### Organization Credit Methods

```typescript
// Check if organization has enough credits for audio duration
organization.hasEnoughCredits(amount: number): boolean

// Deduct credits after processing (called by transcription job)
await organization.deductCredits(amount, description, userId, audioId?): Promise<CreditTransaction>

// Add credits (from reseller distribution)
await organization.addCredits(amount, type, description, userId): Promise<CreditTransaction>
```

### Reseller Credit Methods

```typescript
// Check if reseller has enough credits for distribution
reseller.hasEnoughCredits(amount: number): boolean

// Distribute credits to an organization
await reseller.distributeCredits(amount, organizationId, description, performedByUserId): Promise<ResellerTransaction>

// Add credits to pool (Super Admin action)
await reseller.addCredits(amount, description, performedByUserId): Promise<ResellerTransaction>

// Adjust credits (corrections, refunds)
await reseller.adjustCredits(amount, description, performedByUserId): Promise<ResellerTransaction>
```

### CreditTransaction Types

```typescript
// Organization-level transactions
export enum CreditTransactionType {
  Usage = 'usage',        // Audio processing consumption
  Purchase = 'purchase',  // From reseller distribution
  Bonus = 'bonus',        // Promotional credits
  Refund = 'refund',      // Refunds for failed processing
}

// Reseller-level transactions
export enum ResellerTransactionType {
  Purchase = 'purchase',       // Super Admin adds credits
  Distribution = 'distribution', // Credits sent to organization
  Adjustment = 'adjustment',   // Manual corrections
}
```

### CreditsController Endpoints

```typescript
// Get organization credit balance
GET /api/credits

// Get organization transaction history
GET /api/credits/history
```

### Credit Check in Transcription Job

```typescript
// Before processing audio - now checks organization credits
const organization = await Organization.findOrFail(user.currentOrganizationId)
if (!organization.hasEnoughCredits(audioDurationMinutes)) {
  throw new Error('INSUFFICIENT_CREDITS')
}

// After successful processing - deducts from organization
await organization.deductCredits(audioDurationMinutes, `Audio: ${audioTitle}`, user.id, audio.id)
```

## Authentication & Authorization

### Authentication Flow

1. **Signup** (`POST /signup`)
   - Creates organization + owner user in transaction
   - Sends email verification
   - Returns API token

2. **Login** (`POST /login`)
   - Validates credentials
   - Returns API token
   - Token format: `Bearer <token>`

3. **Protected Routes** (`/api/*`)
   - Require `Authorization: Bearer <token>` header
   - Middleware: `auth_middleware.ts` validates tokens
   - Access user: `auth.user` in controllers

### Authorization with Bouncer

Policies in `app/policies/`:

```typescript
// Example: OrganizationPolicy
export default class OrganizationPolicy {
  async update(user: User, organization: Organization) {
    // Verify user belongs to organization AND is owner
    return (await user.hasOrganization(organization.id)) && (await user.isOwnerOf(organization.id))
  }

  async view(user: User, organization: Organization) {
    // Verify user has access to organization
    return user.hasOrganization(organization.id)
  }
}
```

**Usage in controllers**:

```typescript
import { inject } from '@adonisjs/core'

@inject()
export default class OrganizationsController {
  async update({ auth, bouncer, params }: HttpContext) {
    const organization = await Organization.findOrFail(params.id)
    await bouncer.with('OrganizationPolicy').authorize('update', organization)

    // Update logic
  }

  async show({ auth, bouncer, params }: HttpContext) {
    const organization = await Organization.findOrFail(params.id)
    await bouncer.with('OrganizationPolicy').authorize('view', organization)

    return response.ok(organization)
  }
}
```

**Critical**: Always check organization membership before operations:

```typescript
// ✅ Correct - Check membership
if (!(await auth.user!.hasOrganization(organizationId))) {
  return response.forbidden({ message: 'Access denied' })
}

// ✅ Correct - Check owner role
if (!(await auth.user!.isOwnerOf(organizationId))) {
  return response.forbidden({ message: 'Owner access required' })
}
```

## Admin & Reseller APIs

### Super Admin Routes (`/admin/*`)

Protected by `superAdmin` middleware (requires `user.isSuperAdmin = true`):

```typescript
// Global statistics
GET /admin/stats

// Reseller CRUD
GET    /admin/resellers           // List all resellers
POST   /admin/resellers           // Create reseller
GET    /admin/resellers/:id       // Get reseller details
PUT    /admin/resellers/:id       // Update reseller
DELETE /admin/resellers/:id       // Delete reseller

// Reseller credit management
POST /admin/resellers/:id/credits        // Add credits to reseller pool
POST /admin/resellers/:id/credits/remove // Remove credits from pool
GET  /admin/resellers/:id/transactions   // Get reseller transaction history
```

### Reseller API Routes (`/reseller/*`)

Protected by `reseller` middleware (requires `user.resellerId != null` and reseller must be active):

```typescript
// Profile
GET /reseller/profile             // Get reseller profile & stats

// Credits
GET /reseller/credits             // Get credit balance & recent transactions

// Organizations
GET    /reseller/organizations           // List organizations for this reseller
POST   /reseller/organizations           // Create new organization
GET    /reseller/organizations/:id       // Get organization details
PUT    /reseller/organizations/:id       // Update organization

// Credit distribution
POST /reseller/organizations/:id/credits // Distribute credits to organization

// User management (within reseller's organizations)
GET    /reseller/organizations/:id/users       // List users in organization
POST   /reseller/organizations/:id/users       // Create user in organization
DELETE /reseller/organizations/:id/users/:uid  // Remove user from organization
```

### Middleware Configuration

```typescript
// In start/kernel.ts
export const middleware = router.named({
  auth: () => import('#middleware/auth_middleware'),
  superAdmin: () => import('#middleware/super_admin_middleware'),
  reseller: () => import('#middleware/reseller_middleware'),
  pendingDeletion: () => import('#middleware/pending_deletion_middleware'),
})
```

### Reseller Middleware Details

The `reseller` middleware:
1. Verifies user is authenticated
2. Checks `user.resellerId` is set
3. Loads and verifies reseller is active (`isActive = true`)
4. Attaches `ctx.reseller` for easy access in controllers

```typescript
// Access reseller in controllers
const { reseller } = ctx
await reseller.distributeCredits(amount, orgId, description, ctx.auth.user!.id)
```

### Login Flow and Redirection

After login, redirect users based on their role type:

```typescript
// Frontend login handler
const { roleType } = user

switch (roleType) {
  case 'super_admin':
    navigateTo('/admin')
    break
  case 'reseller_admin':
    navigateTo('/reseller')
    break
  default:
    navigateTo('/dashboard')
}
```

## Internationalization (i18n)

### Configuration

- **Default Locale**: French (`fr`)
- **Supported Locales**: French (`fr`), English (`en`)
- **Auto-Detection**: `detect_user_locale_middleware.ts` reads `Accept-Language` header
- **Translation Files**: `resources/lang/{locale}/`

### Translation Files

**messages.json** - Application messages

```json
{
  "auth": {
    "invalid_credentials": "Invalid credentials",
    "welcome": "Welcome back!"
  },
  "errors": {
    "not_found": "Resource not found"
  }
}
```

**emails.json** - Email content

```json
{
  "verification": {
    "subject": "Verify your email",
    "greeting": "Hello"
  }
}
```

**validation.json** - VineJS validation messages

```json
{
  "required": "The {{ field }} field is required",
  "email": "Invalid email format"
}
```

### Usage in Controllers

**Critical**: ALWAYS use `i18n.t()` for user-facing messages

```typescript
export default class AuthController {
  async login({ request, response, i18n }: HttpContext) {
    try {
      // Login logic
      return response.ok({
        message: i18n.t('messages.auth.welcome'),
      })
    } catch (error) {
      return response.unauthorized({
        message: i18n.t('messages.auth.invalid_credentials'),
      })
    }
  }
}
```

### Usage in Edge Templates

**Always pass `i18n` to templates**:

```typescript
import mail from '@adonisjs/mail/services/main'

await mail.send((message) => {
  message
    .to(user.email)
    .subject(i18n.t('emails.verification.subject'))
    .htmlView('emails/verify_email', {
      user,
      token,
      i18n, // ← Pass i18n
    })
})
```

**In template** (`resources/views/emails/verify_email.edge`):

```html
<h1>{{ i18n.t('emails.verification.greeting') }}</h1>
```

### Validation Integration

VineJS automatically uses i18n messages via `start/validator.ts`:

```typescript
vine.messagesProvider = new VineI18nProvider(i18nManager)
```

### Translation Key Pattern

Format: `{file}.{category}.{message}`

Examples:

- `messages.auth.invalid_credentials`
- `emails.verification.subject`
- `validation.required`

### Critical Rules

1. **NEVER hardcode user-facing messages** in controllers or templates
2. **ALWAYS use `i18n.t('category.key')`** for all messages
3. **Update BOTH `en/` and `fr/`** translation files when adding new messages
4. **Pass `i18n` to Edge templates** when rendering emails
5. **Test with different `Accept-Language` headers** to verify translations

## Validation with VineJS

### Creating Validators

```bash
node ace make:validator CreateUser
```

**Example** (`app/validators/user.ts`):

```typescript
import vine from '@vinejs/vine'

export const createUserValidator = vine.compile(
  vine.object({
    email: vine.string().email(),
    password: vine.string().minLength(8),
    name: vine.string().minLength(2),
  })
)
```

### Usage in Controllers

```typescript
import { createUserValidator } from '#validators/user'

export default class UsersController {
  async store({ request }: HttpContext) {
    const data = await request.validateUsing(createUserValidator)
    // Use validated data
  }
}
```

### Validation Messages

- Auto-translated via `start/validator.ts`
- Messages in `resources/lang/{locale}/validation.json`
- Custom messages per field possible

## Email System

### Configuration

- **Provider**: Resend
- **API Key**: `RESEND_API_KEY` in `.env`
- **Templates**: Edge templates in `resources/views/emails/`
- **Layouts**: MJML for responsive email layouts

### Sending Emails

```typescript
import mail from '@adonisjs/mail/services/main'

await mail.send((message) => {
  message
    .from('noreply@example.com')
    .to(user.email)
    .subject(i18n.t('emails.verification.subject'))
    .htmlView('emails/verify_email', {
      user,
      token,
      i18n, // Always pass i18n
    })
})
```

### Email Templates

**Edge template** (`resources/views/emails/verify_email.edge`):

```html
<mjml>
  <mj-body>
    <mj-section>
      <mj-column>
        <mj-text> {{ i18n.t('emails.verification.greeting') }} </mj-text>
      </mj-column>
    </mj-section>
  </mj-body>
</mjml>
```

## Database Migrations

### Creating Migrations

```bash
node ace make:migration create_users_table
```

### Migration Pattern

```typescript
import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'users'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.increments('id')
      table.integer('organization_id').unsigned().references('organizations.id').onDelete('CASCADE')
      table.string('email').unique().notNullable()
      table.string('password').notNullable()
      table.timestamps(true, true)
    })
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}
```

### Running Migrations

```bash
node ace migration:run              # Run pending migrations
node ace migration:rollback         # Rollback last batch
node ace migration:rollback --batch=0  # Rollback all
node ace migration:refresh          # Rollback all + run all
```

## Models (Lucid ORM)

### Model Pattern

```typescript
import { DateTime } from 'luxon'
import { BaseModel, column, manyToMany, belongsTo } from '@adonisjs/lucid/orm'
import type { ManyToMany, BelongsTo } from '@adonisjs/lucid/types/relations'
import Organization from '#models/organization'

export enum UserRole {
  Owner = 1,
  Administrator = 2,
  Member = 3,
}

export default class User extends BaseModel {
  @column({ isPrimary: true })
  declare id: number

  @column()
  declare email: string

  @column()
  declare currentOrganizationId: number | null

  @column.dateTime({ autoCreate: true })
  declare createdAt: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  declare updatedAt: DateTime

  @manyToMany(() => Organization, {
    pivotTable: 'organization_user',
    pivotColumns: ['role'],
  })
  declare organizations: ManyToMany<typeof Organization>

  @belongsTo(() => Organization, {
    foreignKey: 'currentOrganizationId',
  })
  declare currentOrganization: BelongsTo<typeof Organization>

  // Helper methods for multi-org
  async isOwnerOf(organizationId: number): Promise<boolean> {
    await this.load('organizations')
    const org = this.organizations.find((o) => o.id === organizationId)
    return org?.$extras.pivot_role === UserRole.Owner
  }

  async hasOrganization(organizationId: number): Promise<boolean> {
    await this.load('organizations')
    return this.organizations.some((o) => o.id === organizationId)
  }
}
```

### Querying with Tenant Isolation

**Critical**: Always filter by `currentOrganizationId` (user's active organization)

```typescript
// ✅ Correct - Filtered by current organization
const users = await User.query().whereHas('organizations', (query) => {
  query.where('organizations.id', auth.user!.currentOrganizationId)
})

// For data scoped to organizations (like documents, projects, etc.)
const documents = await Document.query().where('organization_id', auth.user!.currentOrganizationId)

// ❌ Wrong - No tenant isolation
const users = await User.all()
```

**Accessing user's role in current organization:**

```typescript
await auth.user!.load('organizations')
const currentOrg = auth.user!.organizations.find(
  (org) => org.id === auth.user!.currentOrganizationId
)
const userRole = currentOrg?.$extras.pivot_role // 1=Owner, 2=Administrator, 3=Member
```

## Controllers

### Controller Pattern

**Thin controllers** - Business logic in models/services

```typescript
import type { HttpContext } from '@adonisjs/core/http'
import User from '#models/user'

export default class UsersController {
  async index({ auth, response }: HttpContext) {
    // Get users in current organization
    const users = await User.query()
      .whereHas('organizations', (query) => {
        query.where('organizations.id', auth.user!.currentOrganizationId)
      })
      .preload('organizations')

    return response.ok(users)
  }

  async show({ auth, params, response }: HttpContext) {
    const user = await User.findOrFail(params.id)
    await user.load('organizations')

    // Check tenant access - verify user is in same organization
    const hasAccess = user.organizations.some((org) => org.id === auth.user!.currentOrganizationId)

    if (!hasAccess) {
      return response.forbidden({
        message: 'Access denied',
      })
    }

    return response.ok(user)
  }
}
```

## Import Aliases

Configured in `package.json`:

```json
{
  "imports": {
    "#controllers/*": "./app/controllers/*.js",
    "#models/*": "./app/models/*.js",
    "#validators/*": "./app/validators/*.js",
    "#policies/*": "./app/policies/*.js"
  }
}
```

**Usage**:

```typescript
import User from '#models/user'
import { createUserValidator } from '#validators/user'
import OrganizationPolicy from '#policies/organization_policy'
```

## Environment Variables

Create `.env` file in `backend/`:

```bash
# Application
APP_KEY=                    # Generate with: node ace generate:key
PORT=3333
NODE_ENV=development

# Database
DB_HOST=localhost
DB_PORT=5432
DB_USER=postgres
DB_PASSWORD=
DB_DATABASE=dh_echo_db

# Email
RESEND_API_KEY=            # From resend.com

# CORS
ALLOWED_ORIGINS=http://localhost:3000

# Optional
LOG_LEVEL=info
```

## Code Style & Conventions

### TypeScript

- Strict mode enabled
- Use type imports: `import type { HttpContext } from '@adonisjs/core/http'`
- Use AdonisJS import aliases

### Formatting

- Prettier with AdonisJS config (`@adonisjs/prettier-config`)
- Run `pnpm format` to auto-format
- ESLint with AdonisJS rules

## Testing with Japa

```bash
pnpm test              # Run all tests
pnpm test:watch        # Watch mode
```

### Test Pattern

```typescript
import { test } from '@japa/runner'
import User from '#models/user'

test.group('Users', () => {
  test('can create user', async ({ assert }) => {
    const user = await User.create({
      email: 'test@example.com',
      password: 'password',
      organizationId: 1,
    })

    assert.exists(user.id)
  })
})
```

## Common Patterns

### Transaction Pattern

```typescript
import db from '@adonisjs/lucid/services/db'

const trx = await db.transaction()

try {
  // Create organization
  const organization = await Organization.create({ name: 'Acme' }, { client: trx })

  // Create or update user
  const user = await User.create(
    {
      email: 'owner@acme.com',
      currentOrganizationId: organization.id,
    },
    { client: trx }
  )

  // Link user to organization with Owner role
  await organization.related('users').attach(
    {
      [user.id]: { role: UserRole.Owner },
    },
    trx
  )

  await trx.commit()
} catch (error) {
  await trx.rollback()
  throw error
}
```

### Pagination Pattern

```typescript
const users = await User.query()
  .whereHas('organizations', (query) => {
    query.where('organizations.id', auth.user!.currentOrganizationId)
  })
  .paginate(page, perPage)

return response.ok(users.toJSON())
```

## Common Pitfalls

### Public Signup Disabled

**Important**: Public registration is disabled. All users must be created by a Reseller Admin.

```typescript
// ❌ Wrong - Expecting /signup endpoint
// Public signup doesn't exist

// ✅ Correct - Users created via Reseller API
POST /reseller/organizations/:id/users
```

### Credits at Organization Level (Not User Level)

**Important**: Credits moved from User to Organization level.

```typescript
// ❌ Wrong - Old user-level credits
if (!user.hasEnoughCredits(amount)) { ... }
await user.deductCredits(amount)

// ✅ Correct - Organization-level credits
const org = await Organization.findOrFail(user.currentOrganizationId)
if (!org.hasEnoughCredits(amount)) { ... }
await org.deductCredits(amount, description, user.id, audio.id)
```

### Reseller Scope Isolation

**Always** verify organization belongs to reseller before operations:

```typescript
// ❌ Wrong - No reseller scope check
const org = await Organization.findOrFail(params.id)

// ✅ Correct - Verify organization belongs to reseller
const org = await Organization.query()
  .where('id', params.id)
  .where('resellerId', ctx.reseller!.id)
  .firstOrFail()
```

### Tenant Isolation

**Never** forget `currentOrganizationId` filtering:

```typescript
// ❌ Wrong - Data leak across organizations
const users = await User.all()

// ✅ Correct - Tenant isolated by current organization
const users = await User.query().whereHas('organizations', (query) => {
  query.where('organizations.id', auth.user!.currentOrganizationId)
})
```

### Multi-Organization Access

**Always** verify organization membership before operations:

```typescript
// ❌ Wrong - No membership check
const organization = await Organization.findOrFail(params.id)
// ... perform operations

// ✅ Correct - Verify membership first
const organization = await Organization.findOrFail(params.id)
if (!(await auth.user!.hasOrganization(organization.id))) {
  return response.forbidden({ message: 'Access denied' })
}
// ... perform operations
```

### Current Organization Context

**Always** ensure user has a current organization set:

```typescript
// ❌ Wrong - Assuming currentOrganizationId is set
const data = await Data.query().where('organization_id', auth.user!.currentOrganizationId)

// ✅ Correct - Verify current organization exists
if (!auth.user!.currentOrganizationId) {
  return response.badRequest({
    message: i18n.t('messages.organization.no_current_organization'),
  })
}
const data = await Data.query().where('organization_id', auth.user!.currentOrganizationId)
```

### i18n Messages

**Never** hardcode user-facing strings:

```typescript
// ❌ Wrong - Hardcoded
return response.unauthorized({ message: 'Invalid credentials' })

// ✅ Correct - i18n
return response.unauthorized({
  message: i18n.t('messages.auth.invalid_credentials'),
})
```

### Email Templates

**Always** pass `i18n` to templates:

```typescript
// ❌ Wrong - No i18n
.htmlView('emails/verify', { user, token })

// ✅ Correct - With i18n
.htmlView('emails/verify', { user, token, i18n })
```

### Validation

**Always** validate user input:

```typescript
// ❌ Wrong - No validation
const data = request.all()

// ✅ Correct - Validated
const data = await request.validateUsing(createUserValidator)
```

### Authorization

**Always** check tenant access with policies:

```typescript
// ❌ Wrong - No authorization check
const organization = await Organization.findOrFail(params.id)
// ... perform operations

// ✅ Correct - With policy check
const organization = await Organization.findOrFail(params.id)
await bouncer.with('OrganizationPolicy').authorize('view', organization)
// ... perform operations
```

### Role Checking

**Always** use helper methods for role verification:

```typescript
// ❌ Wrong - Direct role comparison without loading
if (user.role === UserRole.Owner) { ... }

// ✅ Correct - Use helper method with organization ID
if (await user.isOwnerOf(organizationId)) { ... }

// ✅ Correct - Check membership
if (await user.hasOrganization(organizationId)) { ... }
```

## Build & Deployment

```bash
pnpm build          # Creates build/ directory
pnpm start          # Start production server
```

Deployment considerations:

- Set `NODE_ENV=production`
- Run migrations: `node ace migration:run --force`
- Generate APP_KEY: `node ace generate:key`
- Configure PostgreSQL connection
- Set up Resend API key
