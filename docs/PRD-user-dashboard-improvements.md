# PRD: Améliorations du Dashboard Utilisateur

**Version**: 1.3
**Date**: 24 janvier 2026
**Auteur**: DH-Echo Product Team
**Statut**: Draft

---

## 1. Vue d'ensemble

### 1.1 Contexte

Le dashboard utilisateur permet actuellement aux membres d'une organisation de gérer leurs audios : upload, transcription, analyse et export. Cependant, plusieurs limitations ont été identifiées :

- Les crédits sont uniquement gérés au niveau organisation, sans possibilité de distribution aux membres
- L'interface de gestion des audios est plate (liste simple) sans organisation en dossiers
- Les analyses générées ne peuvent pas être éditées après génération
- Les permissions des rôles sont figées sans possibilité de personnalisation

### 1.2 Objectifs

- Permettre aux Owners de distribuer des crédits aux membres avec options de recharge automatique
- Créer un système de demande de crédits entre membres et Owner/Reseller
- Prévenir les uploads sans crédits suffisants avec système de demande intégré
- Notifier les utilisateurs des événements importants liés aux crédits
- Offrir une gestion modulaire des permissions par rôle
- Transformer la gestion des audios en système de dossiers type "Drive"
- Permettre l'édition des analyses avec historique des modifications

### 1.3 Utilisateurs cibles

| Persona           | Besoins                                                                                      |
| ----------------- | -------------------------------------------------------------------------------------------- |
| **Owner**         | Gérer la distribution des crédits, configurer les permissions, organiser l'espace de travail |
| **Administrator** | Gérer les membres et audios selon les permissions accordées                                  |
| **Member**        | Demander des crédits, organiser ses audios, éditer ses analyses                              |

---

## 2. Feature 1: Distribution de crédits par l'Owner

### 2.1 Description

Permettre aux Owners de distribuer des crédits du pool organisation vers les membres individuellement, avec option de recharge automatique mensuelle ou distribution ponctuelle.

### 2.2 User Stories

| ID     | En tant que | Je veux                                                                           | Afin de                                                 |
| ------ | ----------- | --------------------------------------------------------------------------------- | ------------------------------------------------------- |
| US-1.0 | Owner       | Choisir le mode de gestion des crédits (pool commun ou distribution individuelle) | Adapter la gestion à la taille et culture de mon équipe |
| US-1.1 | Owner       | Distribuer des crédits ponctuels à un membre (mode individuel)                    | Lui permettre de traiter des audios                     |
| US-1.2 | Owner       | Configurer une recharge mensuelle automatique pour un membre (mode individuel)    | Simplifier la gestion récurrente                        |
| US-1.3 | Owner       | Voir le solde de crédits de chaque membre                                         | Suivre l'utilisation individuelle                       |
| US-1.4 | Owner       | Récupérer les crédits non utilisés d'un membre (mode individuel)                  | Redistribuer les ressources                             |
| US-1.5 | Owner       | Définir un plafond de crédits par membre (mode individuel)                        | Contrôler les dépenses                                  |
| US-1.6 | Member      | Voir mon solde de crédits personnel                                               | Savoir combien je peux utiliser                         |
| US-1.7 | Owner       | Basculer d'un mode à l'autre                                                      | Adapter la gestion selon l'évolution de l'équipe        |

### 2.3 Règles métier

1. **Mode de gestion des crédits (choix Owner)** :

   L'Owner configure le mode de gestion des crédits pour son organisation. Ce choix est modifiable à tout moment.

   | Mode                          | Description                                        | Cas d'usage                                            |
   | ----------------------------- | -------------------------------------------------- | ------------------------------------------------------ |
   | **Pool commun**               | Tous les membres puisent dans le pool organisation | Petites équipes, confiance élevée, simplicité          |
   | **Distribution individuelle** | Crédits alloués par membre avec contrôle           | Grandes équipes, contrôle budgétaire, suivi individuel |

   **Mode Pool commun** (`credit_mode = 'shared'`) :
   - Les crédits restent dans `organization.credits`
   - Tous les membres consomment directement depuis le pool
   - Pas de notion de solde individuel
   - L'Owner voit la consommation par membre dans l'historique
   - ⚠️ Risque : un membre peut consommer tous les crédits

   **Mode Distribution individuelle** (`credit_mode = 'individual'`) :
   - Les crédits sont distribués du pool vers les comptes utilisateurs (`user_credits.balance`)
   - Chaque membre a son propre solde
   - L'Owner contrôle combien chaque membre peut utiliser
   - Possibilité de plafonds et recharges automatiques

2. **Distribution ponctuelle** (mode individuel uniquement) :
   - L'Owner sélectionne un membre et un montant
   - Les crédits sont déduits du pool organisation
   - Les crédits sont ajoutés au solde du membre
   - Transaction enregistrée avec type `distribution`

3. **Recharge automatique (top-up)** (mode individuel uniquement) :
   - Configuration : cible de balance (`autoRefillAmount`) + date de recharge (1er du mois ou anniversaire)
   - Le système ramène le solde utilisateur à la cible configurée
   - **Calcul** : `crédits à transférer = max(0, cible - balance actuelle)`
   - Seule la différence est déduite du pool organisation
   - **Protection d'idempotence** : `lastRefillAt` empêche les doubles exécutions si le cron tourne plusieurs fois le même jour
   - **Exemple** : Membre a 20 crédits, cible = 100 → recharge de 80 crédits
   - **Exemple 2** : Membre a 120 crédits, cible = 100 → pas de recharge (déjà au-dessus de la cible)

4. **Récupération de crédits** (mode individuel uniquement) :
   - L'Owner peut récupérer tout ou partie des crédits non utilisés
   - Les crédits retournent dans le pool organisation
   - Transaction enregistrée avec type `recovery`

5. **Changement de mode** :
   - L'Owner peut basculer entre les deux modes à tout moment
   - **Pool → Individuel** : Les crédits restent dans le pool, l'Owner doit ensuite distribuer
   - **Individuel → Pool** : Les crédits des membres sont automatiquement récupérés vers le pool (avec confirmation)

6. **Contraintes** :
   - Distribution impossible si pool organisation insuffisant
   - Un membre ne peut pas avoir plus de crédits que son plafond (mode individuel)
   - ⚠️ **Pas de découvert** : Un membre avec 0 crédits ne peut pas traiter d'audio (décision produit)
   - Historique complet des mouvements pour audit

### 2.4 Spécifications techniques

#### Base de données

```sql
-- Modification table organizations pour le mode de gestion
ALTER TABLE organizations
  ADD COLUMN credit_mode VARCHAR(20) NOT NULL DEFAULT 'shared'; -- 'shared' (pool commun) ou 'individual' (distribution)

-- Nouvelle table pour crédits utilisateur (mode individual uniquement)
CREATE TABLE user_credits (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  organization_id INTEGER NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  balance INTEGER NOT NULL DEFAULT 0,
  credit_cap INTEGER NULL, -- Plafond (null = illimité)
  auto_refill_enabled BOOLEAN DEFAULT false,
  auto_refill_amount INTEGER NULL, -- Cible de balance pour top-up (comme monthlyCreditsTarget des organisations)
  auto_refill_day INTEGER NULL, -- Jour du mois (1-28) ou 0 pour anniversaire
  last_refill_at TIMESTAMP NULL, -- Protection d'idempotence (évite doubles exécutions si cron tourne plusieurs fois)
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(user_id, organization_id)
);

-- Nouvelle table pour transactions utilisateur
CREATE TABLE user_credit_transactions (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  organization_id INTEGER NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  performed_by_user_id INTEGER NOT NULL REFERENCES users(id),
  amount INTEGER NOT NULL, -- Positif = ajout, Négatif = déduction
  balance_after INTEGER NOT NULL,
  type VARCHAR(50) NOT NULL, -- 'distribution', 'recovery', 'usage', 'auto_refill'
  description TEXT NULL,
  audio_id INTEGER NULL REFERENCES audios(id) ON DELETE SET NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Index pour performances
CREATE INDEX idx_user_credits_org_user ON user_credits(organization_id, user_id);
CREATE INDEX idx_user_credit_transactions_user ON user_credit_transactions(user_id, organization_id);
```

#### API Endpoints

| Méthode  | Endpoint                                   | Description                                              |
| -------- | ------------------------------------------ | -------------------------------------------------------- |
| `GET`    | `/api/credits/mode`                        | Mode actuel de l'organisation (`shared` ou `individual`) |
| `PUT`    | `/api/credits/mode`                        | Changer le mode (Owner only)                             |
| `GET`    | `/api/credits/members`                     | Liste des membres avec leurs soldes/consommation         |
| `POST`   | `/api/credits/distribute`                  | Distribution ponctuelle (mode individual)                |
| `POST`   | `/api/credits/recover`                     | Récupération de crédits (mode individual)                |
| `PUT`    | `/api/credits/members/:userId/auto-refill` | Configurer recharge auto (mode individual)               |
| `DELETE` | `/api/credits/members/:userId/auto-refill` | Désactiver recharge auto (mode individual)               |
| `GET`    | `/api/credits/my-balance`                  | Solde personnel du membre                                |
| `GET`    | `/api/credits/my-transactions`             | Historique personnel                                     |

#### Modèle UserCredit

```typescript
// app/models/user_credit.ts
export default class UserCredit extends BaseModel {
  @column({ isPrimary: true })
  declare id: number;

  @column()
  declare userId: number;

  @column()
  declare organizationId: number;

  @column()
  declare balance: number;

  @column()
  declare creditCap: number | null;

  @column()
  declare autoRefillEnabled: boolean;

  @column()
  declare autoRefillAmount: number | null;

  @column()
  declare autoRefillDay: number | null;

  @column.dateTime()
  declare lastRefillAt: DateTime | null;

  @belongsTo(() => User)
  declare user: BelongsTo<typeof User>;

  @belongsTo(() => Organization)
  declare organization: BelongsTo<typeof Organization>;

  // Méthodes
  hasEnoughCredits(amount: number): boolean;
  canReceiveCredits(amount: number): boolean;
  getMaxReceivableCredits(): number | null;
  getCreditsNeededForRefill(): number; // Calcule la différence pour atteindre autoRefillAmount (cible)
  async deductCredits(
    amount: number,
    performedBy: User,
    audioId?: number,
  ): Promise<UserCreditTransaction>;
  async addCredits(
    amount: number,
    type: string,
    performedBy: User,
  ): Promise<UserCreditTransaction>;
}
```

### 2.5 Interface utilisateur

**Sélecteur de mode** (`/dashboard/settings/credits`) - Owner only

- Card en haut de page avec toggle ou radio buttons
- **Mode Pool commun** : Icône équipe + description "Tous les membres partagent le même pool de crédits"
- **Mode Distribution** : Icône utilisateur + description "Chaque membre a son propre solde de crédits"
- Confirmation requise lors du changement de mode (surtout Individual → Shared)

**Page gestion crédits membres** (`/dashboard/settings/credits`)

- **Mode Pool commun** :
  - Affichage du pool organisation en évidence
  - Tableau des membres avec colonnes : Nom, Email, Consommation totale, Dernière utilisation
  - Pas d'actions de distribution (les membres puisent directement)

- **Mode Distribution individuelle** :
  - Tableau des membres avec colonnes : Nom, Email, Solde, Plafond, Auto-refill, Actions
  - Badge indicateur : 🟢 Normal | 🟡 Bas (<20%) | 🔴 Vide (0)
  - Actions par membre :
    - Bouton "Distribuer" → Modal avec montant
    - Bouton "Récupérer" → Modal avec montant max = solde actuel
    - Toggle "Auto-refill" → Expansion avec config (montant, jour)

**Widget solde personnel** (Header dashboard)

- **Mode Pool commun** : Affiche le solde du pool organisation pour tous
- **Mode Distribution** : Affiche le solde individuel de l'utilisateur
- Tooltip avec détail selon le mode
- Lien vers historique personnel

**Page mon historique** (`/dashboard/credits`)

- Vue actuelle enrichie avec transactions utilisateur
- Filtres : Tous | Reçus | Utilisés | Récupérés
- Export CSV optionnel
- **⚠️ Adaptation selon le rôle** :
  - **Owner** : Voit les consommations globales de l'organisation (tous les membres)
    - Affiche toutes les transactions de l'organisation
    - Colonne "Utilisé par" visible avec le nom du membre
    - Solde affiché = pool organisation
  - **Administrator** : Voit les consommations globales (si permission `credits.view_all`)
    - Même vue que l'Owner si permission accordée
    - Sinon, vue limitée à ses propres transactions
  - **Member** : Voit uniquement ses propres utilisations de crédits
    - Affiche seulement ses transactions personnelles
    - Colonne "Utilisé par" masquée (toujours soi-même)
    - Solde affiché = son solde personnel (`user_credits.balance`)

### 2.6 Critères d'acceptation

**Mode de gestion :**

- [x] L'Owner peut choisir le mode de gestion des crédits (pool commun ou distribution individuelle)
- [x] Le mode par défaut est "pool commun" pour les nouvelles organisations
- [x] L'Owner peut basculer d'un mode à l'autre avec confirmation
- [x] Le changement Individual → Shared récupère automatiquement les crédits des membres vers le pool

**Mode Pool commun :**

- [x] Tous les membres consomment directement depuis le pool organisation
- [x] L'Owner voit la consommation par membre dans l'historique

**Mode Distribution individuelle :**

- [x] L'Owner peut distribuer des crédits ponctuels à un membre
- [x] Les crédits sont correctement déduits du pool organisation
- [x] L'Owner peut configurer une recharge automatique pour un membre
- [x] Le job CRON de recharge automatique fonctionne correctement
- [x] L'Owner peut récupérer des crédits non utilisés

**Affichage :**

- [x] Chaque membre voit le bon solde dans le header (pool ou perso selon le mode)
- [x] L'historique des transactions utilisateur est visible
- [x] Les transactions sont auditables avec qui/quand/combien
- [x] La page `/dashboard/credits` affiche les consommations globales pour l'Owner
- [x] La page `/dashboard/credits` affiche uniquement les transactions personnelles pour un Member

---

## 3. Feature 2: Système de demande de crédits

### 3.1 Description

Permettre aux membres de demander des crédits à l'Owner, et à l'Owner de demander des crédits au Reseller, avec workflow d'approbation et notifications.

### 3.2 User Stories

| ID     | En tant que | Je veux                                  | Afin de                          |
| ------ | ----------- | ---------------------------------------- | -------------------------------- |
| US-2.1 | Member      | Demander des crédits à l'Owner           | Pouvoir continuer à travailler   |
| US-2.2 | Member      | Voir le statut de mes demandes           | Savoir si je dois attendre       |
| US-2.3 | Owner       | Voir les demandes de crédits des membres | Traiter les besoins              |
| US-2.4 | Owner       | Approuver ou refuser une demande         | Contrôler les distributions      |
| US-2.5 | Owner       | Demander des crédits au Reseller         | Recharger le pool organisation   |
| US-2.6 | Reseller    | Voir et traiter les demandes des Owners  | Maintenir l'activité des clients |

### 3.3 Règles métier

1. **Types de demandes** :
   - `member_to_owner` : Membre demande à l'Owner
   - `owner_to_reseller` : Owner demande au Reseller

2. **Statuts de demande** :
   - `pending` : En attente de traitement
   - `approved` : Approuvée et crédits distribués
   - `rejected` : Refusée avec motif optionnel

3. **Workflow membre → Owner** :
   - Le membre crée une demande avec montant souhaité et justification
   - L'Owner reçoit une notification (in-app + email optionnel)
   - L'Owner approuve → crédits distribués automatiquement
   - L'Owner refuse → notification au membre avec motif

4. **Workflow Owner → Reseller** :
   - L'Owner crée une demande depuis `/dashboard/credits`
   - Le Reseller voit la demande dans `/reseller/organizations/:id`
   - Le Reseller approuve → crédits distribués au pool organisation
   - Le Reseller refuse → notification à l'Owner

5. **Contraintes** :
   - Maximum 1 demande pending par utilisateur (évite le spam)
   - Historique des demandes conservé 90 jours
   - Notifications in-app obligatoires, email configurable

### 3.4 Spécifications techniques

#### Base de données

```sql
CREATE TABLE credit_requests (
  id SERIAL PRIMARY KEY,
  type VARCHAR(50) NOT NULL, -- 'member_to_owner', 'owner_to_reseller'
  requester_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  organization_id INTEGER NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  reseller_id INTEGER NULL REFERENCES resellers(id) ON DELETE CASCADE, -- Pour owner_to_reseller
  amount INTEGER NOT NULL,
  justification TEXT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'pending', -- 'pending', 'approved', 'rejected'
  processed_by_user_id INTEGER NULL REFERENCES users(id),
  rejection_reason TEXT NULL,
  processed_at TIMESTAMP NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Index pour requêtes fréquentes
CREATE INDEX idx_credit_requests_org_status ON credit_requests(organization_id, status);
CREATE INDEX idx_credit_requests_requester ON credit_requests(requester_id, status);
```

#### API Endpoints

| Méthode | Endpoint                           | Description                    |
| ------- | ---------------------------------- | ------------------------------ |
| `POST`  | `/api/credit-requests`             | Créer une demande              |
| `GET`   | `/api/credit-requests`             | Mes demandes (requester)       |
| `GET`   | `/api/credit-requests/pending`     | Demandes à traiter (Owner)     |
| `POST`  | `/api/credit-requests/:id/approve` | Approuver une demande          |
| `POST`  | `/api/credit-requests/:id/reject`  | Refuser une demande            |
| `GET`   | `/api/reseller/credit-requests`    | Demandes des Owners (Reseller) |

### 3.5 Interface utilisateur

**Bouton demande rapide** (Header dashboard - Member)

- Icône "+" à côté du solde
- Click → Modal de demande avec :
  - Input montant
  - Textarea justification (optionnel)
  - Affichage du pool organisation si visible
  - Bouton "Envoyer la demande"

**Badge notification** (Header dashboard - Owner)

- Badge rouge sur icône crédits si demandes pending
- Click → Liste des demandes à traiter

**Modal traitement demande** (Owner)

- Infos demandeur : Nom, solde actuel, historique usage
- Montant demandé + justification
- Boutons : "Approuver" | "Refuser" (avec input motif)

**Page demandes Reseller** (`/reseller/organizations/:id/credit-requests`)

- Liste des demandes des Owners
- Même interface d'approbation/refus

### 3.6 Critères d'acceptation

- [x] Un membre peut créer une demande de crédits
- [x] L'Owner reçoit une notification pour les nouvelles demandes
- [x] L'Owner peut approuver et les crédits sont distribués automatiquement
- [x] L'Owner peut refuser avec un motif
- [x] Le membre voit le statut de ses demandes
- [x] L'Owner peut demander des crédits au Reseller
- [x] Le Reseller peut traiter les demandes des Owners
- [x] Maximum 1 demande pending par utilisateur

---

## 4. Feature 3: Vérification de crédits avant upload

### 4.1 Description

Vérifier que l'utilisateur dispose de suffisamment de crédits avant de lancer un upload, avec popup d'avertissement et option de demande rapide si insuffisant.

### 4.2 User Stories

| ID     | En tant que | Je veux                                                  | Afin de                      |
| ------ | ----------- | -------------------------------------------------------- | ---------------------------- |
| US-3.1 | User        | Être averti si je n'ai pas assez de crédits avant upload | Éviter une erreur frustrante |
| US-3.2 | Member      | Demander des crédits directement depuis le popup         | Gagner du temps              |
| US-3.3 | Owner       | Demander au Reseller depuis le popup                     | Recharger rapidement         |
| US-3.4 | User        | Voir combien de crédits seront consommés                 | Anticiper ma consommation    |

### 4.3 Règles métier

1. **Estimation des crédits** :
   - Calcul basé sur la durée : `Math.ceil(duration / 60)` (1 crédit par minute)
   - Affichage avant validation de l'upload

2. **Vérification** :
   - Membre : vérification sur `user_credits.balance`
   - Owner sans crédits utilisateur : vérification sur `organization.credits`

3. **Cas insuffisant - Membre** :
   - Popup avec message d'avertissement
   - Bouton "Demander des crédits à l'Owner"
   - Pré-remplissage du montant nécessaire

4. **Cas insuffisant - Owner** :
   - Popup avec message d'avertissement
   - Bouton "Demander des crédits au Reseller"
   - Pré-remplissage du montant nécessaire

5. **Bypass optionnel** :
   - L'Owner peut autoriser l'upload même sans crédits suffisants (déduction sur pool org)
   - Configuration dans les permissions de l'organisation

### 4.4 Spécifications techniques

#### Logique Frontend

```typescript
// composables/useCreditsCheck.ts
export function useCreditsCheck() {
  const { user } = useAuth();
  const creditsStore = useCreditsStore();

  async function checkCreditsForUpload(duration: number): Promise<{
    hasEnough: boolean;
    required: number;
    available: number;
    canRequestFrom: "owner" | "reseller" | null;
  }> {
    const required = Math.ceil(duration / 60);
    const available = creditsStore.userBalance; // Nouveau: solde utilisateur

    return {
      hasEnough: available >= required,
      required,
      available,
      canRequestFrom: user.value?.isOwnerOf ? "reseller" : "owner",
    };
  }

  return { checkCreditsForUpload };
}
```

#### Composant InsufficientCreditsModal

```vue
<!-- components/credits/InsufficientCreditsModal.vue -->
<template>
  <UModal v-model="isOpen">
    <UCard>
      <template #header>
        <div class="flex items-center gap-2 text-amber-600">
          <UIcon name="i-heroicons-exclamation-triangle" />
          <span>Crédits insuffisants</span>
        </div>
      </template>

      <div class="space-y-4">
        <p>
          Vous avez besoin de <strong>{{ required }}</strong> crédits pour cet
          audio.
        </p>
        <p>
          Votre solde actuel : <strong>{{ available }}</strong> crédits.
        </p>
        <p class="text-red-600">
          Il vous manque <strong>{{ required - available }}</strong> crédits.
        </p>
      </div>

      <template #footer>
        <div class="flex justify-end gap-2">
          <UButton variant="ghost" @click="close">Annuler</UButton>
          <UButton color="primary" @click="requestCredits">
            Demander {{ required - available }} crédits
          </UButton>
        </div>
      </template>
    </UCard>
  </UModal>
</template>
```

### 4.5 Interface utilisateur

**Zone d'upload** (`/dashboard`)

- Avant sélection fichier : affichage solde actuel
- Après sélection fichier : estimation "Cet audio nécessite ~X crédits"
- Indicateur visuel : 🟢 OK | 🟡 Juste | 🔴 Insuffisant

**Popup insuffisant**

- Message clair sur le manque
- Calcul : requis - disponible = manquant
- Bouton principal : "Demander X crédits"
- Bouton secondaire : "Annuler"
- Pour Owner : option "Utiliser le pool organisation"

### 4.6 Critères d'acceptation

- [ ] L'estimation de crédits est affichée après sélection du fichier
- [ ] Un popup s'affiche si crédits insuffisants
- [ ] Le membre peut demander des crédits depuis le popup
- [ ] L'Owner peut demander au Reseller depuis le popup
- [ ] L'Owner peut choisir d'utiliser le pool organisation
- [ ] L'upload est bloqué tant que les crédits sont insuffisants

---

## 5. Feature 4: Permissions modulaires par rôle

### 5.1 Description

Permettre à l'Owner de configurer les permissions de chaque rôle (Administrator, Member) de manière granulaire, par catégorie d'actions.

### 5.2 User Stories

| ID     | En tant que | Je veux                                                   | Afin de                               |
| ------ | ----------- | --------------------------------------------------------- | ------------------------------------- |
| US-4.1 | Owner       | Configurer les permissions des Administrators             | Déléguer certaines responsabilités    |
| US-4.2 | Owner       | Configurer les permissions des Members                    | Contrôler l'accès aux fonctionnalités |
| US-4.3 | Owner       | Voir un aperçu des permissions actuelles                  | Comprendre qui peut faire quoi        |
| US-4.4 | User        | Voir uniquement les fonctionnalités auxquelles j'ai accès | Éviter la confusion                   |

### 5.3 Règles métier

1. **Catégories de permissions** :

| Catégorie    | Permissions                                                                                      |
| ------------ | ------------------------------------------------------------------------------------------------ |
| **Audios**   | `audio.upload`, `audio.view_own`, `audio.view_all`, `audio.edit`, `audio.delete`, `audio.export` |
| **Dossiers** | `folder.create`, `folder.manage_own`, `folder.manage_all`, `folder.share`                        |
| **Crédits**  | `credits.view_own`, `credits.view_all`, `credits.distribute`, `credits.request`                  |
| **Membres**  | `members.view`, `members.invite`, `members.edit`, `members.remove`                               |
| **Settings** | `settings.organization`, `settings.billing`, `settings.permissions`                              |

2. **Permissions par défaut** :

| Permission             | Owner | Administrator | Member   |
| ---------------------- | ----- | ------------- | -------- |
| `audio.upload`         | ✅    | ✅            | ✅       |
| `audio.view_own`       | ✅    | ✅            | ✅       |
| `audio.view_all`       | ✅    | ✅            | ❌       |
| `audio.edit`           | ✅    | ✅            | ✅ (own) |
| `audio.delete`         | ✅    | ✅            | ✅ (own) |
| `folder.create`        | ✅    | ✅            | ❌       |
| `folder.share`         | ✅    | ✅            | ❌       |
| `credits.view_all`     | ✅    | ❌            | ❌       |
| `credits.distribute`   | ✅    | ❌            | ❌       |
| `members.invite`       | ✅    | ✅            | ❌       |
| `members.remove`       | ✅    | ❌            | ❌       |
| `settings.permissions` | ✅    | ❌            | ❌       |

3. **Règles de modification** :
   - Seul l'Owner peut modifier les permissions
   - L'Owner ne peut pas se retirer de permissions
   - Les permissions sont stockées au niveau organisation

4. **Héritage** :
   - Owner a TOUTES les permissions (non modifiable)
   - Administrator hérite des permissions configurées
   - Member hérite des permissions configurées (subset)

### 5.4 Spécifications techniques

#### Base de données

```sql
CREATE TABLE organization_role_permissions (
  id SERIAL PRIMARY KEY,
  organization_id INTEGER NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  role INTEGER NOT NULL, -- 2 = Administrator, 3 = Member
  permissions JSONB NOT NULL DEFAULT '[]', -- Liste des permissions actives
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(organization_id, role)
);

-- Seed avec permissions par défaut
INSERT INTO organization_role_permissions (organization_id, role, permissions)
SELECT o.id, 2, '["audio.upload", "audio.view_own", "audio.view_all", "audio.edit", "audio.delete", "folder.create", "folder.share", "members.view", "members.invite"]'
FROM organizations o;

INSERT INTO organization_role_permissions (organization_id, role, permissions)
SELECT o.id, 3, '["audio.upload", "audio.view_own", "audio.edit", "audio.delete", "credits.request"]'
FROM organizations o;
```

#### API Endpoints

| Méthode | Endpoint                       | Description                              |
| ------- | ------------------------------ | ---------------------------------------- |
| `GET`   | `/api/permissions`             | Permissions de l'utilisateur courant     |
| `GET`   | `/api/permissions/roles`       | Config permissions par rôle (Owner)      |
| `PUT`   | `/api/permissions/roles/:role` | Modifier permissions d'un rôle           |
| `GET`   | `/api/permissions/available`   | Liste toutes les permissions disponibles |

#### Middleware de vérification

```typescript
// app/middleware/permission_middleware.ts
export default class PermissionMiddleware {
  async handle(
    ctx: HttpContext,
    next: NextFn,
    options: { permission: string },
  ) {
    const { user } = ctx.auth;
    const hasPermission = await this.checkPermission(user, options.permission);

    if (!hasPermission) {
      return ctx.response.forbidden({ error: "PERMISSION_DENIED" });
    }

    await next();
  }

  private async checkPermission(
    user: User,
    permission: string,
  ): Promise<boolean> {
    // Owner a toutes les permissions
    if (await user.isOwnerOf(user.currentOrganizationId)) {
      return true;
    }

    const rolePermissions = await OrganizationRolePermission.query()
      .where("organizationId", user.currentOrganizationId)
      .where("role", user.organizationRole)
      .first();

    return rolePermissions?.permissions.includes(permission) ?? false;
  }
}
```

### 5.5 Interface utilisateur

**Page permissions** (`/dashboard/settings/permissions`) - Owner only

- Tableau avec colonnes : Permission, Description, Administrator, Member
- Toggles par cellule pour activer/désactiver
- Groupement par catégorie (Audios, Dossiers, Crédits, Membres, Settings)
- Bouton "Réinitialiser par défaut"

**Adaptation UI selon permissions**

- Masquer les éléments de menu non autorisés
- Désactiver les boutons d'action non autorisés
- Messages d'erreur clairs si tentative d'action non permise

### 5.6 Critères d'acceptation

- [ ] L'Owner peut voir et modifier les permissions par rôle
- [ ] Les permissions sont correctement vérifiées côté backend
- [ ] L'interface s'adapte aux permissions de l'utilisateur
- [ ] Les permissions par défaut sont appliquées aux nouvelles organisations
- [ ] L'Owner peut réinitialiser les permissions par défaut
- [ ] Les actions non permises sont bloquées avec message clair

---

## 6. Feature 5: Système de dossiers type Drive

### 6.1 Description

Remplacer la liste plate d'audios par un système de dossiers hiérarchique avec dossiers privés et partagés, permettant une meilleure organisation du contenu.

### 6.2 User Stories

| ID     | En tant que | Je veux                                          | Afin de                           |
| ------ | ----------- | ------------------------------------------------ | --------------------------------- |
| US-5.1 | User        | Créer des dossiers pour organiser mes audios     | Retrouver facilement mes fichiers |
| US-5.2 | User        | Avoir des dossiers privés (visibles que par moi) | Protéger mon travail personnel    |
| US-5.3 | Owner/Admin | Créer des dossiers partagés avec l'organisation  | Collaborer avec l'équipe          |
| US-5.4 | User        | Déplacer des audios entre dossiers               | Réorganiser mon contenu           |
| US-5.5 | User        | Partager l'accès à un dossier spécifique         | Collaborer de manière ciblée      |
| US-5.6 | User        | Naviguer dans l'arborescence de dossiers         | Explorer le contenu organisé      |
| US-5.7 | User        | Rechercher dans tous les dossiers                | Trouver rapidement un audio       |

### 6.3 Règles métier

1. **Types de dossiers** :
   - `private` : Visible uniquement par le créateur
   - `shared` : Visible par tous les membres de l'organisation
   - `restricted` : Visible par membres spécifiques (liste d'accès)

2. **Structure par défaut** :
   - Racine "Mes audios" (privé, par utilisateur)
   - Racine "Partagés" (organisation-wide)
   - Dossiers créés manuellement sous ces racines

3. **Hiérarchie** :
   - Profondeur maximale : 5 niveaux
   - Un audio ne peut être que dans UN dossier à la fois
   - Un dossier peut contenir des sous-dossiers et des audios

4. **Héritage des permissions** :
   - Dossier privé → contenu privé
   - Dossier partagé → contenu visible par tous
   - Dossier restreint → contenu visible par liste d'accès

5. **Audios sans dossier** :
   - Placés automatiquement dans "Mes audios" (dossier racine privé)
   - Migration des audios existants vers ce dossier

6. **Actions sur dossiers** :
   - Créer, Renommer, Supprimer (si vide ou avec confirmation)
   - Déplacer (avec contenu)
   - Partager/Départager (changer la visibilité interne à l'organisation)

7. **Partage externe** :
   - ⚠️ **Pas de partage externe au niveau dossier** (décision produit)
   - Le partage externe (lien public) reste uniquement au niveau audio
   - Un dossier "shared" ou "restricted" ne concerne que les membres de l'organisation

### 6.4 Spécifications techniques

#### Base de données

```sql
CREATE TABLE folders (
  id SERIAL PRIMARY KEY,
  organization_id INTEGER NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  created_by_user_id INTEGER NOT NULL REFERENCES users(id),
  parent_id INTEGER NULL REFERENCES folders(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  type VARCHAR(20) NOT NULL DEFAULT 'private', -- 'private', 'shared', 'restricted'
  is_root BOOLEAN DEFAULT false, -- true pour dossiers racine système
  depth INTEGER NOT NULL DEFAULT 0, -- Niveau dans l'arborescence
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE folder_access (
  id SERIAL PRIMARY KEY,
  folder_id INTEGER NOT NULL REFERENCES folders(id) ON DELETE CASCADE,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  can_edit BOOLEAN DEFAULT false, -- Lecture seule ou édition
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(folder_id, user_id)
);

-- Modification table audios
ALTER TABLE audios
  ADD COLUMN folder_id INTEGER NULL REFERENCES folders(id) ON DELETE SET NULL;

-- Index pour performances
CREATE INDEX idx_folders_org_parent ON folders(organization_id, parent_id);
CREATE INDEX idx_folders_type ON folders(organization_id, type);
CREATE INDEX idx_audios_folder ON audios(folder_id);
```

#### API Endpoints

| Méthode  | Endpoint                          | Description                           |
| -------- | --------------------------------- | ------------------------------------- |
| `GET`    | `/api/folders`                    | Arborescence des dossiers accessibles |
| `GET`    | `/api/folders/:id`                | Contenu d'un dossier                  |
| `POST`   | `/api/folders`                    | Créer un dossier                      |
| `PUT`    | `/api/folders/:id`                | Modifier un dossier                   |
| `DELETE` | `/api/folders/:id`                | Supprimer un dossier                  |
| `POST`   | `/api/folders/:id/move`           | Déplacer un dossier                   |
| `POST`   | `/api/folders/:id/access`         | Ajouter accès utilisateur             |
| `DELETE` | `/api/folders/:id/access/:userId` | Retirer accès utilisateur             |
| `POST`   | `/api/audios/:id/move`            | Déplacer un audio                     |

#### Modèle Folder

```typescript
// app/models/folder.ts
export default class Folder extends BaseModel {
  @column({ isPrimary: true })
  declare id: number;

  @column()
  declare organizationId: number;

  @column()
  declare createdByUserId: number;

  @column()
  declare parentId: number | null;

  @column()
  declare name: string;

  @column()
  declare type: "private" | "shared" | "restricted";

  @column()
  declare isRoot: boolean;

  @column()
  declare depth: number;

  @belongsTo(() => Folder, { foreignKey: "parentId" })
  declare parent: BelongsTo<typeof Folder>;

  @hasMany(() => Folder, { foreignKey: "parentId" })
  declare children: HasMany<typeof Folder>;

  @hasMany(() => Audio)
  declare audios: HasMany<typeof Audio>;

  @manyToMany(() => User, {
    pivotTable: "folder_access",
    pivotColumns: ["can_edit"],
  })
  declare accessUsers: ManyToMany<typeof User>;
}
```

### 6.5 Interface utilisateur

**Vue principale** (`/dashboard/library`)

- Sidebar gauche : Arborescence des dossiers (type tree view)
  - "Mes audios" (icône dossier + badge privé)
  - "Partagés" (icône dossier + badge organisation)
  - Dossiers créés avec indentation
  - Bouton "+" pour créer un dossier

- Zone principale : Contenu du dossier sélectionné
  - Fil d'Ariane (breadcrumb) cliquable
  - Grille ou liste des sous-dossiers
  - Grille ou liste des audios
  - Actions : Nouveau dossier, Upload audio

**Composant FolderTree**

```vue
<!-- components/folders/FolderTree.vue -->
<template>
  <div class="folder-tree">
    <FolderTreeItem
      v-for="folder in rootFolders"
      :key="folder.id"
      :folder="folder"
      :selected-id="selectedFolderId"
      @select="emit('select', $event)"
    />
  </div>
</template>
```

**Actions contextuelles**

- Clic droit sur dossier : Renommer, Déplacer, Partager, Supprimer
- Clic droit sur audio : Déplacer vers, Partager, Exporter, Supprimer
- Drag & drop pour déplacer audios/dossiers

**Modal partage dossier**

- Sélection type : Privé / Partagé / Restreint
- Si restreint : Liste des membres avec checkboxes
- Option "Peut éditer" par membre

### 6.6 Critères d'acceptation

- [ ] L'utilisateur peut créer des dossiers privés et partagés
- [ ] L'arborescence de dossiers s'affiche correctement
- [ ] Les audios peuvent être déplacés entre dossiers
- [ ] Les dossiers privés sont visibles uniquement par leur créateur
- [ ] Les dossiers partagés sont visibles par toute l'organisation
- [ ] Les dossiers restreints sont visibles par les membres autorisés
- [ ] La recherche fonctionne sur tous les dossiers accessibles
- [ ] La migration des audios existants vers "Mes audios" est effectuée
- [ ] La profondeur maximale de 5 niveaux est respectée

---

## 7. Feature 6: Édition des analyses avec historique

### 7.1 Description

Permettre aux utilisateurs d'éditer les analyses générées, avec un système de versioning complet permettant de voir l'historique des modifications et de revenir à une version précédente.

> **Note** : La transcription brute n'est pas éditable. Seule l'analyse peut être modifiée par l'utilisateur.

### 7.2 User Stories

| ID     | En tant que | Je veux                             | Afin de                               |
| ------ | ----------- | ----------------------------------- | ------------------------------------- |
| US-6.1 | User        | Éditer l'analyse générée            | Affiner le résultat selon mes besoins |
| US-6.2 | User        | Voir l'historique des modifications | Savoir qui a modifié quoi et quand    |
| US-6.3 | User        | Revenir à une version précédente    | Annuler une modification indésirable  |
| US-6.4 | User        | Voir les différences entre versions | Comprendre ce qui a changé            |
| US-6.5 | Owner/Admin | Voir qui a édité un document        | Tracer les modifications pour audit   |

### 7.3 Règles métier

1. **Éléments éditables** :
   - Analyse (`transcription.analysis`) uniquement
   - ⚠️ **La transcription brute n'est pas éditable** (lecture seule)

2. **Versioning** :
   - Chaque sauvegarde crée une nouvelle version
   - Conservation de toutes les versions (pas de limite)
   - Métadonnées : auteur, timestamp, type de modification

3. **Comparaison de versions** :
   - Diff textuel entre deux versions
   - Mise en évidence : ajouts (vert), suppressions (rouge)

4. **Restauration** :
   - Créer une nouvelle version avec le contenu de l'ancienne
   - Ne supprime pas l'historique intermédiaire
   - Notification si l'audio a été modifié par quelqu'un d'autre depuis

5. **Verrouillage optimiste** :
   - Pas de verrouillage exclusif
   - Détection de conflit à la sauvegarde
   - Si conflit : affichage des deux versions pour résolution manuelle

6. **Permissions** :
   - Édition selon permission `audio.edit`
   - Historique visible par tous ceux qui ont accès à l'audio

### 7.4 Spécifications techniques

#### Base de données

```sql
CREATE TABLE transcription_versions (
  id SERIAL PRIMARY KEY,
  transcription_id INTEGER NOT NULL REFERENCES transcriptions(id) ON DELETE CASCADE,
  user_id INTEGER NOT NULL REFERENCES users(id),
  version_number INTEGER NOT NULL,
  field_name VARCHAR(50) NOT NULL, -- 'analysis' uniquement (transcription non éditable)
  content TEXT NOT NULL, -- Contenu de cette version
  change_summary VARCHAR(255) NULL, -- Résumé optionnel de la modification
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(transcription_id, field_name, version_number)
);

-- Modification table transcriptions
ALTER TABLE transcriptions
  ADD COLUMN analysis_version INTEGER DEFAULT 1,
  ADD COLUMN last_edited_by_user_id INTEGER NULL REFERENCES users(id),
  ADD COLUMN last_edited_at TIMESTAMP NULL;

-- Index pour performances
CREATE INDEX idx_transcription_versions_lookup ON transcription_versions(transcription_id, field_name, version_number);
```

#### API Endpoints

| Méthode | Endpoint                                           | Description                  |
| ------- | -------------------------------------------------- | ---------------------------- |
| `PUT`   | `/api/audios/:id/transcription`                    | Éditer transcription/analyse |
| `GET`   | `/api/audios/:id/transcription/history`            | Historique des versions      |
| `GET`   | `/api/audios/:id/transcription/version/:versionId` | Contenu d'une version        |
| `POST`  | `/api/audios/:id/transcription/restore/:versionId` | Restaurer une version        |
| `GET`   | `/api/audios/:id/transcription/diff`               | Comparer deux versions       |

#### Service de versioning

```typescript
// app/services/transcription_version_service.ts
export default class TranscriptionVersionService {
  async saveVersion(
    transcriptionId: number,
    fieldName: "analysis", // Seule l'analyse est éditable
    newContent: string,
    userId: number,
    changeSummary?: string,
  ): Promise<TranscriptionVersion> {
    // 1. Récupérer le dernier numéro de version
    // 2. Créer la nouvelle version
    // 3. Mettre à jour le contenu actuel
    // 4. Mettre à jour last_edited_by/at
    // 5. Retourner la version créée
  }

  async getHistory(
    transcriptionId: number,
    fieldName: string,
  ): Promise<TranscriptionVersion[]> {
    // Retourne toutes les versions triées par version_number DESC
  }

  async restore(
    transcriptionId: number,
    versionId: number,
    userId: number,
  ): Promise<TranscriptionVersion> {
    // 1. Récupérer le contenu de la version cible
    // 2. Créer une nouvelle version avec ce contenu
    // 3. Marquer comme "restored from version X"
  }

  async getDiff(
    transcriptionId: number,
    fromVersion: number,
    toVersion: number,
  ): Promise<DiffResult> {
    // Utiliser une lib comme 'diff' pour générer le diff
  }
}
```

### 7.5 Interface utilisateur

**Page audio** (`/dashboard/:id`)

- Bouton "Éditer" sur le tab Analyse uniquement (transcription en lecture seule)
- Mode lecture (défaut) / Mode édition (toggle)
- Indicateur "Dernière modification par X il y a Y"

**Mode édition**

⚠️ **Prérequis technique** : Mise à jour de Nuxt UI vers la version 4.4+ requise pour accéder aux nouveaux composants d'édition.

**Composants Nuxt UI à utiliser** :

- `UEditor` : Composant principal d'édition rich-text (basé sur TipTap)
- `UEditorToolbar` : Barre d'outils avec formatage (gras, italique, listes, etc.)
- `UEditorDragHandle` : Poignée de glisser-déposer pour réorganiser les blocs
- `UEditorSuggestionMenu` : Menu de suggestions (slash commands)
- `UEditorMentionMenu` : Menu de mentions (optionnel, pour collaboration future)
- `UEditorEmojiMenu` : Sélecteur d'emojis (optionnel)

**Interface d'édition** :

- `UEditor` avec `UEditorToolbar` intégré pour le formatage
- Barre d'actions : Annuler (local), Sauvegarder, Historique
- Input "Résumé de la modification" (optionnel)
- Boutons : "Sauvegarder" | "Annuler"

```vue
<!-- Exemple de structure recommandée -->
<UEditor v-model="content" :editable="isEditing">
  <template #toolbar>
    <UEditorToolbar />
  </template>
</UEditor>
```

**Modal historique**

- Liste des versions avec : Numéro, Auteur, Date, Résumé
- Actions par version : Voir, Comparer, Restaurer
- Comparaison : Split view avec diff coloré

**Alerte de conflit**

- Modal si quelqu'un a modifié pendant l'édition
- Affichage : "Votre version" | "Version serveur"
- Options : "Garder la mienne", "Prendre la leur", "Fusionner manuellement"

### 7.6 Critères d'acceptation

- [x] Nuxt UI est mis à jour vers la version 4.1+ (prérequis)
- [x] L'éditeur utilise exclusivement les composants UEditor de Nuxt UI
- [x] L'utilisateur peut éditer l'analyse (transcription en lecture seule)
- [x] Chaque modification crée une nouvelle version
- [x] L'historique des versions est consultable
- [x] L'utilisateur peut voir les différences entre versions
- [x] L'utilisateur peut restaurer une version précédente
- [x] Les conflits d'édition sont détectés et gérés
- [x] L'auteur et la date de dernière modification sont affichés

---

## 8. Priorités et dépendances

### 8.1 Ordre de priorité suggéré

| Priorité | Feature                           | Justification                                    |
| -------- | --------------------------------- | ------------------------------------------------ |
| 🔴 P1    | Vérification crédits avant upload | Quick win, améliore l'UX immédiatement           |
| 🔴 P1    | Distribution crédits par Owner    | Fondation pour le système de crédits utilisateur |
| 🟡 P2    | Système de demande de crédits     | Complète le workflow de crédits                  |
| 🟡 P2    | Notifications in-app              | Alertes crédits et demandes, complète Feature 2  |
| 🟡 P2    | Édition des analyses              | Forte demande utilisateur, valeur immédiate      |
| 🟢 P3    | Permissions modulaires            | Améliore la flexibilité, effort modéré           |
| 🟢 P3    | Système de dossiers               | Plus complexe, transformation majeure de l'UX    |

### 8.2 Dépendances techniques

```
┌─────────────────────────────────────────────────────────────┐
│                    Modifications de base                     │
│  - Migration: créer table user_credits                      │
│  - Migration: créer table credit_requests                   │
│  - Migration: créer table notifications                     │
│  - Migration: créer table organization_role_permissions     │
│  - Migration: créer table folders + folder_access           │
│  - Migration: créer table transcription_versions            │
│  - Frontend: Upgrade Nuxt UI vers 4.4+ (pour Feature 6)     │
└─────────────────────────────────────────────────────────────┘
                              │
        ┌─────────────────────┼─────────────────────┐
        ▼                     ▼                     ▼
┌───────────────┐   ┌───────────────────┐   ┌───────────────┐
│ Feature 1:    │   │ Feature 4:        │   │ Feature 6:    │
│ Distribution  │   │ Permissions       │   │ Édition       │
│ crédits       │   │ modulaires        │   │ analyses      │
│ (indépendant) │   │ (indépendant)     │   │ (Nuxt UI 4.4+)│
└───────────────┘   └───────────────────┘   └───────────────┘
        │
        ▼
┌───────────────────────────────────────────────────────────┐
│ Feature 2: Demandes de crédits                             │
│ (dépend de Feature 1 pour le modèle user_credits)         │
└───────────────────────────────────────────────────────────┘
        │
        ├───────────────────────────────────────────────────┐
        ▼                                                   ▼
┌───────────────────────────────────────┐   ┌───────────────────────────────────────┐
│ Feature 3: Vérification avant upload   │   │ Feature 7: Notifications in-app       │
│ (dépend de Feature 1 + 2)             │   │ (dépend de Feature 2 pour alertes)   │
└───────────────────────────────────────┘   └───────────────────────────────────────┘

┌───────────────────────────────────────────────────────────┐
│ Feature 5: Système de dossiers                             │
│ (indépendant, peut être fait en parallèle)                │
│ Nécessite migration des audios existants                   │
└───────────────────────────────────────────────────────────┘
```

### 8.3 Estimation d'effort

| Feature                  | Backend | Frontend | Total estimé |
| ------------------------ | ------- | -------- | ------------ |
| Distribution crédits     | Moyen   | Moyen    | 3-4 jours    |
| Demandes de crédits      | Moyen   | Moyen    | 2-3 jours    |
| Vérif avant upload       | Faible  | Moyen    | 1-2 jours    |
| Notifications in-app     | Faible  | Moyen    | 2-3 jours    |
| Permissions modulaires   | Moyen   | Moyen    | 3-4 jours    |
| Système de dossiers      | Élevé   | Élevé    | 5-7 jours    |
| Édition analyses         | Moyen   | Moyen    | 3-4 jours    |
| **Upgrade Nuxt UI 4.4+** | -       | Faible   | 0.5 jour     |

> **Note** : L'upgrade Nuxt UI 4.4+ est un prérequis pour la Feature 6 (Édition analyses) et doit être effectué en premier.

---

## 9. Annexes

### 9.1 Maquettes UI (à créer)

- [ ] Dashboard avec widget solde utilisateur
- [ ] Page gestion crédits membres (Owner)
- [ ] Modal demande de crédits
- [ ] Popup crédits insuffisants avant upload
- [ ] Page configuration permissions
- [ ] Vue Drive avec arborescence dossiers
- [x] Mode édition analyse (avec composants UEditor de Nuxt UI 4.1+)
- [x] Modal historique des versions avec diff

### 9.2 Décisions prises

| Question                             | Décision                  | Justification                                                                        |
| ------------------------------------ | ------------------------- | ------------------------------------------------------------------------------------ |
| **Crédits : Découvert temporaire ?** | ❌ Non                    | Bloquer si 0 crédits - simplicité et contrôle                                        |
| **Dossiers : Partage externe ?**     | ❌ Non                    | Partage audio par audio uniquement - sécurité                                        |
| **Versions : Rétention ?**           | ✅ Illimité               | Conservation de tout l'historique                                                    |
| **Éditeur : Composants UI ?**        | ✅ Nuxt UI 4.1+ (UEditor) | Cohérence design system, composants TipTap intégrés, maintenance simplifiée          |
| **Transcription : Éditable ?**       | ❌ Non                    | Transcription en lecture seule, seule l'analyse est éditable - intégrité des données |

### 9.3 Questions ouvertes restantes

1. **Permissions** : Faut-il des permissions personnalisées par utilisateur (en plus des rôles) ?
2. **Migration dossiers** : Comment gérer les audios partagés existants ? Dossier spécial ?
3. **Quotas** : Faut-il un nombre maximum d'audios par dossier ?

### 9.3 Risques identifiés

| Risque                             | Impact | Mitigation                                |
| ---------------------------------- | ------ | ----------------------------------------- |
| Conflit d'édition simultanée       | Moyen  | Détection optimiste + résolution manuelle |
| Migration des audios vers dossiers | Élevé  | Script de migration + mode maintenance    |
| Complexité UI dossiers             | Moyen  | Design itératif + tests utilisateurs      |
| Performance arborescence           | Moyen  | Lazy loading + cache client               |
| Incohérence permissions            | Élevé  | Tests automatisés + audit logging         |

---

## 10. Feature 7: Système de notifications in-app

### 10.1 Description

Système de notifications in-app pour alerter les utilisateurs des événements importants liés aux crédits, avec icône cloche dans le header et badge de compteur.

### 10.2 User Stories

| ID     | En tant que | Je veux                                               | Afin de                                        |
| ------ | ----------- | ----------------------------------------------------- | ---------------------------------------------- |
| US-7.1 | Owner       | Être notifié quand un membre demande des crédits      | Traiter rapidement les demandes                |
| US-7.2 | Owner       | Être alerté quand le pool passe sous 100 crédits      | Anticiper le rechargement                      |
| US-7.3 | Owner       | Être averti si l'auto-refill ne pourra pas s'exécuter | Éviter les échecs de recharge                  |
| US-7.4 | Owner       | Être notifié quand le Reseller distribue des crédits  | Savoir quand le pool est rechargé              |
| US-7.5 | Member      | Être notifié quand je reçois des crédits              | Savoir que je peux travailler                  |
| US-7.6 | User        | Voir le nombre de notifications non lues              | Savoir si j'ai des actions à faire             |
| US-7.7 | User        | Marquer mes notifications comme lues                  | Garder une interface propre                    |
| US-7.8 | Reseller    | Être notifié quand un Owner demande des crédits       | Traiter rapidement les demandes de mes clients |

### 10.3 Règles métier

1. **Types de notifications** :

   | Type                    | Destinataire | Déclencheur                                                    |
   | ----------------------- | ------------ | -------------------------------------------------------------- |
   | `credit_request`        | Owner        | Membre crée une demande de crédits                             |
   | `owner_credit_request`  | Reseller     | Owner crée une demande de crédits                              |
   | `low_credits`           | Owner        | Pool organisation < 100 crédits                                |
   | `insufficient_refill`   | Owner        | Pool insuffisant pour prochain auto-refill (vérifié 24h avant) |
   | `reseller_distribution` | Owner        | Reseller distribue des crédits                                 |
   | `credits_received`      | Member       | Recharge ponctuelle ou automatique reçue                       |

2. **Comportement du badge** :
   - Affiche le nombre de notifications non lues
   - Disparaît quand = 0
   - Se met à jour en temps réel (polling toutes les 60 secondes)

3. **Marquage comme lu** :
   - Click sur la cloche → ouvre le panel
   - Click sur une notification individuelle → marque celle-ci comme lue
   - Bouton "Tout marquer comme lu" disponible

4. **Rétention** :
   - Notifications non lues : conservation illimitée
   - Notifications lues : supprimées après 30 jours (job CRON)

5. **Déduplication** :
   - Une notification par événement (pas de groupage)
   - Éviter les doublons : `low_credits` envoyé une seule fois jusqu'à ce que le pool remonte au-dessus du seuil

6. **Périmètre MVP** :
   - ❌ Pas d'envoi d'emails
   - ❌ Pas de notifications push
   - ✅ Notifications in-app uniquement
   - ✅ Persistance en base de données
   - ✅ Marquage comme lu

### 10.4 Spécifications techniques

#### Base de données

```sql
CREATE TABLE notifications (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  organization_id INTEGER NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  type VARCHAR(50) NOT NULL,
  title VARCHAR(255) NOT NULL,
  message TEXT NULL,
  data JSONB NULL,
  is_read BOOLEAN DEFAULT false,
  read_at TIMESTAMP NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_notifications_user_unread ON notifications(user_id, is_read) WHERE is_read = false;
CREATE INDEX idx_notifications_cleanup ON notifications(read_at) WHERE read_at IS NOT NULL;
```

#### API Endpoints

| Méthode | Endpoint                          | Description                     |
| ------- | --------------------------------- | ------------------------------- |
| `GET`   | `/api/notifications`              | Liste paginée des notifications |
| `GET`   | `/api/notifications/unread-count` | Nombre de non lues              |
| `POST`  | `/api/notifications/:id/read`     | Marquer une comme lue           |
| `POST`  | `/api/notifications/read-all`     | Marquer toutes comme lues       |

#### Modèle Notification

```typescript
// app/models/notification.ts
export default class Notification extends BaseModel {
  @column({ isPrimary: true })
  declare id: number;

  @column()
  declare userId: number;

  @column()
  declare organizationId: number;

  @column()
  declare type:
    | "credit_request"
    | "owner_credit_request"
    | "low_credits"
    | "insufficient_refill"
    | "reseller_distribution"
    | "credits_received";

  @column()
  declare title: string;

  @column()
  declare message: string | null;

  @column()
  declare data: Record<string, any> | null;

  @column()
  declare isRead: boolean;

  @column.dateTime()
  declare readAt: DateTime | null;

  @column.dateTime({ autoCreate: true })
  declare createdAt: DateTime;

  @belongsTo(() => User)
  declare user: BelongsTo<typeof User>;

  @belongsTo(() => Organization)
  declare organization: BelongsTo<typeof Organization>;
}
```

#### Service de notification

```typescript
// app/services/notification_service.ts
export default class NotificationService {
  /**
   * Crée une notification pour l'Owner de l'organisation
   */
  async createForOwner(
    organizationId: number,
    type: NotificationType,
    title: string,
    message?: string,
    data?: Record<string, any>,
  ): Promise<Notification>;

  /**
   * Crée une notification pour un utilisateur spécifique
   */
  async createForUser(
    userId: number,
    organizationId: number,
    type: NotificationType,
    title: string,
    message?: string,
    data?: Record<string, any>,
  ): Promise<Notification>;

  /**
   * Crée une notification pour le Reseller d'une organisation
   */
  async createForReseller(
    organizationId: number,
    type: NotificationType,
    title: string,
    message?: string,
    data?: Record<string, any>,
  ): Promise<Notification>;

  /**
   * Vérifie si une notification low_credits a déjà été envoyée
   * (déduplication)
   */
  async hasRecentLowCreditsNotification(
    organizationId: number,
  ): Promise<boolean>;
}
```

### 10.5 Interface utilisateur

#### Header dashboard

- Icône cloche (`UButton` avec `i-heroicons-bell`)
- Badge numérique si notifications non lues (via `UChip` ou badge CSS)
- Click → Ouvre `USlideover` avec liste des notifications

#### USlideover notifications (pattern Nuxt UI)

```vue
<USlideover v-model:open="isNotificationsOpen" title="Notifications">
  <template #header>
    <div class="flex items-center justify-between w-full">
      <span>Notifications</span>
      <UButton
        v-if="unreadCount > 0"
        variant="ghost"
        size="xs"
        @click="markAllAsRead"
      >
        Tout marquer comme lu
      </UButton>
    </div>
  </template>

  <template #body>
    <div v-if="notifications.length === 0" class="text-center text-muted py-8">
      Aucune notification
    </div>
    <NuxtLink
      v-for="notification in notifications"
      :key="notification.id"
      :to="getNotificationLink(notification)"
      class="flex items-start gap-3 p-3 hover:bg-gray-50 rounded-lg"
      @click="markAsRead(notification.id)"
    >
      <UChip color="error" :show="!notification.isRead" inset>
        <UAvatar :icon="getNotificationIcon(notification.type)" size="md" />
      </UChip>
      <div class="text-sm flex-1">
        <p class="flex items-center justify-between">
          <span class="text-highlighted font-medium">{{ notification.title }}</span>
          <time :datetime="notification.createdAt" class="text-muted text-xs">
            {{ formatTimeAgo(new Date(notification.createdAt)) }}
          </time>
        </p>
        <p v-if="notification.message" class="text-dimmed">{{ notification.message }}</p>
      </div>
    </NuxtLink>
  </template>
</USlideover>
```

#### Icônes par type de notification

| Type                    | Icône                              | Couleur   |
| ----------------------- | ---------------------------------- | --------- |
| `credit_request`        | `i-heroicons-hand-raised`          | `primary` |
| `owner_credit_request`  | `i-heroicons-building-office`      | `primary` |
| `low_credits`           | `i-heroicons-exclamation-triangle` | `warning` |
| `insufficient_refill`   | `i-heroicons-exclamation-circle`   | `error`   |
| `reseller_distribution` | `i-heroicons-arrow-down-tray`      | `success` |
| `credits_received`      | `i-heroicons-plus-circle`          | `success` |

#### Comportement et navigation

| Type                    | Action au click                                                             |
| ----------------------- | --------------------------------------------------------------------------- |
| `credit_request`        | Navigation vers `/dashboard/settings/credits` (section demandes)            |
| `owner_credit_request`  | Navigation vers `/reseller/organizations/:orgId/credits` (section demandes) |
| `low_credits`           | Navigation vers `/dashboard/credits`                                        |
| `insufficient_refill`   | Navigation vers `/dashboard/settings/credits` (section auto-refill)         |
| `reseller_distribution` | Navigation vers `/dashboard/credits`                                        |
| `credits_received`      | Navigation vers `/dashboard/credits`                                        |

#### Composable useNotifications

```typescript
// composables/useNotifications.ts
export function useNotifications() {
  const unreadCount = ref(0);
  const notifications = ref<Notification[]>([]);
  const isOpen = ref(false);

  // Polling toutes les 60 secondes
  const { pause, resume } = useIntervalFn(fetchUnreadCount, 60000);

  async function fetchUnreadCount() {
    /* ... */
  }
  async function fetchNotifications() {
    /* ... */
  }
  async function markAsRead(id: number) {
    /* ... */
  }
  async function markAllAsRead() {
    /* ... */
  }

  function getNotificationIcon(type: string): string {
    /* ... */
  }
  function getNotificationLink(notification: Notification): string {
    /* ... */
  }

  return {
    unreadCount,
    notifications,
    isOpen,
    fetchNotifications,
    markAsRead,
    markAllAsRead,
    getNotificationIcon,
    getNotificationLink,
  };
}
```

### 10.6 Critères d'acceptation

- [x] L'icône cloche s'affiche dans le header du dashboard (default.vue et reseller.vue)
- [x] Le badge affiche le bon nombre de notifications non lues
- [x] Le badge disparaît quand toutes sont lues
- [x] L'Owner reçoit une notification pour chaque demande de crédit d'un membre
- [x] Le Reseller reçoit une notification pour chaque demande de crédit d'un Owner
- [x] L'Owner reçoit une alerte quand le pool < 100 crédits
- [x] L'Owner reçoit une alerte 24h avant un auto-refill insuffisant (`node ace check:auto-refill`)
- [x] L'Owner est notifié quand le Reseller distribue des crédits
- [x] Le Member est notifié quand il reçoit des crédits
- [x] Les notifications lues sont supprimées après 30 jours (`node ace cleanup:notifications`)
- [x] La déduplication fonctionne pour `low_credits`
- [x] Le polling met à jour le compteur toutes les 60 secondes

---

## Changelog

| Date       | Version | Auteur       | Modifications                                                                                                                                                                                  |
| ---------- | ------- | ------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 2026-01-20 | 1.0     | Product Team | Création initiale                                                                                                                                                                              |
| 2026-01-20 | 1.1     | Product Team | Ajout décisions: pas de découvert crédits, pas de partage externe dossiers, historique versions illimité                                                                                       |
| 2026-01-22 | 1.2     | Product Team | Alignement auto-refill users sur comportement organizations: ajout `last_refill_at` (idempotence), `autoRefillAmount` devient une CIBLE (pas un montant fixe), ajout méthodes helper au modèle |
| 2026-01-23 | 1.3     | Product Team | Ajout Feature 7: Système de notifications in-app (alertes crédits, demandes, distributions). Seuil crédits bas = 100, rétention 30 jours après lecture, MVP sans emails/push                   |
| 2026-01-23 | 1.3     | Product Team | Feature 6: Spécification composants UEditor de Nuxt UI 4.4+ pour l'édition (UEditor, UEditorToolbar, UEditorDragHandle, etc.)                                                                  |
| 2026-01-24 | 1.3     | Product Team | Feature 6: Transcription en lecture seule (seule l'analyse est éditable), critères d'acceptation validés                                                                                       |
| 2026-01-26 | 1.3     | Product Team | Feature 7: Ajout notification `owner_credit_request` pour les Resellers quand un Owner demande des crédits                                                                                     |
