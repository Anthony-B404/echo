# CLAUDE.md - Backend

This file provides guidance to Claude Code when working with the AdonisJS v6 backend.

## Technology Stack

- **Framework**: AdonisJS 6.14.1
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

### Critical Rules

1. **ALWAYS filter queries by `currentOrganizationId`** - Never fetch data without tenant isolation
2. **User-Organization**: Each user can belong to MULTIPLE organizations
3. **Current Organization Context**: All operations use the user's currently active organization (`currentOrganizationId`)
4. **Policies**: Always use Bouncer policies to verify tenant access with `hasOrganization()` and `isOwnerOf()` methods
5. **Transactions**: Use database transactions for multi-model operations
6. **Organization Switching**: Users can switch between their organizations via API endpoint

### Database Schema

#### Core Tables

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

**organizations**

- `id` - Primary key
- `name` - Organization name
- `logo` - Logo URL (optional)
- `email` - Organization email

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

// Helper methods
async isOwnerOf(organizationId: number): Promise<boolean>
async hasOrganization(organizationId: number): Promise<boolean>

// Organization model
@manyToMany(() => User, {
  pivotTable: 'organization_user',
  pivotColumns: ['role']
})
declare users: ManyToMany<typeof User>

@hasMany(() => Invitation)
declare invitations: HasMany<typeof Invitation>
```

### User Roles

```typescript
export enum UserRole {
  Owner = 1,
  Administrator = 2,
  Member = 3,
}
```

- **Owner**: Full control of organization (create, update, delete)
- **Administrator**: Can manage users and settings
- **Member**: Basic access to organization resources

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
DB_DATABASE=boilerplate_db

# Email
RESEND_API_KEY=            # From resend.com

# Optional
LOG_LEVEL=info
SESSION_DRIVER=cookie
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
