# PRD: Améliorations du Dashboard Reseller

**Version**: 1.2
**Date**: 17 janvier 2026
**Auteur**: DH-Echo Product Team
**Statut**: Draft

---

## 1. Vue d'ensemble

### 1.1 Contexte

Le dashboard reseller permet actuellement aux partenaires revendeurs de gérer leurs organisations clientes : création, gestion des utilisateurs et distribution de crédits. Plusieurs améliorations sont nécessaires pour offrir plus de flexibilité commerciale et une meilleure expérience de gestion.

### 1.2 Objectifs

- Permettre aux resellers de proposer des abonnements mensuels avec recharge automatique de crédits
- Donner plus de contrôle sur le cycle de vie des organisations (suspension, suppression)
- Améliorer la gestion des invitations avec possibilité de renvoi
- Alerter visuellement sur les organisations en manque de crédits
- Catégoriser les organisations par secteur d'activité pour un meilleur suivi

### 1.3 Utilisateurs cibles

| Persona            | Besoins                                                      |
| ------------------ | ------------------------------------------------------------ |
| **Reseller Admin** | Gérer efficacement son portefeuille d'organisations clientes |
| **Super Admin**    | Avoir une visibilité sur les configurations d'abonnement     |

---

## 2. Feature 1: Recharge mensuelle de crédits (Abonnement)

### 2.1 Description

Permettre aux resellers de configurer une recharge automatique mensuelle de crédits pour une organisation, comme alternative au système de crédits à la carte.

### 2.2 User Stories

| ID     | En tant que    | Je veux                                                                      | Afin de                                                    |
| ------ | -------------- | ---------------------------------------------------------------------------- | ---------------------------------------------------------- |
| US-1.1 | Reseller Admin | Configurer un abonnement mensuel pour une organisation                       | Proposer un modèle économique récurrent à mes clients      |
| US-1.2 | Reseller Admin | Définir le montant de crédits rechargés chaque mois                          | Adapter l'offre aux besoins du client                      |
| US-1.3 | Reseller Admin | Activer/désactiver l'abonnement à tout moment                                | Gérer le cycle de vie de l'abonnement                      |
| US-1.4 | Reseller Admin | Voir la date de prochaine recharge                                           | Anticiper les besoins en crédits                           |
| US-1.5 | Reseller Admin | Voir le montant qui sera rechargé (différence entre plafond et solde actuel) | Anticiper les besoins en crédits de mon pool               |
| US-1.6 | Reseller Admin | Basculer librement entre abonnement et achat ponctuel                        | Adapter le mode de facturation selon l'évolution du client |

### 2.3 Règles métier

1. **Source des crédits** : Les crédits sont prélevés du pool du reseller (`reseller.creditBalance`)
2. **Logique de recharge (top-up)** :
   - Le système ramène le solde de l'organisation au montant configuré
   - Seule la différence est déduite du pool reseller
   - **Exemple** : Organisation a 100 crédits, abonnement = 1000 → recharge de 900 crédits, reseller débité de 900
   - **Exemple** : Organisation a 1200 crédits, abonnement = 1000 → aucune recharge (solde déjà supérieur)
3. **Condition de recharge** : Si le reseller n'a pas assez de crédits pour le top-up, la recharge échoue et une notification est envoyée
4. **Prévention insuffisance pool** : Le dashboard affiche une alerte si le pool du reseller ne couvre pas la somme des prochains top-ups estimés
5. **Date de recharge** : Configurable (1er du mois, date anniversaire de création, etc.)
6. **Changement de mode libre** : Le reseller peut basculer à tout moment entre abonnement et achat ponctuel :
   - Passage abonnement → ponctuel : désactivation immédiate, crédits restants conservés
   - Passage ponctuel → abonnement : activation immédiate, première recharge à la prochaine date configurée
   - Aucune restriction ni pénalité, modification effective immédiatement
7. **Historique** : Chaque recharge génère une transaction dans `credit_transactions` et `reseller_transactions` avec le montant réellement distribué

### 2.4 Critères d'acceptation

- [x] Le reseller peut activer un abonnement mensuel sur une organisation
- [x] Les crédits sont automatiquement distribués à la date configurée
- [ ] Le reseller reçoit une notification si la recharge échoue (crédits insuffisants)
- [x] L'historique des recharges automatiques est visible dans les transactions
- [x] Le reseller peut modifier ou désactiver l'abonnement à tout moment
- [x] **Le reseller peut basculer librement entre abonnement et achat ponctuel sans restriction**
- [x] **Une alerte s'affiche sur le dashboard si le pool est insuffisant pour couvrir les prochains top-ups**
- [x] **Les organisations avec abonnement actif sont visuellement distinctes de celles en achat ponctuel**

---

## 3. Feature 2: Gestion du statut des organisations

### 3.1 Description

Permettre aux resellers de suspendre temporairement ou supprimer définitivement une organisation.

### 3.2 User Stories

| ID     | En tant que    | Je veux                               | Afin de                                        |
| ------ | -------------- | ------------------------------------- | ---------------------------------------------- |
| US-2.1 | Reseller Admin | Suspendre une organisation            | Bloquer temporairement l'accès en cas d'impayé |
| US-2.2 | Reseller Admin | Réactiver une organisation suspendue  | Rétablir l'accès après régularisation          |
| US-2.3 | Reseller Admin | Supprimer une organisation            | Clôturer définitivement un compte client       |
| US-2.4 | Reseller Admin | Voir le statut de chaque organisation | Avoir une vue claire de mon portefeuille       |

### 3.3 Règles métier

1. **Statuts disponibles** :
   - `active` : Accès normal
   - `suspended` : Accès bloqué, données conservées, crédits gelés
   - `deleted` : Soft delete, données conservées 30 jours puis purgées

2. **Conséquences de la suspension** :
   - Les utilisateurs ne peuvent plus se connecter (middleware bloquant)
   - Les audios ne peuvent plus être traités
   - Les crédits ne sont pas consommés
   - Les abonnements mensuels sont pausés

3. **Conséquences de la suppression** :
   - Soft delete immédiat (champ `deletedAt`)
   - Les utilisateurs perdent l'accès à cette organisation
   - Purge automatique après 30 jours (RGPD)
   - Les crédits restants sont perdus (non remboursables)

4. **Confirmation requise** : Suppression nécessite une double confirmation

### 3.4 Spécifications techniques

#### Base de données

```sql
-- Modification table organizations
ALTER TABLE organizations
  ADD COLUMN status VARCHAR(20) DEFAULT 'active', -- 'active' | 'suspended' | 'deleted'
  ADD COLUMN deleted_at TIMESTAMP NULL;
```

#### API Endpoints

| Méthode  | Endpoint                                  | Description                            |
| -------- | ----------------------------------------- | -------------------------------------- |
| `POST`   | `/api/reseller/organizations/:id/suspend` | Suspendre l'organisation               |
| `POST`   | `/api/reseller/organizations/:id/restore` | Réactiver l'organisation               |
| `DELETE` | `/api/reseller/organizations/:id`         | Supprimer l'organisation (soft delete) |

#### Middleware

Modifier `auth_middleware.ts` pour vérifier le statut de l'organisation courante :

```typescript
if (user.currentOrganization?.status === "suspended") {
  return response.forbidden({ error: "ORGANIZATION_SUSPENDED" });
}
```

### 3.5 Interface utilisateur

**Liste des organisations** (`/reseller/organizations`)

- Badge de statut coloré : 🟢 Active | 🟡 Suspendue | 🔴 Supprimée
- Actions contextuelles selon le statut

**Page détail organisation** (`/reseller/organizations/[id]`)

- Section "Gestion du statut"
- Bouton "Suspendre" (avec confirmation)
- Bouton "Réactiver" (si suspendue)
- Bouton "Supprimer" (avec double confirmation et avertissement)

### 3.6 Critères d'acceptation

- [x] Le reseller peut suspendre une organisation active
- [x] Les utilisateurs d'une organisation suspendue ne peuvent plus accéder au service
- [x] Le reseller peut réactiver une organisation suspendue
- [x] Le reseller peut supprimer une organisation (soft delete)
- [x] Un message d'avertissement clair est affiché avant suppression
- [x] Le statut est visible sur la liste et le détail des organisations

---

## 4. Feature 3: Renvoi de lien d'invitation

### 4.1 Description

Permettre aux resellers de renvoyer un lien d'invitation à un utilisateur qui n'a pas encore activé son compte.

### 4.2 User Stories

| ID     | En tant que    | Je veux                                              | Afin de                                                   |
| ------ | -------------- | ---------------------------------------------------- | --------------------------------------------------------- |
| US-3.1 | Reseller Admin | Voir quels utilisateurs n'ont pas activé leur compte | Identifier les comptes en attente                         |
| US-3.2 | Reseller Admin | Renvoyer le lien d'invitation                        | Relancer un utilisateur qui n'a pas reçu ou perdu l'email |
| US-3.3 | Reseller Admin | Voir la date du dernier envoi                        | Éviter de spammer l'utilisateur                           |

### 4.3 Règles métier

1. **Éligibilité** : Seuls les utilisateurs sans `emailVerifiedAt` peuvent recevoir un renvoi
2. **Rate limiting** : Maximum 1 renvoi par 5 minutes par utilisateur
3. **Expiration** : Le nouveau magic link a une validité de 7 jours
4. **Notification** : Le même template email est utilisé avec un nouveau token

### 4.4 Spécifications techniques

#### Base de données

```sql
-- Modification table users (optionnel, pour tracking)
ALTER TABLE users
  ADD COLUMN last_invitation_sent_at TIMESTAMP NULL;
```

#### API Endpoints

| Méthode | Endpoint                                                             | Description      |
| ------- | -------------------------------------------------------------------- | ---------------- |
| `POST`  | `/api/reseller/organizations/:orgId/users/:userId/resend-invitation` | Renvoyer le lien |

#### Logique

```typescript
// 1. Vérifier que l'utilisateur existe et appartient à l'organisation
// 2. Vérifier que emailVerifiedAt est null
// 3. Vérifier le rate limit (last_invitation_sent_at > 5 min)
// 4. Générer un nouveau magic link token
// 5. Envoyer l'email
// 6. Mettre à jour last_invitation_sent_at
```

### 4.5 Interface utilisateur

**Liste des utilisateurs** (`/reseller/organizations/[id]/users`)

- Badge "En attente" pour les comptes non vérifiés
- Bouton "Renvoyer l'invitation" (icône refresh)
- Tooltip indiquant la date du dernier envoi
- Bouton désactivé si rate limit actif (avec countdown)

### 4.6 Critères d'acceptation

- [x] Le reseller peut renvoyer une invitation à un utilisateur non vérifié
- [x] Le rate limit de 5 minutes est respecté
- [x] L'utilisateur reçoit un nouvel email avec un lien valide
- [x] Le statut "En attente" est visible sur la liste des utilisateurs
- [x] La date du dernier envoi est affichée

---

## 5. Feature 4: Alertes de crédits bas

### 5.1 Description

Mettre en évidence visuellement les organisations avec un solde de crédits bas et optionnellement envoyer des notifications.

### 5.2 User Stories

| ID     | En tant que    | Je veux                                                      | Afin de                                 |
| ------ | -------------- | ------------------------------------------------------------ | --------------------------------------- |
| US-4.1 | Reseller Admin | Voir rapidement quelles organisations manquent de crédits    | Prioriser mes actions commerciales      |
| US-4.2 | Reseller Admin | Définir mon seuil d'alerte personnalisé                      | Adapter selon mon business model        |
| US-4.3 | Reseller Admin | Recevoir un email quand une organisation passe sous le seuil | Être alerté sans consulter le dashboard |

### 5.3 Règles métier

1. **Seuil par défaut** : 50 crédits (configurable par reseller)
2. **Indicateurs visuels** :
   - 🟢 Normal : crédits > seuil × 2
   - 🟡 Attention : seuil < crédits ≤ seuil × 2
   - 🔴 Critique : crédits ≤ seuil
   - ⚫ Vide : crédits = 0

3. **Notifications email** (optionnel) :
   - Envoyé une seule fois quand le seuil est franchi
   - Reset si les crédits repassent au-dessus du seuil × 2

### 5.4 Spécifications techniques

#### Base de données

```sql
-- Modification table resellers (préférences)
ALTER TABLE resellers
  ADD COLUMN low_credit_threshold INTEGER DEFAULT 50,
  ADD COLUMN low_credit_notifications BOOLEAN DEFAULT true;

-- Modification table organizations (tracking notifications)
ALTER TABLE organizations
  ADD COLUMN low_credit_notified_at TIMESTAMP NULL;
```

#### API Endpoints

| Méthode | Endpoint                                     | Description                     |
| ------- | -------------------------------------------- | ------------------------------- |
| `GET`   | `/api/reseller/organizations?lowCredit=true` | Filtrer organisations en alerte |
| `PUT`   | `/api/reseller/profile`                      | Modifier le seuil d'alerte      |

### 5.5 Interface utilisateur

**Dashboard reseller** (`/reseller`)

- Widget "Organisations en alerte" avec count et liste rapide
- Lien vers la liste filtrée
- **⚠️ Alerte "Pool insuffisant"** : Avertissement si le pool de crédits du reseller est insuffisant pour couvrir toutes les prochaines recharges d'abonnement (somme des top-ups prévus > creditBalance)

**Liste des organisations** (`/reseller/organizations`)

- Badge coloré indiquant le niveau de crédits
- **Badge type de facturation** : Icône distincte pour différencier :
  - 🔄 **Abonnement** : Organisation avec recharge mensuelle active
  - 💳 **Achat ponctuel** : Organisation sans abonnement (crédits à la carte)
- Filtre rapide "Crédits bas"
- Filtre par type de facturation (Abonnement / Achat ponctuel)
- Tri par crédits (croissant par défaut pour voir les urgences)

**Page profil reseller** (`/reseller/profile`)

- Input "Seuil d'alerte crédits"
- Toggle "Recevoir les notifications par email"

### 5.6 Critères d'acceptation

- [ ] Les organisations avec peu de crédits sont visuellement identifiables
- [ ] Le dashboard affiche un widget récapitulatif des alertes
- [ ] **Le dashboard affiche une alerte si le pool reseller est insuffisant pour les prochaines recharges d'abonnement**
- [ ] Le reseller peut filtrer les organisations par niveau de crédits
- [ ] **Le reseller peut filtrer les organisations par type de facturation (abonnement/ponctuel)**
- [ ] **Les organisations en abonnement et en achat ponctuel sont visuellement différenciées (badges)**
- [ ] Le seuil d'alerte est personnalisable
- [ ] Les notifications email fonctionnent si activées

---

## 6. Feature 5: Sélection du secteur d'activité

### 6.1 Description

Permettre de catégoriser les organisations par secteur d'activité lors de la création, avec possibilité de sélectionner plusieurs secteurs.

### 6.2 User Stories

| ID     | En tant que    | Je veux                                                | Afin de                   |
| ------ | -------------- | ------------------------------------------------------ | ------------------------- |
| US-5.1 | Reseller Admin | Sélectionner le(s) secteur(s) d'activité à la création | Catégoriser mes clients   |
| US-5.2 | Reseller Admin | Modifier les secteurs d'une organisation existante     | Corriger ou mettre à jour |
| US-5.3 | Reseller Admin | Filtrer mes organisations par secteur                  | Analyser mon portefeuille |
| US-5.4 | Super Admin    | Voir la répartition des organisations par secteur      | Analyser le marché        |

### 6.3 Secteurs d'activité disponibles

| Code         | Libellé FR                   | Libellé EN           |
| ------------ | ---------------------------- | -------------------- |
| `psychology` | Psychologie et Thérapie      | Psychology & Therapy |
| `finance`    | Finance et Comptabilité      | Finance & Accounting |
| `legal`      | Droit et Affaires juridiques | Law & Legal Affairs  |
| `sales`      | Vente et Commerce            | Sales & Commerce     |
| `hr`         | Ressources humaines          | Human Resources      |

> **Note** : Liste extensible via configuration ou table dédiée dans le futur.

### 6.4 Règles métier

1. **Multi-sélection** : Une organisation peut appartenir à plusieurs secteurs
2. **Optionnel** : Le secteur n'est pas obligatoire à la création
3. **Templates associés** : Les templates de documents pourront être filtrés par secteur (future feature)

### 6.5 Spécifications techniques

#### Base de données

```sql
-- Modification table organizations
ALTER TABLE organizations
  ADD COLUMN business_sectors JSONB DEFAULT '[]';

-- Exemple de valeur: ["psychology", "hr"]
```

#### API Endpoints

Modification des endpoints existants :

| Méthode | Endpoint                          | Modification                              |
| ------- | --------------------------------- | ----------------------------------------- |
| `POST`  | `/api/reseller/organizations`     | Ajouter champ `businessSectors: string[]` |
| `PUT`   | `/api/reseller/organizations/:id` | Ajouter champ `businessSectors: string[]` |
| `GET`   | `/api/reseller/organizations`     | Ajouter filtre `?sector=psychology,legal` |

### 6.6 Interface utilisateur

**Création d'organisation** (`/reseller/organizations/create`)

- Étape 1 : Ajouter section "Secteur(s) d'activité"
- Composant multi-select avec chips (tags)
- Affichage des secteurs sélectionnés

**Page détail organisation** (`/reseller/organizations/[id]`)

- Affichage des secteurs sous forme de badges
- Éditable dans les paramètres

**Liste des organisations** (`/reseller/organizations`)

- Colonne "Secteurs" avec badges
- Filtre par secteur (multi-sélection)

### 6.7 Critères d'acceptation

- [ ] Le reseller peut sélectionner 0, 1 ou plusieurs secteurs à la création
- [ ] Les secteurs sont modifiables après création
- [ ] Les secteurs s'affichent sur la liste et le détail
- [ ] Le filtre par secteur fonctionne sur la liste

---

## 7. Priorités et dépendances

### 7.1 Ordre de priorité suggéré

| Priorité | Feature                            | Justification                                   |
| -------- | ---------------------------------- | ----------------------------------------------- |
| 🔴 P1    | Gestion du statut (suspend/delete) | Critique pour la gestion du cycle de vie client |
| 🔴 P1    | Alertes crédits bas                | Quick win, forte valeur business                |
| 🟡 P2    | Renvoi d'invitation                | Améliore l'onboarding, peu d'effort             |
| 🟡 P2    | Secteur d'activité                 | Structure les données pour le futur             |
| 🟢 P3    | Abonnement mensuel                 | Plus complexe, nécessite job CRON               |

### 7.2 Dépendances techniques

```
┌─────────────────────────────────────────────────────────────┐
│                    Modifications de base                     │
│  - Migration: ajouter status, businessSectors à Organization │
│  - Migration: créer table organization_subscriptions         │
│  - Modifier OrganizationPolicy pour status                   │
└─────────────────────────────────────────────────────────────┘
                              │
        ┌─────────────────────┼─────────────────────┐
        ▼                     ▼                     ▼
┌───────────────┐   ┌───────────────────┐   ┌───────────────┐
│ Feature 2:    │   │ Feature 5:        │   │ Feature 4:    │
│ Status        │   │ Secteurs          │   │ Alertes       │
│ (indépendant) │   │ (indépendant)     │   │ (indépendant) │
└───────────────┘   └───────────────────┘   └───────────────┘
        │
        ▼
┌───────────────────────────────────────────────────────────┐
│ Feature 1: Abonnement mensuel                              │
│ (dépend du status pour suspendre les recharges)           │
└───────────────────────────────────────────────────────────┘

┌───────────────────────────────────────────────────────────┐
│ Feature 3: Renvoi invitation                               │
│ (indépendant, peut être fait à tout moment)               │
└───────────────────────────────────────────────────────────┘
```

### 7.3 Estimation d'effort

| Feature             | Backend | Frontend | Total estimé |
| ------------------- | ------- | -------- | ------------ |
| Abonnement mensuel  | Moyen   | Moyen    | 3-4 jours    |
| Gestion statut      | Faible  | Moyen    | 2 jours      |
| Renvoi invitation   | Faible  | Faible   | 0.5 jour     |
| Alertes crédits     | Faible  | Moyen    | 1.5 jour     |
| Secteurs d'activité | Faible  | Faible   | 1 jour       |

---

## 8. Annexes

### 8.1 Maquettes UI (à créer)

- [ ] Dashboard reseller avec widget alertes
- [ ] Liste organisations avec badges status/crédits/secteurs
- [ ] Modal configuration abonnement
- [ ] Modal confirmation suppression
- [ ] Multi-select secteurs d'activité

### 8.2 Questions ouvertes

1. **Abonnement** : Doit-on permettre des paliers de crédits prédéfinis (100/500/1000) ou un montant libre ?
2. **Suppression** : Faut-il permettre au reseller de récupérer les crédits non utilisés avant suppression ?
3. **Secteurs** : La liste doit-elle être configurable par le Super Admin ou figée ?
4. **Alertes** : Faut-il des seuils différents par organisation ou un seuil global par reseller ?
5. **Prévention pool insuffisant** : Doit-on bloquer la création de nouveaux abonnements si le pool est déjà insuffisant, ou simplement avertir ?

### 8.3 Risques identifiés

| Risque                                               | Impact | Mitigation                                               |
| ---------------------------------------------------- | ------ | -------------------------------------------------------- |
| Job CRON de recharge échoue silencieusement          | Élevé  | Monitoring + alertes admin                               |
| Suppression accidentelle d'organisation              | Élevé  | Double confirmation + période de grâce 30j               |
| Spam d'invitations                                   | Moyen  | Rate limiting strict                                     |
| Pool insuffisant pour recharger tous les abonnements | Élevé  | Alerte préventive sur dashboard + notification anticipée |

---

## Changelog

| Date       | Version | Auteur       | Modifications                                                        |
| ---------- | ------- | ------------ | -------------------------------------------------------------------- |
| 2026-01-17 | 1.0     | Product Team | Création initiale                                                    |
| 2026-01-17 | 1.1     | Product Team | Ajout indicateur visuel abonnement/ponctuel, alerte pool insuffisant |
| 2026-01-17 | 1.2     | Product Team | Précision sur le changement libre de mode (abonnement ↔ ponctuel)    |
