# Audio API Tests

Tests Bruno pour les routes de traitement audio asynchrone.

## Prerequis

### 1. Fichier audio de test

Placez un fichier `sample.mp3` dans ce dossier pour les tests d'upload.

```bash
# Exemple: copier un fichier audio existant
cp /path/to/your/audio.mp3 ./sample.mp3
```

### 2. Redis en cours d'execution

```bash
docker run -d -p 6379:6379 --name alexia-redis redis:alpine
```

### 3. Token d'authentification

Configurez la variable `token` dans l'environnement Bruno (local.bru).

## Routes testees

| Route                  | Methode | Description                                   |
| ---------------------- | ------- | --------------------------------------------- |
| `/audio/process`       | POST    | Soumet un fichier audio pour traitement async |
| `/audio/status/:jobId` | GET     | Recupere le statut d'un job                   |

## Flow de test

1. **ProcessAudio.bru** - Upload fichier → Recoit jobId
2. **GetJobStatus.bru** - Poll le statut avec le jobId
3. **GetJobStatus-NotFound.bru** - Test 404 pour job inexistant

## Variables d'environnement

| Variable  | Description                                      |
| --------- | ------------------------------------------------ |
| `baseUrl` | URL de base de l'API (ex: http://localhost:3333) |
| `token`   | Token JWT d'authentification                     |
| `jobId`   | ID du job (auto-set par ProcessAudio)            |
