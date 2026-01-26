# DH-Echo

> Transformez vos enregistrements audio en documents structurés grâce à l'IA.

## Concept

DH-Echo est une application web B2B2B qui transforme des enregistrements audio (réunions, dictées, appels) en documents écrits parfaitement structurés. Ce n'est pas juste un transcripteur, c'est un rédacteur intelligent capable de s'adapter au métier de l'utilisateur (Avocat, Médecin, Commercial).

**L'objectif** : L'utilisateur dépose un audio de 1 heure en désordre, et récupère en 2 minutes un document de synthèse clair et prêt à être envoyé.

## Modèle de Distribution (B2B2B)

DH-Echo utilise un modèle de distribution via revendeurs :

```
DH-Echo (Super Admin)
    ↓ Gestion des revendeurs, attribution de crédits
Revendeur (Reseller)
    ↓ Création d'organisations, distribution de crédits, gestion des utilisateurs
Organisation (Client)
    ↓ Pool de crédits, utilisateurs
Utilisateur
    → Consommation des crédits via traitement audio
```

### Rôles Système

| Rôle | Accès | Responsabilités |
|------|-------|-----------------|
| **Super Admin** | `/admin/*` | Gestion des revendeurs, attribution des crédits au pool revendeur |
| **Reseller Admin** | `/reseller/*` | Création d'organisations, distribution des crédits, gestion des utilisateurs |
| **Utilisateur** | `/dashboard/*` | Utilisation du service de transformation audio |

### Flux des Crédits

```
Super Admin → Reseller Pool → Organization Pool → Consommation
```

**Note** : L'inscription publique est désactivée. Tous les utilisateurs sont créés par les administrateurs revendeurs.

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

### Demandes de Crédits
- Membres peuvent demander des crédits à l'Owner
- Owners peuvent demander des crédits au Reseller
- Workflow d'approbation/rejet avec messages optionnels
- Historique des demandes avec statuts

### Notifications In-App
- Icône cloche avec badge de compteur dans le header
- Notifications temps réel (polling 60 secondes)
- Types de notifications : demandes de crédits, crédits bas, distribution de crédits
- Navigation contextuelle au clic sur la notification

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
    │   ├── jobs/         # Workers BullMQ (transcription, GDPR)
    │   ├── middleware/
    │   ├── models/
    │   ├── policies/
    │   ├── services/     # Services métier (GDPR, queue, storage)
    │   └── validators/
    ├── commands/         # Commandes Ace (gdpr_scheduler)
    ├── config/
    │   └── queue.ts      # Configuration Redis/BullMQ
    ├── database/
    │   └── migrations/
    ├── resources/
    │   ├── lang/         # Fichiers de traduction
    │   └── views/        # Templates Email Edge.js
    └── start/
        ├── routes.ts
        ├── validator.ts
        └── worker.ts     # Initialisation des workers BullMQ
```

---

## Démarrage Rapide

### Prérequis

- Node.js >= 18.x
- PostgreSQL >= 14.x
- Redis >= 6.x (pour les jobs en arrière-plan)
- pnpm (recommandé) ou npm

### Installation

1. **Cloner le repository**

```bash
git clone <your-repo-url>
cd DH-Echo
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
DB_DATABASE=dh_echo_db

# Mail (Resend)
RESEND_API_KEY=re_your_resend_api_key

# Redis (BullMQ)
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=
```

#### Frontend (.env)

```bash
# API URL
API_URL=http://localhost:3333
```

### Installer Redis

**macOS (Homebrew):**

```bash
brew install redis
brew services start redis
```

**Ubuntu/Debian:**

```bash
sudo apt update
sudo apt install redis-server
sudo systemctl start redis
sudo systemctl enable redis
```

**Docker:**

```bash
docker run -d --name redis -p 6379:6379 redis:alpine
```

Vérifier l'installation : `redis-cli ping` → doit répondre `PONG`

### Initialiser la Base de Données

```bash
cd backend

# Créer la base de données
createdb dh_echo_db

# Exécuter les migrations
node ace migration:run
```

### Créer un Super Admin (Premier Accès)

L'inscription publique étant désactivée, vous devez créer un Super Admin manuellement :

```bash
cd backend

# Option 1: Via la console AdonisJS (si disponible)
node ace user:create-super-admin

# Option 2: Via SQL directement
# INSERT INTO users (email, is_super_admin, ...) VALUES ('admin@example.com', true, ...);
```

Une fois le Super Admin créé, vous pouvez :
1. Vous connecter à `/admin`
2. Créer des revendeurs
3. Les revendeurs peuvent ensuite créer des organisations et des utilisateurs

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
node ace migration:run       # Exécuter les migrations
node ace migration:rollback  # Rollback dernière migration
node ace gdpr:scheduler      # Traiter les suppressions GDPR dues
node ace subscription:renew  # Traiter les renouvellements d'abonnements
node ace cleanup:credit-requests   # Nettoyage des demandes de crédits traitées (>90j)
node ace cleanup:notifications     # Nettoyage des notifications lues (>30j)
node ace check:auto-refill         # Vérifier les auto-refills du lendemain
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

DH-Echo utilise une architecture multi-tenant hiérarchique :

### Hiérarchie des Données

```
Reseller (revendeur)
    └── Organizations (clients)
            └── Users (utilisateurs)
                    └── Audios (données)
```

### Isolation des Données

- **Niveau Reseller** : Les revendeurs ne peuvent accéder qu'aux organisations qu'ils ont créées
- **Niveau Organisation** : Les données sont isolées par `currentOrganizationId`
- **Utilisateurs** : Chaque utilisateur peut appartenir à **plusieurs organisations**

### Rôles au Niveau Organisation

| Rôle | Permissions |
|------|-------------|
| **Owner** | Contrôle total de l'organisation |
| **Administrator** | Gestion des membres, certains paramètres |
| **Member** | Accès basique aux ressources |

### Crédits

Les crédits sont gérés au niveau **Organisation** (et non au niveau utilisateur) :

1. Le Super Admin ajoute des crédits au pool du Reseller
2. Le Reseller distribue des crédits aux Organisations
3. Les utilisateurs consomment les crédits de leur organisation lors du traitement audio

---

## Jobs en Arrière-Plan (Redis & BullMQ)

DH-Echo utilise **BullMQ** avec **Redis** pour gérer les tâches asynchrones :

### Queues disponibles

| Queue | Description | Concurrence |
|-------|-------------|-------------|
| `audio-transcription` | Transcription audio via Mistral AI | 2 |
| `gdpr-deletion` | Suppression de compte GDPR | 1 |
| `gdpr-reminder` | Rappels avant suppression | 1 |

### Workers

Les workers démarrent **automatiquement** avec le serveur backend (`pnpm dev` ou `pnpm start`).

Pour vérifier que Redis fonctionne :

```bash
redis-cli ping
# Doit répondre: PONG
```

### Scheduler GDPR (CRON)

Le système GDPR nécessite un **cron job** pour :
- Exécuter les suppressions de compte programmées (après 30 jours)
- Envoyer les emails de rappel (J-7 et J-1)

#### Configuration du CRON

**Développement** (exécution manuelle) :

```bash
cd backend
node ace gdpr:scheduler
```

**Production** (cron automatique) :

```bash
# Ajouter à crontab (crontab -e)
# Exécution quotidienne à 2h du matin
0 2 * * * cd /path/to/dh-echo/backend && node ace gdpr:scheduler >> /var/log/dh-echo-gdpr.log 2>&1
```

#### Ce que fait le scheduler

1. **Traite les suppressions dues** : demandes avec `scheduled_for <= now`
2. **Envoie les rappels** : emails à J-7 et J-1 avant suppression
3. **Ajoute les jobs à BullMQ** : les workers traitent ensuite automatiquement

### Tous les Jobs CRON (Production)

| Horaire | Commande | Description |
|---------|----------|-------------|
| 0:05 | `node ace subscription:renew` | Renouvellements d'abonnements |
| 2:00 | `node ace gdpr:scheduler` | Suppressions GDPR et rappels |
| 3:00 | `node ace cleanup:credit-requests` | Nettoyage demandes de crédits (hebdo dimanche) |
| 3:00 | `node ace cleanup:notifications` | Nettoyage notifications lues > 30 jours |
| 18:00 | `node ace check:auto-refill` | Avertissement auto-refill insuffisant (24h avant) |

**Configuration Production** (`docker/scheduler/crontab`) :
```bash
5 0 * * * node ace subscription:renew
0 2 * * * node ace gdpr:scheduler
0 3 * * 0 node ace cleanup:credit-requests
0 3 * * * node ace cleanup:notifications
0 18 * * * node ace check:auto-refill
```

#### Flow de suppression GDPR

```
Jour 0  → Demande de suppression + Email de confirmation
Jour 23 → Email de rappel (J-7)
Jour 29 → Email de rappel (J-1)
Jour 30 → Suppression automatique + Email de confirmation finale
```

---

## Licence

Ce projet est sous licence MIT.
