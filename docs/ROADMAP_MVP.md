# Roadmap MVP Alexia - Audio vers Documents Structurés

> **Dernière mise à jour**: 21 Décembre 2025
> **Durée estimée**: 6-8 semaines

## Vue d'ensemble

### Ce qui existe déjà (fondations solides)
- **Auth complète**: Magic links, OAuth Google, vérification email
- **Multi-tenant**: Isolation par organisation, switch entre orgas
- **RBAC**: 3 rôles (Owner, Admin, Member) avec policies
- **Billing**: Lemon Squeezy, trial 14 jours, gestion abonnements
- **i18n**: Français + Anglais avec détection auto
- **Dashboard**: Layout, navigation, settings, membres
- ✅ **Infrastructure Audio**: Storage local, queue Redis/BullMQ, service Mistral

### Ce qu'il faut construire (coeur MVP)
1. **Atelier Audio** - Upload/enregistrement
2. **Transcription IA** - Voxtral Small (Mistral AI)
3. **Templates** - Modèles de documents métier
4. **Transformation** - Audio → Document structuré
5. **Export** - PDF/Word

---

## Stack Technique

| Composant | Technologie | Notes |
|-----------|-------------|-------|
| **Transcription** | Voxtral Small (Mistral AI) | Européen, excellent FR, GDPR-friendly, via `chat.complete` |
| **Analyse** | Mistral Large | Transformation transcription → document structuré |
| **Stockage** | @adonisjs/drive (Local) | MVP: local, Prod: R2/S3 via driver swap |
| **Queue** | Redis + BullMQ | Traitement asynchrone avec retry/backoff |
| **PDF** | Puppeteer ou pdfmake | HTML → PDF |
| **Word** | docx npm | Génération .docx |

## Décisions MVP

- **Transcription**: Voxtral Small via `chat.complete` avec audio base64 (l'endpoint `/transcriptions` ne supporte que Voxtral Mini Transcribe)
- **Diarization**: ❌ Non disponible actuellement - Mistral annonce "Coming soon" pour speaker identification
- **Stockage**: @adonisjs/drive avec driver local (dev), migration R2/S3 en production via config
- **Templates**: Uniquement prédéfinis (Médical, Juridique, Commercial, Général)
- **Trial**: Limité à 3 audios, 30 min max par audio
- **Processing**: Asynchrone avec queue BullMQ + Redis

---

## Phase 1: Infrastructure Audio (Semaine 1-2)

### 1.1 Configuration Services ✅ COMPLÉTÉ
**Backend**
- [x] Créer dossier `storage/uploads/audios` + `storage/uploads/documents`
- [x] Créer compte Mistral AI + API key (console.mistral.ai)
- [x] Configurer variables d'env: `MISTRAL_API_KEY`, `REDIS_HOST`, `REDIS_PORT`, `DRIVE_DISK`
- [x] Setup Redis local (dev) + config BullMQ queue

**Fichiers créés**:
```
backend/.env.example                  # Variables d'environnement template
backend/config/drive.ts               # Config @adonisjs/drive (local storage)
backend/config/queue.ts               # Config BullMQ/Redis
backend/app/services/storage_service.ts   # Service stockage fichiers
backend/app/services/queue_service.ts     # Service queue jobs
backend/app/services/mistral_service.ts   # Service Voxtral Small + Mistral Large
backend/app/jobs/transcription_job.ts     # Worker job transcription
backend/start/worker.ts               # Preload worker BullMQ
backend/app/controllers/audio_controller.ts  # Controller API audio
```

**Routes API créées**:
```
POST /audio/process          # Upload + lance transcription async
GET  /audio/status/:jobId    # Polling statut job
```

**Dépendances ajoutées**:
- `@adonisjs/drive` - Abstraction stockage fichiers
- `bullmq` - Queue management
- `ioredis` - Client Redis

### 1.2 Modèles de Données ✅ COMPLÉTÉ
**Migrations créées**:
```
backend/database/migrations/1765500000001_create_audios_table.ts
backend/database/migrations/1765500000002_create_transcriptions_table.ts
backend/database/migrations/1765500000003_create_templates_table.ts
backend/database/migrations/1765500000004_create_documents_table.ts
```

**Modèles créés**:
```
backend/app/models/audio.ts         # AudioStatus enum, relations, helpers
backend/app/models/transcription.ts # TranscriptionTimestamp interface
backend/app/models/template.ts      # TemplateCategory enum, TemplateSchema interface
backend/app/models/document.ts      # DocumentStatus, DocumentFormat enums
```

**Schéma des tables**:
- `audios`: organization_id, user_id, title, file_name, file_path, file_size, mime_type, duration, status, error_message
- `transcriptions`: audio_id (unique), raw_text, language, timestamps (JSONB), confidence
- `templates`: organization_id (nullable=système), name, description, category, schema (JSONB), is_default, created_by
- `documents`: audio_id, transcription_id, template_id (nullable), title, content (JSONB), status, file_path, format

**Enums TypeScript**:
- `AudioStatus`: pending, processing, completed, failed
- `TemplateCategory`: medical, legal, commercial, general
- `DocumentStatus`: draft, completed, exported
- `DocumentFormat`: pdf, docx

### 1.3 Service de Stockage Local ✅ COMPLÉTÉ (Phase 1.1)
**Fichier créé**: `backend/app/services/storage_service.ts`

**Méthodes implémentées**:
- `storeAudioFile(file, organizationId)` - Upload audio avec scoping multi-tenant
- `storeDocumentFile(content, fileName, organizationId)` - Upload documents
- `getFileBuffer(path)` - Download fichier en Buffer
- `getFileStream(path)` - Download fichier en Stream
- `deleteFile(path)` - Suppression fichier
- `getSignedUrl(path, expiresIn)` - URL signée temporaire
- `fileExists(path)` - Vérification existence

---

## Phase 2: Upload Audio (Semaine 2-3) ✅ COMPLÉTÉ

### 2.1 API Upload ✅ COMPLÉTÉ

**Routes API implémentées**:
```
✅ POST /audio/process           # Upload + lance transcription async + sauvegarde BDD
✅ GET  /audio/status/:jobId     # Polling statut job
✅ GET  /audios                  # Liste paginée des audios (org scope)
✅ GET  /audios/:id              # Détails audio + transcription
✅ DELETE /audios/:id            # Supprimer audio + fichier
```

**Fichiers créés/modifiés**:
```
✅ backend/app/controllers/audios_controller.ts  # CRUD complet (index, show, destroy)
✅ backend/app/policies/audio_policy.ts          # Autorisation multi-tenant
✅ backend/app/controllers/audio_controller.ts   # Modifié: sauvegarde Audio en BDD
✅ backend/app/jobs/transcription_job.ts         # Modifié: sauvegarde Transcription en BDD
✅ backend/app/services/queue_service.ts         # Modifié: ajout audioId dans job data
✅ backend/app/validators/audio.ts               # Ajout audioIndexValidator (pagination)
✅ backend/app/models/audio.ts                   # Ajout table = 'audios'
✅ backend/resources/lang/fr/messages.json       # Messages audio (not_found, deleted, etc.)
✅ backend/resources/lang/en/messages.json       # Traductions anglaises
✅ backend/start/routes.ts                       # Nouvelles routes CRUD
```

**Tests Bruno créés**:
```
✅ backend/tests/api/alexia/audio/ListAudios.bru
✅ backend/tests/api/alexia/audio/ListAudiosWithFilter.bru
✅ backend/tests/api/alexia/audio/GetAudio.bru
✅ backend/tests/api/alexia/audio/GetAudio-NotFound.bru
✅ backend/tests/api/alexia/audio/DeleteAudio.bru
✅ backend/tests/api/alexia/audio/DeleteAudio-NotFound.bru
✅ backend/tests/api/alexia/audio/ProcessAudio.bru  # Mis à jour: capture audioId
```

**Flow complet implémenté**:
1. ✅ Upload audio via POST /audio/process
2. ✅ Stockage fichier via StorageService
3. ✅ Création Audio en BDD (status: pending)
4. ✅ Ajout job queue avec audioId
5. ✅ Worker met à jour status → processing
6. ✅ Transcription Voxtral Small → sauvegarde Transcription en BDD
7. ✅ Analyse Mistral Large → retour dans job result
8. ✅ Worker met à jour status → completed/failed
9. ✅ CRUD audios avec isolation multi-tenant

**Validation** (déjà configurée):
- Formats acceptés: MP3, WAV, M4A, OGG, FLAC
- Taille max: 25MB (configurable)

### 2.2 Frontend Upload ✅ COMPLÉTÉ

**Pages créées**:
```
✅ frontend/app/pages/dashboard/workshop/index.vue    # Page principale
✅ frontend/app/pages/dashboard/workshop/[id].vue     # Détail audio
```

**Composants créés**:
```
frontend/app/components/workshop/
  ✅ AudioUploadZone.vue           # Drag & drop
  ✅ AudioRecorder.vue             # Enregistrement micro
  ✅ AudioList.vue                 # Liste des audios
  ✅ AudioCard.vue                 # Carte audio individuelle
  ✅ AudioPlayer.vue               # Lecteur audio
  ✅ ProcessingStatus.vue          # Statut traitement
  ✅ AudioDeleteModal.vue          # Modal de confirmation suppression
  ✅ EmptyState.vue                # État vide de la liste
```

**Composables créés**:
```
✅ frontend/app/composables/useAudioUpload.ts
✅ frontend/app/composables/useAudioRecorder.ts
✅ frontend/app/composables/useAudioPolling.ts    # Polling statut transcription
✅ frontend/app/composables/useMarkdown.ts        # Rendu markdown des analyses
✅ frontend/app/stores/audio.ts
✅ frontend/app/types/audio.ts
```

**Autres modifications**:
```
✅ frontend/app/layouts/default.vue     # Navigation Atelier ajoutée
✅ frontend/i18n/locales/fr.json        # Traductions FR
✅ frontend/i18n/locales/en.json        # Traductions EN
✅ frontend/app/assets/css/main.css     # Styles additionnels
```

**Backend - Amélioration analyse**:
```
✅ backend/database/migrations/1766270576042_add_analysis_to_transcriptions_table.ts
✅ backend/app/models/transcription.ts  # Champ analysis ajouté
✅ backend/app/jobs/transcription_job.ts # Sauvegarde analyse en BDD
✅ backend/app/controllers/audios_controller.ts # Retourne analyse
```

---

## Phase 3: Transcription IA (Semaine 3-4)

### 3.1 Service Mistral AI ✅ PARTIELLEMENT COMPLÉTÉ
**Fichier créé**: `backend/app/services/mistral_service.ts`

**Méthodes implémentées**:
```typescript
transcribe(filePath, fileName): Promise<string>   // ✅ Voxtral Small via chat.complete
analyze(transcription, prompt): Promise<string>   // ✅ Mistral Large
```

**Détails techniques**:
- **Modèle transcription**: `voxtral-small-latest` via endpoint `chat.complete` (pas `/transcriptions`)
- **Format audio**: Base64 encodé avec `type: "input_audio"`
- **Temperature**: 0.0 pour transcription (recommandé par Mistral)
- **Modèle analyse**: `mistral-large-latest` pour transformation

**Limitations actuelles**:
- ❌ **Diarization non disponible** - Speaker identification "Coming soon" selon Mistral
- ⚠️ Durée max audio: ~20 min pour chat avec audio
- Alternative future: Intégrer Pyannote pour diarization si besoin

**Avantages Voxtral Small**:
- Modèle européen (conformité GDPR)
- Excellent support français natif
- Contexte 32k tokens
- $0.004/min audio

### 3.2 Queue de Transcription ✅ PARTIELLEMENT COMPLÉTÉ
**Fichiers créés**:
```
backend/app/jobs/transcription_job.ts    ✅ Worker processor avec progress
backend/app/services/queue_service.ts    ✅ Service gestion queue
backend/start/worker.ts                  ✅ Preload worker BullMQ
```

**Fichiers à créer**:
```
backend/app/listeners/audio_uploaded.ts  # Event listener (optionnel)
```

**Flow implémenté**:
1. ✅ Upload audio via POST /audio/process
2. ✅ Stockage fichier via StorageService
3. ✅ Création Audio en BDD (status: pending)
4. ✅ Ajout job queue via QueueService (avec audioId)
5. ✅ Worker traite job (transcription_job.ts)
6. ✅ Mise à jour Audio status → processing
7. ✅ Appel Voxtral Small API (transcribe)
8. ✅ Sauvegarde Transcription en BDD
9. ✅ Appel Mistral Large API (analyze)
10. ✅ Mise à jour Audio status → completed/failed
11. ✅ Progress tracking (0-100%)
12. ⬜ (Optionnel) Email notification

### 3.3 Frontend Status
**Composants à modifier**:
```
frontend/app/components/workshop/ProcessingStatus.vue
  - Polling status toutes les 3 secondes
  - Progress bar animée
  - États: pending, processing, completed, failed
```

---

## Phase 4: Templates Prédéfinis (Semaine 4-5)

### 4.1 Templates par Défaut (MVP)
**4 catégories avec 2 templates chacune**:

1. **Médical**
   - Compte-rendu de consultation
   - Lettre de liaison

2. **Juridique**
   - Synthèse juridique
   - Note de réunion client

3. **Commercial**
   - Compte-rendu RDV client
   - Liste d'actions commerciales

4. **Général**
   - Compte-rendu réunion
   - Notes libres structurées

**Structure Template (JSON)**:
```json
{
  "name": "Compte-rendu Médical",
  "category": "medical",
  "sections": [
    {"id": "patient", "label": "Informations Patient", "type": "text"},
    {"id": "motif", "label": "Motif de consultation", "type": "text"},
    {"id": "examen", "label": "Examen clinique", "type": "textarea"},
    {"id": "diagnostic", "label": "Diagnostic", "type": "text"},
    {"id": "traitement", "label": "Traitement proposé", "type": "list"},
    {"id": "suivi", "label": "Suivi recommandé", "type": "text"}
  ]
}
```

### 4.2 API Templates (lecture seule MVP)
**Endpoints**:
```
GET /api/templates             # Liste templates prédéfinis
GET /api/templates/:id         # Détail template
```

**Fichiers à créer**:
```
backend/app/controllers/templates_controller.ts
backend/app/models/template.ts
backend/database/seeders/default_templates_seeder.ts
```

### 4.3 Frontend Sélection Template
**Pas de page dédiée** - Intégré dans le workflow de transformation

**Composant à créer**:
```
frontend/app/components/workshop/TemplateSelector.vue
  - Grille de templates par catégorie
  - Preview du template sélectionné
  - Description des sections
```

---

## Phase 5: Transformation (Semaine 5-6)

### 5.1 Service de Transformation IA
**Fichiers à créer**:
```
backend/app/services/transformation_service.ts
  - transform(transcription, template): Promise<Document>
  - extractSections(text, schema): Promise<SectionData>
```

**Logique**:
1. Prendre transcription brute
2. Appliquer template sélectionné
3. Utiliser LLM pour extraire/structurer sections
4. Générer document structuré

**Prompt Engineering**:
```
Tu es un assistant de rédaction professionnelle.
Transcription: {transcription}
Template: {template_schema}
Génère un document structuré selon le template fourni.
Extrais les informations pertinentes de la transcription.
```

### 5.2 API Transformation
**Endpoints à créer**:
```
POST   /api/audios/:id/transform       # Lancer transformation
  body: { templateId: number }
GET    /api/audios/:id/transform/status
GET    /api/documents/:id              # Récupérer document généré
```

### 5.3 Frontend Transformation
**Page à modifier**:
```
frontend/app/pages/dashboard/workshop/[id].vue
  - Sélecteur de template
  - Bouton "Transformer"
  - Affichage résultat
  - Édition manuelle possible
```

**Composants à créer**:
```
frontend/app/components/workshop/
  - TemplateSelector.vue
  - TransformButton.vue
  - DocumentEditor.vue           # Édition du résultat
  - DocumentPreview.vue
```

---

## Phase 6: Export Documents (Semaine 6-7)

### 6.1 Génération PDF
**Fichiers à créer**:
```
backend/app/services/pdf_service.ts
  - generate(document, template): Promise<Buffer>
```

**Technologies**:
- Puppeteer pour rendu HTML → PDF
- Template Edge.js pour mise en page
- Styles CSS professionnels

### 6.2 Génération Word
**Fichiers à créer**:
```
backend/app/services/docx_service.ts
  - generate(document, template): Promise<Buffer>
```

**Technologies**:
- Package `docx` npm
- Styles Word professionnels
- Métadonnées document

### 6.3 API Export
**Endpoints à créer**:
```
GET /api/documents/:id/export?format=pdf
GET /api/documents/:id/export?format=docx
```

### 6.4 Frontend Export
**Composants à créer**:
```
frontend/app/components/workshop/
  - ExportButton.vue
  - ExportFormatModal.vue
```

---

## Phase 7: Bibliothèque Documents (Semaine 7)

### 7.1 API Documents
**Endpoints à créer**:
```
GET    /api/documents             # Liste documents (orga)
DELETE /api/documents/:id         # Supprimer document
```

### 7.2 Frontend Bibliothèque
**Pages à créer**:
```
frontend/app/pages/dashboard/documents/index.vue
frontend/app/pages/dashboard/documents/[id].vue
```

**Composants à créer**:
```
frontend/app/components/documents/
  - DocumentList.vue
  - DocumentCard.vue
  - DocumentFilters.vue          # Filtres par date, template, etc.
```

---

## Phase 8: Polish & UX (Semaine 7-8)

### 8.1 Navigation
**Modifier sidebar**:
```
frontend/app/layouts/default.vue
  - Ajouter: Atelier Audio (workshop)
  - Ajouter: Mes Documents (documents)
  - Ajouter: Templates (templates) - Owner/Admin seulement
```

### 8.2 Traductions i18n
**Fichiers à modifier**:
```
backend/resources/lang/fr/messages.json
backend/resources/lang/en/messages.json
frontend/locales/fr.json
frontend/locales/en.json
```

### 8.3 Onboarding
- Tour guidé première utilisation
- Template par défaut selon métier utilisateur
- Audio de démo pour tester

### 8.4 Notifications
- Email quand transcription terminée
- Email quand document prêt
- Toast in-app pour statuts

---

## Estimation Effort

| Phase | Durée | Backend | Frontend |
|-------|-------|---------|----------|
| 1. Infrastructure | 3-4 jours | ███░░ | ░░░░░ |
| 2. Upload Audio | 4-5 jours | ██░░░ | ███░░ |
| 3. Transcription | 5-6 jours | ████░ | █░░░░ |
| 4. Templates | 5-6 jours | ██░░░ | ███░░ |
| 5. Transformation | 6-7 jours | ████░ | ██░░░ |
| 6. Export | 4-5 jours | ███░░ | █░░░░ |
| 7. Bibliothèque | 3-4 jours | █░░░░ | ███░░ |
| 8. Polish | 3-4 jours | █░░░░ | ██░░░ |

**Total estimé**: 6-8 semaines pour 1 développeur full-stack

---

## Limites Trial (MVP)

| Limite | Trial (14 jours) | Abonnement payant |
|--------|------------------|-------------------|
| **Audios max** | 3 audios | Illimité |
| **Durée max/audio** | 30 minutes | 2 heures |
| **Templates** | Tous | Tous |
| **Export PDF/Word** | Oui | Oui |

**Implémentation**:
- Middleware `AudioQuotaMiddleware` vérifie limites avant upload
- Compteur audios dans modèle `Audio` par utilisateur
- Validation durée côté backend après upload

---

## Risques & Mitigations

| Risque | Impact | Mitigation |
|--------|--------|------------|
| Coût API Voxtral Small | Moyen | Limites trial, monitoring usage ($0.004/min) |
| Fichiers volumineux | Moyen | Limite 100MB, durée max 20min pour chat audio |
| Qualité transcription | Haut | Édition manuelle post-transcription |
| Temps transformation | Moyen | Queue async BullMQ + polling status |
| Multi-langue | Faible | Voxtral Small excellent en FR/EN natif |
| **Diarization** | **Moyen** | **Non dispo Mistral - Alternative: Pyannote** |

---

## Prochaines Étapes

### ✅ Terminé
~~1. **Créer compte Mistral AI** - Obtenir API key sur console.mistral.ai~~ ✅
~~2. **Setup Redis local** - `docker run -d -p 6379:6379 redis`~~ ✅
~~3. **Créer service storage local** - Upload/download depuis `storage/uploads`~~ ✅
~~4. **Créer migrations** - Tables `audios`, `transcriptions`, `templates`, `documents`~~ ✅
~~5. **Créer modèles Lucid** - Audio, Transcription, Template, Document~~ ✅
~~6. **Phase 2.1 Backend API** - CRUD audios avec persistance BDD~~ ✅
   - ~~Créer `audios_controller.ts`~~ ✅
   - ~~Créer `audio_policy.ts`~~ ✅
   - ~~Modifier `audio_controller.ts` pour sauvegarder en BDD~~ ✅
   - ~~Modifier `transcription_job.ts` pour sauvegarder transcription~~ ✅
   - ~~Ajouter routes GET/DELETE /audios~~ ✅
   - ~~Créer tests Bruno~~ ✅

### ✅ Phase 2.2 Complétée - Frontend Workshop
~~1. **Frontend Workshop** - Page upload avec drag & drop~~ ✅
~~2. **Composants audio** - Upload, liste, player, status, delete modal, empty state~~ ✅
~~3. **Store Pinia** - Gestion état audios~~ ✅
~~4. **Composables** - useAudioUpload, useAudioRecorder, useAudioPolling, useMarkdown~~ ✅
~~5. **Backend** - Sauvegarde analyse dans transcription~~ ✅

### ⏳ Prochaine étape (Phase 3+)
5. **Templates prédéfinis** - Seeder avec 8 templates métier
6. **Transformation IA** - Service de transformation transcription → document
7. **Export PDF/Word** - Services de génération documents

---

## Fichiers Critiques

### Backend - ✅ Créés
```
# Phase 1.1 - Infrastructure
backend/app/services/storage_service.ts      ✅
backend/app/services/mistral_service.ts      ✅
backend/app/services/queue_service.ts        ✅ (modifié Phase 2.1: audioId)
backend/app/jobs/transcription_job.ts        ✅ (modifié Phase 2.1: save to DB)
backend/app/controllers/audio_controller.ts  ✅ (modifié Phase 2.1: save Audio)
backend/app/validators/audio.ts              ✅ (modifié Phase 2.1: audioIndexValidator)
backend/config/drive.ts                      ✅
backend/config/queue.ts                      ✅
backend/start/worker.ts                      ✅

# Phase 1.2 - Modèles
backend/app/models/audio.ts                  ✅ (modifié Phase 2.1: table name)
backend/app/models/transcription.ts          ✅
backend/app/models/template.ts               ✅
backend/app/models/document.ts               ✅

# Phase 2.1 - API CRUD Audio
backend/app/controllers/audios_controller.ts ✅ (index, show, destroy)
backend/app/policies/audio_policy.ts         ✅ (list, view, update, delete)
backend/start/routes.ts                      ✅ (nouvelles routes /audios)
backend/resources/lang/fr/messages.json      ✅ (messages audio)
backend/resources/lang/en/messages.json      ✅ (messages audio EN)

# Phase 2.1 - Tests Bruno
backend/tests/api/alexia/audio/ListAudios.bru           ✅
backend/tests/api/alexia/audio/ListAudiosWithFilter.bru ✅
backend/tests/api/alexia/audio/GetAudio.bru             ✅
backend/tests/api/alexia/audio/GetAudio-NotFound.bru    ✅
backend/tests/api/alexia/audio/DeleteAudio.bru          ✅
backend/tests/api/alexia/audio/DeleteAudio-NotFound.bru ✅

# Phase 2.2 - Amélioration analyse
backend/database/migrations/1766270576042_add_analysis_to_transcriptions_table.ts ✅
backend/app/models/transcription.ts                     ✅ (modifié: champ analysis)
backend/app/jobs/transcription_job.ts                   ✅ (modifié: sauvegarde analyse)
backend/app/controllers/audios_controller.ts            ✅ (modifié: retourne analyse)
```

### Backend - ⬜ À créer
```
# Phase 4+ - Templates & Documents
backend/app/controllers/templates_controller.ts
backend/app/controllers/documents_controller.ts
backend/database/seeders/default_templates_seeder.ts

# Phase 5-6 - Transformation & Export
backend/app/services/transformation_service.ts
backend/app/services/pdf_service.ts
backend/app/services/docx_service.ts
```

### Frontend - ✅ Phase 2 Créés
```
# Phase 2 - Workshop ✅
frontend/app/pages/dashboard/workshop/index.vue        ✅
frontend/app/pages/dashboard/workshop/[id].vue         ✅
frontend/app/components/workshop/AudioUploadZone.vue   ✅
frontend/app/components/workshop/AudioRecorder.vue     ✅
frontend/app/components/workshop/AudioList.vue         ✅
frontend/app/components/workshop/AudioCard.vue         ✅
frontend/app/components/workshop/AudioPlayer.vue       ✅
frontend/app/components/workshop/ProcessingStatus.vue  ✅
frontend/app/components/workshop/AudioDeleteModal.vue  ✅
frontend/app/components/workshop/EmptyState.vue        ✅
frontend/app/composables/useAudioUpload.ts             ✅
frontend/app/composables/useAudioRecorder.ts           ✅
frontend/app/composables/useAudioPolling.ts            ✅
frontend/app/composables/useMarkdown.ts                ✅
frontend/app/stores/audio.ts                           ✅
frontend/app/types/audio.ts                            ✅
frontend/app/layouts/default.vue                       ✅ (modifié)
```

### Frontend - ⬜ À créer
```
# Phase 5+ - Templates & Documents
frontend/app/pages/dashboard/documents/index.vue
frontend/app/components/workshop/TemplateSelector.vue
frontend/app/components/workshop/DocumentPreview.vue
```
