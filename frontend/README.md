# DH-Echo Frontend

Application Nuxt 4 pour DH-Echo - Transformation audio en documents structurés.

## Stack Technique

- **Framework**: Nuxt 4.2.1 (SPA mode)
- **UI**: Nuxt UI 4.1.0
- **Styling**: Tailwind CSS v4
- **State**: Pinia 3.0.4
- **Validation**: Zod 4.1.12
- **i18n**: @nuxtjs/i18n (français par défaut)

## Installation

```bash
pnpm install
```

## Développement

```bash
pnpm dev
# App disponible sur http://localhost:3000
```

## Configuration

Créer un fichier `.env` :

```bash
API_URL=http://localhost:3333
```

## Structure du Projet

```
app/
├── components/     # Composants Vue auto-importés
├── composables/    # Fonctions de composition
├── layouts/        # Layouts (default, auth, app)
├── middleware/     # Middleware de routes (auth, admin, reseller)
├── pages/          # Pages avec routing automatique
│   ├── admin/      # Pages Super Admin
│   ├── reseller/   # Pages Reseller Admin
│   └── dashboard/  # Pages utilisateurs
└── stores/         # Stores Pinia
```

## Rôles et Accès

| Rôle | Pages | Middleware |
|------|-------|------------|
| Super Admin | `/admin/*` | `admin` |
| Reseller Admin | `/reseller/*` | `reseller` |
| Utilisateur | `/dashboard/*` | `auth` |

## Scripts

```bash
pnpm dev          # Serveur de développement
pnpm build        # Build production
pnpm preview      # Preview du build
pnpm typecheck    # Vérification TypeScript
```

## Points Importants

- **Pas d'inscription publique** : Les utilisateurs sont créés par les revendeurs
- **Crédits au niveau Organisation** : Les crédits sont gérés par organisation, pas par utilisateur
- **Redirection par rôle** : Après login, redirection automatique selon le type d'utilisateur
- **Notifications in-app** : Icône cloche avec badge dans le header, polling 60s

## Composables Clés

| Composable | Description |
|------------|-------------|
| `useAuth` | Authentification, token, profil utilisateur |
| `useApi` | Appels API avec Accept-Language automatique |
| `useNotifications` | Notifications in-app (état partagé) |
| `useDashboard` | État des slideovers (notifications, etc.) |
| `useSettingsPermissions` | Permissions basées sur le rôle |

Pour plus de détails, voir [CLAUDE.md](./CLAUDE.md).
