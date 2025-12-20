# Alexia

> Transformez vos enregistrements audio en documents structurés grâce à l'IA.

## Concept

Alexia est une application web B2B qui transforme des enregistrements audio (réunions, dictées, appels) en documents écrits parfaitement structurés. Ce n'est pas juste un transcripteur, c'est un rédacteur intelligent capable de s'adapter au métier de l'utilisateur (Avocat, Médecin, Commercial).

**L'objectif** : L'utilisateur dépose un audio de 1 heure en désordre, et récupère en 2 minutes un document de synthèse clair et prêt à être envoyé.

## Fonctionnalités

### Atelier Audio
- Upload de fichiers (MP3, WAV, M4A)
- Enregistrement direct via microphone
- Interface drag & drop intuitive ("Drag, Drop, Done")

### Moteur de Transformation
- **Étape 1** : Transcription fidèle de l'audio en texte brut (avec distinction des interlocuteurs)
- **Étape 2** : Restructuration intelligente via Templates IA
- Adaptation au contexte métier de l'utilisateur

### Gestionnaire de Templates
- Templates prédéfinis par métier :
  - Compte rendu Médical
  - Synthèse Juridique
  - Liste d'actions commerciales
- Création de templates personnalisés
- Partage de templates au sein de l'organisation

### Dashboard & Export
- Bibliothèque d'enregistrements organisée
- Export PDF et Word formatés professionnellement
- Historique et recherche

## Expérience Utilisateur

- Interface **minimaliste** et **rassurante**
- Accent sur la **confidentialité** (sentiment de sécurité)
- Focus sur la **productivité**

---

## Stack Technique

### Frontend (Nuxt 4)

- **Framework**: Nuxt 4.2.1 (SPA mode, SSR disabled)
- **UI**: Nuxt UI 4.1.0
- **Styling**: Tailwind CSS 4.1.17 (via @tailwindcss/vite)
- **State**: Pinia 3.0.4
- **Validation**: Zod 4.1.12
- **i18n**: @nuxtjs/i18n 10.2.0 (français par défaut)

### Backend (AdonisJS v6)

- **Framework**: AdonisJS 6.19.1
- **ORM**: Lucid ORM 21.8.1 avec PostgreSQL
- **Auth**: @adonisjs/auth 9.5.1 avec tokens API
- **Mail**: @adonisjs/mail 9.2.2 + Resend
- **Validation**: @vinejs/vine 4.1.0
- **Authorization**: @adonisjs/bouncer 3.1.6
- **i18n**: @adonisjs/i18n 2.2.3 (français et anglais)
- **Billing**: Lemon Squeezy

---

## Structure du Projet

```
.
├── frontend/              # Application Nuxt 4
│   ├── app/              # Nouvelle structure Nuxt 4
│   │   ├── components/   # Components Vue auto-importés
│   │   ├── layouts/      # Layouts Nuxt (default.vue, auth.vue, app.vue)
│   │   ├── pages/        # Pages avec routing automatique
│   │   └── assets/
│   │       └── css/      # Styles globaux
│   └── nuxt.config.ts
│
└── backend/              # API AdonisJS v6
    ├── app/
    │   ├── controllers/
    │   ├── middleware/
    │   ├── models/
    │   ├── policies/
    │   └── validators/
    ├── config/
    ├── database/
    │   └── migrations/
    ├── resources/
    │   ├── lang/         # Fichiers de traduction
    │   └── views/        # Templates Email Edge.js
    └── start/
        ├── routes.ts
        └── validator.ts
```

---

## Démarrage Rapide

### Prérequis

- Node.js >= 18.x
- PostgreSQL >= 14.x
- pnpm (recommandé) ou npm

### Installation

1. **Cloner le repository**

```bash
git clone <your-repo-url>
cd Alexia
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
DB_DATABASE=alexia_db

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
createdb alexia_db

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

---

## Scripts Utiles

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
```

### Frontend

```bash
pnpm dev             # Mode développement
pnpm build           # Build pour production
pnpm preview         # Preview du build
pnpm typecheck       # TypeScript type checking
```

---

## Architecture Multi-Tenant

Alexia utilise une architecture multi-tenant où :

- Chaque utilisateur peut appartenir à **plusieurs organisations**
- Les données sont isolées par organisation (`currentOrganizationId`)
- **Rôles** : Owner (propriétaire), Administrator, Member

---

## Licence

Ce projet est sous licence MIT.
