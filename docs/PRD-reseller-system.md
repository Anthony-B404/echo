# PRD : Système Revendeurs DH-Echo

## Résumé Exécutif

Transformation de DH-Echo d'un modèle B2C (inscription publique) vers un modèle B2B2B avec système de revendeurs. Les utilisateurs finaux ne pourront plus s'inscrire directement ; ils seront créés par des Revendeurs qui achètent des crédits en gros.

### Modèle Business

```
Super Admin (DH-Echo)
       │
       │ Vend crédits en gros (facturation manuelle)
       ▼
   Resellers
       │
       │ Distribuent crédits, fixent leurs prix
       ▼
  Organizations
       │
       │ Consomment crédits
       ▼
    Users (clients finaux)
```

---

## 1. Objectifs

### 1.1 Objectifs Business
- Supprimer l'inscription publique
- Permettre la vente B2B via revendeurs
- Traçabilité complète des crédits (achat → distribution → consommation)
- Facturation manuelle simplifiée

### 1.2 Objectifs Techniques
- Migration des crédits de User vers Organization
- Nouveau modèle Reseller avec pool de crédits
- Dashboards séparés par rôle (Super Admin, Reseller, Client)
- Authentification unifiée avec redirection par rôle

### 1.3 Critères de Succès
- [ ] Super Admin peut créer des Resellers
- [ ] Super Admin peut ajouter des crédits aux Resellers
- [ ] Reseller peut créer des Organizations et Users
- [ ] Reseller peut distribuer ses crédits aux Organizations
- [ ] Crédits consommés au niveau Organization
- [ ] Inscription publique désactivée

---

## 2. Architecture

### 2.1 Modèle de Données

#### Nouvelle table : `resellers`
| Colonne | Type | Description |
|---------|------|-------------|
| id | serial PK | Identifiant unique |
| name | varchar(255) | Nom commercial |
| email | varchar(255) | Email de contact principal |
| phone | varchar(50) | Téléphone (nullable) |
| company | varchar(255) | Raison sociale |
| siret | varchar(20) | SIRET (nullable) |
| address | text | Adresse complète (nullable) |
| credit_balance | integer | Pool de crédits disponibles (défaut: 0) |
| is_active | boolean | Compte actif (défaut: true) |
| notes | text | Notes internes Super Admin (nullable) |
| created_at | timestamp | Date de création |
| updated_at | timestamp | Date de modification |

#### Nouvelle table : `reseller_transactions`
| Colonne | Type | Description |
|---------|------|-------------|
| id | serial PK | Identifiant unique |
| reseller_id | FK → resellers | Revendeur concerné |
| amount | integer | Montant (+achat, -distribution) |
| type | enum | 'purchase', 'distribution', 'adjustment' |
| target_organization_id | FK → organizations | Organization cible (si distribution) |
| description | text | Description/motif |
| performed_by_user_id | FK → users | Qui a fait l'opération |
| created_at | timestamp | Date de transaction |

#### Modification table : `organizations`
| Colonne | Action | Description |
|---------|--------|-------------|
| reseller_id | ADD | FK → resellers (nullable pour migration) |
| credits | ADD | integer, crédits disponibles (défaut: 0) |

#### Modification table : `users`
| Colonne | Action | Description |
|---------|--------|-------------|
| credits | MIGRATE | Déplacer vers organizations puis DROP |
| is_super_admin | ADD | boolean (défaut: false) |
| reseller_id | ADD | FK → resellers (nullable) - si set, user est admin du Reseller |

#### Modification table : `credit_transactions`
| Colonne | Action | Description |
|---------|--------|-------------|
| user_id | KEEP | Pour historique |
| organization_id | ADD | FK → organizations |

### 2.2 Hiérarchie des Rôles

```
┌─────────────────────────────────────────────────────────────┐
│                      SUPER ADMIN                            │
│  - user.is_super_admin = true                               │
│  - Accès: /admin/*                                          │
│  - Peut: Tout                                               │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                    RESELLER ADMIN                           │
│  - user.reseller_id IS NOT NULL                             │
│  - Accès: /reseller/*                                       │
│  - Peut: Gérer ses Organizations/Users, distribuer crédits  │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│              ORGANIZATION OWNER/ADMIN/MEMBER                │
│  - user.reseller_id IS NULL                                 │
│  - user.is_super_admin = false                              │
│  - Accès: /dashboard/*                                      │
│  - Peut: Utiliser le service selon son rôle Organization    │
└─────────────────────────────────────────────────────────────┘
```

### 2.3 Routes API

#### Super Admin (`/api/admin/*`)
```
GET    /api/admin/resellers              # Liste des resellers
POST   /api/admin/resellers              # Créer un reseller
GET    /api/admin/resellers/:id          # Détail reseller
PUT    /api/admin/resellers/:id          # Modifier reseller
DELETE /api/admin/resellers/:id          # Désactiver reseller

POST   /api/admin/resellers/:id/credits  # Ajouter crédits au pool
GET    /api/admin/resellers/:id/transactions  # Historique transactions

GET    /api/admin/stats                  # Stats globales
```

#### Reseller (`/api/reseller/*`)
```
GET    /api/reseller/profile             # Profil du reseller
GET    /api/reseller/credits             # Pool de crédits + historique

GET    /api/reseller/organizations       # Ses organizations
POST   /api/reseller/organizations       # Créer organization
GET    /api/reseller/organizations/:id   # Détail organization
PUT    /api/reseller/organizations/:id   # Modifier organization

POST   /api/reseller/organizations/:id/credits  # Distribuer crédits
GET    /api/reseller/organizations/:id/users    # Users de l'org

POST   /api/reseller/organizations/:id/users    # Créer user dans org
DELETE /api/reseller/organizations/:id/users/:userId  # Supprimer user
```

#### Authentification (modification)
```
POST   /api/login                        # Login unifié (inchangé)
GET    /api/me                           # Retourne le rôle pour redirection
DELETE /api/signup                       # SUPPRIMER cette route
```

### 2.4 Routes Frontend

#### Super Admin (`/admin/*`)
```
/admin                          # Redirect → /admin/resellers
/admin/resellers                # Liste des resellers
/admin/resellers/new            # Créer reseller
/admin/resellers/:id            # Détail + édition reseller
/admin/resellers/:id/credits    # Gestion crédits reseller
```

#### Reseller (`/reseller/*`)
```
/reseller                       # Redirect → /reseller/organizations
/reseller/organizations         # Liste organizations
/reseller/organizations/new     # Créer organization
/reseller/organizations/:id     # Détail organization
/reseller/organizations/:id/users      # Users de l'org
/reseller/organizations/:id/credits    # Distribuer crédits
/reseller/credits               # Mon pool de crédits
/reseller/profile               # Mon profil reseller
```

#### Client Final (`/dashboard/*`) - Existant
```
/dashboard                      # Dashboard principal
/dashboard/analyze              # Analyse audio
/dashboard/settings/*           # Paramètres
```

---

## 3. Spécifications Fonctionnelles

### 3.1 Super Admin Dashboard

#### 3.1.1 Liste des Resellers
**Page**: `/admin/resellers`

| Élément | Description |
|---------|-------------|
| Tableau | Nom, Email, Société, Pool crédits, Statut, Date création |
| Recherche | Par nom, email, société |
| Filtres | Actif/Inactif |
| Actions | Voir, Éditer, Ajouter crédits |
| Bouton | "Nouveau Reseller" |

#### 3.1.2 Création Reseller
**Page**: `/admin/resellers/new`

| Champ | Type | Requis | Validation |
|-------|------|--------|------------|
| Nom commercial | text | Oui | min: 2, max: 255 |
| Email | email | Oui | Format email valide, unique |
| Téléphone | tel | Non | Format téléphone |
| Raison sociale | text | Oui | min: 2, max: 255 |
| SIRET | text | Non | 14 chiffres si fourni |
| Adresse | textarea | Non | - |
| Notes | textarea | Non | Usage interne |
| Crédits initiaux | number | Non | min: 0, défaut: 0 |

**À la création** :
1. Créer le Reseller
2. Créer un User admin pour ce Reseller (email du Reseller)
3. Envoyer email d'invitation avec lien de définition de mot de passe

#### 3.1.3 Gestion Crédits Reseller
**Page**: `/admin/resellers/:id/credits`

| Élément | Description |
|---------|-------------|
| Solde actuel | Affichage prominent du pool |
| Formulaire ajout | Montant + Description (ex: "Facture #123") |
| Historique | Tableau des transactions (date, type, montant, description) |

### 3.2 Reseller Dashboard

#### 3.2.1 Vue d'ensemble
**Page**: `/reseller`

| Widget | Description |
|--------|-------------|
| Pool crédits | Solde disponible à distribuer |
| Nb Organizations | Total organizations créées |
| Crédits distribués | Total crédits donnés aux orgs |
| Crédits consommés | Total utilisé par les clients |

#### 3.2.2 Liste Organizations
**Page**: `/reseller/organizations`

| Élément | Description |
|---------|-------------|
| Tableau | Nom, Email, Crédits restants, Nb users, Date création |
| Recherche | Par nom, email |
| Actions | Voir, Ajouter crédits, Gérer users |
| Bouton | "Nouvelle Organization" |

#### 3.2.3 Création Organization
**Page**: `/reseller/organizations/new`

| Champ | Type | Requis | Validation |
|-------|------|--------|------------|
| Nom | text | Oui | min: 2, max: 255 |
| Email | email | Oui | Format email valide |
| Logo | file | Non | Image, max 2MB |
| Crédits initiaux | number | Non | min: 0, max: pool disponible |

**À la création** :
1. Créer l'Organization liée au Reseller
2. Créer un User Owner pour cette Organization
3. Déduire les crédits initiaux du pool Reseller (si > 0)
4. Envoyer email d'invitation au Owner

#### 3.2.4 Distribution Crédits
**Page**: `/reseller/organizations/:id/credits`

| Élément | Description |
|---------|-------------|
| Pool Reseller | "Vous avez X crédits disponibles" |
| Solde Organization | Crédits actuels de l'org |
| Formulaire | Montant à transférer + Description |
| Historique | Transactions de cette org |

**Règles** :
- Ne peut pas distribuer plus que son pool
- Montant minimum : 1 crédit
- Transaction atomique (débit Reseller + crédit Organization)

#### 3.2.5 Gestion Users
**Page**: `/reseller/organizations/:id/users`

| Élément | Description |
|---------|-------------|
| Tableau | Nom, Email, Rôle, Date création |
| Actions | Modifier rôle, Supprimer |
| Bouton | "Inviter un utilisateur" |

Le Reseller peut :
- Créer des users dans ses Organizations
- Modifier les rôles (sauf Owner → autre chose)
- Supprimer des users (sauf Owner)

### 3.3 Authentification Modifiée

#### 3.3.1 Login Unifié
**Page**: `/login` (inchangée visuellement)

**Flow post-login** :
```javascript
const user = await login(email, password)

if (user.isSuperAdmin) {
  redirect('/admin')
} else if (user.resellerId) {
  redirect('/reseller')
} else {
  redirect('/dashboard')
}
```

#### 3.3.2 Suppression Inscription
- Supprimer la route `/signup`
- Supprimer la page `/signup`
- Retirer les liens "Créer un compte" du login
- Rediriger `/signup` vers `/login` avec message

### 3.4 Migration des Crédits

#### 3.4.1 Stratégie
1. Ajouter `credits` sur `organizations` (défaut: 0)
2. Pour chaque Organization :
   - Sommer les crédits de tous ses Users
   - Reporter sur `organizations.credits`
3. Migrer `credit_transactions` :
   - Ajouter `organization_id` basé sur le `user_id`
4. Modifier le code applicatif pour utiliser `organization.credits`
5. Supprimer `users.credits` (après validation)

#### 3.4.2 Script de Migration
```
1. ALTER TABLE organizations ADD COLUMN credits INTEGER DEFAULT 0;
2. UPDATE organizations SET credits = (SELECT SUM(credits) FROM users WHERE current_organization_id = organizations.id);
3. ALTER TABLE credit_transactions ADD COLUMN organization_id INTEGER REFERENCES organizations(id);
4. UPDATE credit_transactions SET organization_id = (SELECT current_organization_id FROM users WHERE users.id = credit_transactions.user_id);
5. -- Après validation applicative
6. ALTER TABLE users DROP COLUMN credits;
```

---

## 4. Plan d'Implémentation

### Phase 1 : Fondations (Backend) ✅
**Priorité**: Critique
**Estimation**: 2-3 jours

- [x] **1.1** Créer migration `resellers` table
- [x] **1.2** Créer migration `reseller_transactions` table
- [x] **1.3** Modifier migration `organizations` (add `reseller_id`, `credits`)
- [x] **1.4** Modifier migration `users` (add `is_super_admin`, `reseller_id`)
- [x] **1.5** Créer modèle `Reseller` avec relations
- [x] **1.6** Créer modèle `ResellerTransaction`
- [x] **1.7** Mettre à jour modèle `Organization` (relations, crédits)
- [x] **1.8** Mettre à jour modèle `User` (flags, relations)
- [x] **1.9** Créer seeder `super_admin` pour initialisation Super Admin

### Phase 2 : Migration Crédits
**Priorité**: Critique
**Estimation**: 1 jour

- [ ] **2.1** Script migration crédits User → Organization
- [ ] **2.2** Modifier `credit_transactions` (add `organization_id`)
- [ ] **2.3** Mettre à jour les méthodes de crédits (`hasEnoughCredits`, `deductCredits`)
- [ ] **2.4** Mettre à jour `transcription_job.ts` pour utiliser org.credits
- [ ] **2.5** Tests de non-régression

### Phase 3 : API Super Admin
**Priorité**: Haute
**Estimation**: 2 jours

- [ ] **3.1** Middleware `super_admin_middleware.ts`
- [ ] **3.2** `ResellersController` (CRUD)
- [ ] **3.3** `ResellerCreditsController` (ajout crédits)
- [ ] **3.4** Validators pour Reseller
- [ ] **3.5** Policy `ResellerPolicy`
- [ ] **3.6** Routes `/api/admin/*`

### Phase 4 : API Reseller
**Priorité**: Haute
**Estimation**: 2-3 jours

- [ ] **4.1** Middleware `reseller_middleware.ts`
- [ ] **4.2** `ResellerOrganizationsController`
- [ ] **4.3** `ResellerUsersController`
- [ ] **4.4** `ResellerCreditsDistributionController`
- [ ] **4.5** Validators Reseller operations
- [ ] **4.6** Policy `ResellerOrganizationPolicy`
- [ ] **4.7** Routes `/api/reseller/*`

### Phase 5 : Frontend Super Admin
**Priorité**: Haute
**Estimation**: 2-3 jours

- [ ] **5.1** Layout `/admin` avec navigation
- [ ] **5.2** Page liste resellers
- [ ] **5.3** Page création reseller
- [ ] **5.4** Page détail/édition reseller
- [ ] **5.5** Page gestion crédits reseller
- [ ] **5.6** Composables `useAdmin`, `useResellers`
- [ ] **5.7** Middleware frontend `admin.ts`

### Phase 6 : Frontend Reseller
**Priorité**: Haute
**Estimation**: 3-4 jours

- [ ] **6.1** Layout `/reseller` avec navigation
- [ ] **6.2** Dashboard reseller (overview)
- [ ] **6.3** Page liste organizations
- [ ] **6.4** Page création organization
- [ ] **6.5** Page détail organization
- [ ] **6.6** Page distribution crédits
- [ ] **6.7** Page gestion users organization
- [ ] **6.8** Page profil reseller
- [ ] **6.9** Composables `useReseller`, `useResellerOrganizations`
- [ ] **6.10** Middleware frontend `reseller.ts`

### Phase 7 : Auth & Cleanup
**Priorité**: Haute
**Estimation**: 1 jour

- [ ] **7.1** Modifier `/api/me` pour retourner le type de rôle
- [ ] **7.2** Modifier login frontend pour redirection par rôle
- [ ] **7.3** Supprimer route `/api/signup`
- [ ] **7.4** Supprimer page `/signup`
- [ ] **7.5** Redirect `/signup` → `/login`
- [ ] **7.6** Retirer liens inscription

### Phase 8 : Tests & Documentation
**Priorité**: Moyenne
**Estimation**: 1-2 jours

- [ ] **8.1** Tests unitaires modèles
- [ ] **8.2** Tests API Super Admin
- [ ] **8.3** Tests API Reseller
- [ ] **8.4** Tests E2E flows critiques
- [ ] **8.5** Documentation API (endpoints)
- [ ] **8.6** Guide utilisateur Reseller

---

## 5. Considérations Techniques

### 5.1 Sécurité

| Risque | Mitigation |
|--------|------------|
| Accès cross-reseller | Policy vérifie `organization.resellerId === user.resellerId` |
| Escalade de privilèges | Middleware strict par niveau de rôle |
| Distribution excessive | Vérification `amount <= reseller.creditBalance` |
| Injection SQL | Lucid ORM paramétré |

### 5.2 Performance

| Point | Solution |
|-------|----------|
| Liste resellers | Pagination, index sur `is_active` |
| Stats reseller | Cache 5min ou calcul async |
| Transactions | Index sur `reseller_id`, `organization_id` |

### 5.3 Transactions Atomiques

Opérations critiques à wrapper dans des transactions DB :
- Création Reseller + User admin
- Distribution crédits (débit Reseller + crédit Org)
- Création Organization + User Owner + Crédits initiaux

### 5.4 Emails Transactionnels

| Événement | Template | Destinataire |
|-----------|----------|--------------|
| Nouveau Reseller | `reseller_welcome` | Admin Reseller |
| Crédits ajoutés | `reseller_credits_added` | Admin Reseller |
| Nouvelle Organization | `organization_welcome` | Owner Org |
| Crédits distribués | `organization_credits_received` | Owner Org |

---

## 6. Post-MVP (Roadmap)

### 6.1 White-Label
- Reseller peut définir logo + couleur primaire
- CSS variables injectées dynamiquement
- Sous-domaine personnalisé optionnel

### 6.2 Stats Avancées
- Dashboard analytics pour Super Admin
- Graphiques usage par Reseller
- Export CSV des transactions

### 6.3 Automatisation
- Alertes email pool bas pour Resellers
- Notifications crédits bas pour Organizations
- Rapports mensuels automatiques

### 6.4 API Reseller
- API publique pour Resellers avancés
- Webhooks sur événements (crédits bas, nouveau user)
- Intégration facturation externe

---

## 7. Critères d'Acceptation

### MVP Complet quand :

- [ ] Super Admin peut créer un Reseller avec son admin
- [ ] Super Admin peut ajouter des crédits à un Reseller
- [ ] Reseller peut se connecter et voir son dashboard
- [ ] Reseller peut créer une Organization avec Owner
- [ ] Reseller peut distribuer ses crédits à ses Organizations
- [ ] Reseller peut créer des Users dans ses Organizations
- [ ] Client final peut se connecter et utiliser le service
- [ ] Crédits sont consommés au niveau Organization
- [ ] Inscription publique est désactivée
- [ ] Login redirige vers le bon dashboard selon le rôle

---

## Annexes

### A. Glossaire

| Terme | Définition |
|-------|------------|
| Super Admin | Administrateur DH-Echo (unique) |
| Reseller | Revendeur B2B client de DH-Echo |
| Reseller Admin | User qui gère un Reseller |
| Organization | Entreprise cliente du Reseller |
| Owner | Propriétaire d'une Organization |
| Pool crédits | Solde de crédits d'un Reseller |
| Distribution | Transfert de crédits Reseller → Organization |

### B. Diagramme de Flux Crédits

```
┌─────────────┐    Achat (manuel)    ┌─────────────┐
│ Super Admin │ ──────────────────── │  Reseller   │
└─────────────┘    +X crédits pool   │   (pool)    │
                                     └──────┬──────┘
                                            │
                                            │ Distribution
                                            │ -X pool, +X org
                                            ▼
                                     ┌─────────────┐
                                     │Organization │
                                     │  (crédits)  │
                                     └──────┬──────┘
                                            │
                                            │ Consommation
                                            │ -X crédits
                                            ▼
                                     ┌─────────────┐
                                     │   Usage     │
                                     │   Audio     │
                                     └─────────────┘
```

### C. Matrice des Permissions

| Action | Super Admin | Reseller Admin | Org Owner | Org Admin | Org Member |
|--------|:-----------:|:--------------:|:---------:|:---------:|:----------:|
| Créer Reseller | ✅ | ❌ | ❌ | ❌ | ❌ |
| Ajouter crédits Reseller | ✅ | ❌ | ❌ | ❌ | ❌ |
| Créer Organization | ❌ | ✅ (ses orgs) | ❌ | ❌ | ❌ |
| Distribuer crédits | ❌ | ✅ (ses orgs) | ❌ | ❌ | ❌ |
| Créer User | ❌ | ✅ (ses orgs) | ✅ | ✅ | ❌ |
| Utiliser audio | ❌ | ❌ | ✅ | ✅ | ✅ |
| Voir crédits org | ❌ | ✅ (ses orgs) | ✅ | ✅ | ✅ |
