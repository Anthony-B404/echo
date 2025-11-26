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

1. **ALWAYS filter queries by `organizationId`** - Never fetch data without tenant isolation
2. **User-Organization**: Each user belongs to exactly ONE organization
3. **Policies**: Always use Bouncer policies to verify tenant access
4. **Transactions**: Use database transactions for multi-model operations

### Database Schema

#### Core Tables

**users**
- `id` - Primary key
- `organizationId` - Foreign key to organizations (tenant isolation)
- `email` - Unique email
- `password` - Hashed password
- `role` - 1 (Owner) or 2 (Member)
- `isOwner` - Boolean flag
- `emailVerified` - Boolean flag
- `emailVerificationToken` - UUID for verification

**organizations**
- `id` - Primary key
- `name` - Organization name
- `logo` - Logo URL (optional)
- `email` - Organization email

**invitations**
- `id` - Primary key
- `identifier` - UUID (for public invitation links)
- `organizationId` - Foreign key to organizations
- `email` - Invitee email
- `role` - 1 (Owner) or 2 (Member)
- `expiresAt` - Expiration date

**access_tokens**
- Managed by @adonisjs/auth
- Polymorphic relation to User model

### Relationships

```typescript
// User model
@belongsTo(() => Organization)
declare organization: BelongsTo<typeof Organization>

// Organization model
@hasMany(() => User)
declare users: HasMany<typeof User>

@hasMany(() => Invitation)
declare invitations: HasMany<typeof Invitation>
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
    // Verify user belongs to organization
    return user.organizationId === organization.id && user.isOwner
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
        message: i18n.t('messages.auth.welcome')
      })
    } catch (error) {
      return response.unauthorized({
        message: i18n.t('messages.auth.invalid_credentials')
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
      i18n // ← Pass i18n
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
    name: vine.string().minLength(2)
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
      i18n // Always pass i18n
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
        <mj-text>
          {{ i18n.t('emails.verification.greeting') }}
        </mj-text>
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
import { BaseModel, column, belongsTo } from '@adonisjs/lucid/orm'
import type { BelongsTo } from '@adonisjs/lucid/types/relations'
import Organization from '#models/organization'

export default class User extends BaseModel {
  @column({ isPrimary: true })
  declare id: number

  @column()
  declare organizationId: number

  @column()
  declare email: string

  @column({ serializeAs: null })
  declare password: string

  @column()
  declare role: number

  @column.dateTime({ autoCreate: true })
  declare createdAt: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  declare updatedAt: DateTime

  @belongsTo(() => Organization)
  declare organization: BelongsTo<typeof Organization>
}
```

### Querying with Tenant Isolation

**Critical**: Always filter by `organizationId`

```typescript
// ✅ Correct - Filtered by organization
const users = await User.query()
  .where('organization_id', auth.user.organizationId)

// ❌ Wrong - No tenant isolation
const users = await User.all()
```

## Controllers

### Controller Pattern

**Thin controllers** - Business logic in models/services

```typescript
import type { HttpContext } from '@adonisjs/core/http'
import User from '#models/user'

export default class UsersController {
  async index({ auth, response }: HttpContext) {
    const users = await User.query()
      .where('organization_id', auth.user!.organizationId)

    return response.ok(users)
  }

  async show({ auth, params, response, bouncer }: HttpContext) {
    const user = await User.findOrFail(params.id)

    // Check tenant access
    if (user.organizationId !== auth.user!.organizationId) {
      return response.forbidden({
        message: 'Access denied'
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
      organizationId: 1
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
  const organization = await Organization.create({ name: 'Acme' }, { client: trx })
  const user = await User.create({
    email: 'owner@acme.com',
    organizationId: organization.id
  }, { client: trx })

  await trx.commit()
} catch (error) {
  await trx.rollback()
  throw error
}
```

### Pagination Pattern

```typescript
const users = await User.query()
  .where('organization_id', auth.user.organizationId)
  .paginate(page, perPage)

return response.ok(users.toJSON())
```

## Common Pitfalls

### Tenant Isolation

**Never** forget `organizationId` filtering:

```typescript
// ❌ Wrong - Data leak
const users = await User.all()

// ✅ Correct - Tenant isolated
const users = await User.query()
  .where('organization_id', auth.user.organizationId)
```

### i18n Messages

**Never** hardcode user-facing strings:

```typescript
// ❌ Wrong - Hardcoded
return response.unauthorized({ message: 'Invalid credentials' })

// ✅ Correct - i18n
return response.unauthorized({
  message: i18n.t('messages.auth.invalid_credentials')
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

// ✅ Correct - With policy check
const organization = await Organization.findOrFail(params.id)
await bouncer.with('OrganizationPolicy').authorize('view', organization)
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
