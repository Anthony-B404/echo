# Nuxt 4 + AdonisJS Multi-Tenant Boilerplate

Un boilerplate moderne et prêt à l'emploi pour créer des applications SaaS multi-tenant avec Nuxt 4 (frontend) et AdonisJS v6 (backend).

## 🚀 Fonctionnalités

- ✅ **Architecture Multi-Tenant** - Isolation complète des données par organisation
- 🔐 **Authentification API Tokens** - Système d'auth sécurisé avec tokens
- 📧 **Système de Mailing** - Intégration Resend pour l'envoi d'emails
- 👥 **Gestion des Invitations** - Inviter des membres à rejoindre une organisation
- ✉️ **Vérification Email** - Processus de vérification des emails utilisateurs
- 🎨 **UI Moderne** - Nuxt UI avec Tailwind CSS v4
- 🌐 **Internationalisation** - @nuxtjs/i18n configuré en français par défaut
- 📱 **Responsive** - Design adaptatif pour tous les écrans
- 🔄 **State Management** - Pinia pour la gestion d'état
- ✅ **Validation** - Zod (frontend) + VineJS (backend)

## 📚 Stack Technique

### Frontend (Nuxt 4)

- **Framework**: Nuxt 4.2.1 (SPA mode, SSR disabled)
- **UI**: Nuxt UI 4.1.0
- **Styling**: Tailwind CSS 4.1.17 (via @tailwindcss/vite)
- **State**: Pinia 3.0.4
- **Validation**: Zod 4.1.12
- **i18n**: @nuxtjs/i18n 10.2.0 (français par défaut)

### Backend (AdonisJS v6)

- **Framework**: AdonisJS 6.19.1
- **ORM**: Lucid ORM 21.8.1
- **Database**: PostgreSQL
- **Auth**: @adonisjs/auth 9.5.1 avec tokens
- **Mail**: @adonisjs/mail 9.2.2 + Resend
- **Validation**: @vinejs/vine 4.1.0
- **Authorization**: @adonisjs/bouncer 3.1.6
- **Templating**: Edge.js 6.3.0 + MJML 4.16.1

## 🏗️ Structure du Projet

```
.
├── frontend/              # Application Nuxt 4
│   ├── app/              # Nouvelle structure Nuxt 4
│   │   ├── components/   # Components Vue auto-importés
│   │   ├── layouts/      # Layouts Nuxt (default.vue, auth.vue, app.vue)
│   │   ├── pages/        # Pages avec routing automatique
│   │   │   ├── index.vue              # Dashboard
│   │   │   ├── login.vue              # Page de connexion
│   │   │   ├── waiting-verification.vue
│   │   │   └── invitation/[identifier].vue
│   │   └── assets/
│   │       └── css/      # Styles globaux
│   └── nuxt.config.ts
│
└── backend/              # API AdonisJS v6
    ├── app/
    │   ├── controllers/
    │   │   ├── users_controller.ts
    │   │   ├── organizations_controller.ts
    │   │   └── invitations_controller.ts
    │   ├── middleware/   # Middleware auth
    │   ├── models/
    │   │   ├── user.ts
    │   │   ├── organization.ts
    │   │   └── invitation.ts
    │   ├── policies/     # Policies d'autorisation
    │   └── validators/   # Validateurs VineJS
    ├── config/           # Configuration
    ├── database/
    │   └── migrations/   # Migrations DB
    └── start/
        └── routes.ts     # Routes API
```

## 🚦 Démarrage Rapide

### Prérequis

- Node.js >= 18.x
- PostgreSQL >= 14.x
- pnpm (recommandé) ou npm

### Installation

1. **Cloner le repository**

```bash
git clone <your-repo-url>
cd boilerplate
```

2. **Configurer le Backend**

```bash
cd backend
pnpm install

# Copier et configurer .env
cp .env.example .env
# Éditer .env avec vos configurations
```

3. **Configurer le Frontend**

```bash
cd frontend
pnpm install

# Copier et configurer .env
cp .env.example .env
# Éditer .env avec votre URL API
```

### Configuration des Variables d'Environnement

#### Backend (.env)

```bash
# Application
PORT=3333
HOST=localhost
NODE_ENV=development
APP_KEY=<générer avec: node ace generate:key>

# Database
DB_HOST=localhost
DB_PORT=5432
DB_USER=postgres
DB_PASSWORD=your_password
DB_DATABASE=boilerplate_db

# Mail (Resend)
RESEND_API_KEY=re_your_resend_api_key
```

#### Frontend (.env)

```bash
# API URL
API_URL=http://localhost:3333
```

### Initialiser la Base de Données

```bash
cd backend

# Créer la base de données
createdb boilerplate_db

# Exécuter les migrations
node ace migration:run
```

### Lancer l'Application

**Terminal 1 - Backend:**

```bash
cd backend
pnpm dev
# API disponible sur http://localhost:3333
```

**Terminal 2 - Frontend:**

```bash
cd frontend
pnpm dev
# App disponible sur http://localhost:3000
```

## 🔐 Système d'Authentification

### Rôles Utilisateurs

- **Owner (1)**: Propriétaire de l'organisation, tous les droits
- **Member (2)**: Membre de l'organisation, droits limités

### Flow d'Authentification

1. **Inscription Organisation**

   ```
   POST /signup
   {
     "email": "owner@example.com",
     "password": "password",
     "fullName": "John Doe",
     "organizationName": "My Company"
   }
   ```

2. **Connexion**

   ```
   POST /login
   {
     "email": "user@example.com",
     "password": "password"
   }
   ```

3. **Routes Protégées**
   - Toutes les routes sous `/api/*` nécessitent un token d'authentification
   - Header requis: `Authorization: Bearer <token>`

## 👥 Système d'Invitation

### Flow Complet

1. **Créer une Invitation**

   ```
   POST /invite-member (auth)
   {
     "email": "newmember@example.com",
     "role": 2
   }
   ```

2. **Vérifier l'Invitation**

   ```
   GET /check-invitation/:identifier (public)
   ```

3. **Accepter l'Invitation**
   ```
   POST /accept-invitation (public)
   {
     "identifier": "uuid",
     "fullName": "Jane Doe",
     "password": "password"
   }
   ```

## 📧 Configuration Email (Resend)

1. Créer un compte sur [Resend](https://resend.com)
2. Obtenir votre API Key
3. Configurer `RESEND_API_KEY` dans `.env`
4. Les templates email sont dans `backend/resources/views/emails/`

## 🎨 Personnalisation

### Composants UI

Le projet utilise **Nuxt UI 4.1.0** pour tous les composants d'interface. Les composants sont auto-importés et disponibles directement dans vos templates Vue.

Consultez la [documentation Nuxt UI](https://ui.nuxt.com) pour la liste complète des composants disponibles et leurs options de personnalisation.

### Créer une Nouvelle Route API

1. Créer le controller dans `backend/app/controllers/`
2. Ajouter la route dans `backend/start/routes.ts`
3. Créer le validator si nécessaire dans `backend/app/validators/`

### Ajouter une Page Frontend

1. Créer le fichier dans `frontend/app/pages/`
2. Nuxt 4 gère automatiquement le routing file-based

## 🗃️ Base de Données

### Schéma Principal

**users**

- id, fullName, email, password, role, isOwner
- organizationId (FK), emailVerified, verificationToken
- createdAt, updatedAt

**organizations**

- id, name, logo, email
- createdAt, updatedAt

**invitations**

- id, identifier (UUID), email, organizationId (FK)
- role, expiresAt, accepted
- createdAt, updatedAt

**access_tokens**

- id, tokenableId, type, name, hash
- abilities, expiresAt, createdAt, updatedAt

### Créer une Migration

```bash
cd backend
node ace make:migration create_your_table_name
node ace migration:run
```

## 🧪 Tests

### Backend (Japa)

```bash
cd backend
npm test
```

### Frontend (Vitest - à configurer)

```bash
cd frontend
npm test
```

## 📦 Déploiement

### Backend

1. Build: `pnpm build`
2. Configurer les variables d'environnement de production
3. Exécuter les migrations: `node ace migration:run --force`
4. Démarrer: `pnpm start`

### Frontend

1. Build: `pnpm build`
2. Deploy le dossier `.output` sur Vercel/Netlify/votre hébergeur

## 🔧 Scripts Utiles

### Backend

```bash
pnpm dev             # Mode développement avec HMR
pnpm build           # Build pour production
pnpm start           # Démarrer en production
pnpm test            # Exécuter les tests
pnpm lint            # ESLint
pnpm format          # Prettier
pnpm typecheck       # TypeScript type checking
node ace migration:run    # Exécuter les migrations
node ace migration:rollback  # Rollback dernière migration
node ace make:controller YourController
node ace make:model YourModel
```

### Frontend

```bash
pnpm dev             # Mode développement
pnpm build           # Build pour production
pnpm preview         # Preview du build
pnpm typecheck       # TypeScript type checking
```

## 📝 Bonnes Pratiques

1. **Multi-Tenant**: Toujours filtrer les requêtes par `organizationId`
2. **Sécurité**: Utiliser les policies Bouncer pour les autorisations
3. **Validation**: Valider toutes les entrées (Zod + VineJS)
4. **Types**: Utiliser TypeScript strict mode
5. **Git**: Commits atomiques et conventionnels

## 🤝 Contribuer

Les contributions sont les bienvenues ! N'hésitez pas à ouvrir une issue ou une PR.

## 📄 Licence

Ce projet est sous licence MIT.

## 🆘 Support

Pour toute question ou problème:

1. Vérifier la documentation
2. Consulter les issues GitHub
3. Créer une nouvelle issue si nécessaire

---

**Développé avec ❤️ en utilisant Nuxt 3 et AdonisJS v6**
