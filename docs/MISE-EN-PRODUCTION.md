# Mise en production sur Google Cloud Run

Ce qui est prêt dans le code (13 novembre 2026) :

- `npm start` lance le serveur en production (`NODE_ENV=production`), sur le port donné par l'hébergeur (`PORT`, 3000 par défaut).
- `Dockerfile` : construit le site, puis une image légère sans les outils de développement (Vite n'est chargé qu'en local). Fuseau `Europe/Paris`.
- `.dockerignore` : `.env`, clés, `ios/`, `android/`, `docs/` n'entrent jamais dans l'image.
- Au démarrage, le serveur écrit dans ses journaux les réglages manquants ou douteux (noms seulement, jamais les valeurs) : chercher « Production configuration » dans Cloud Run › Journaux.
- Derrière le proxy de Google, l'adresse réelle du visiteur est lue (`trust proxy`) : sans cela, les limites de requêtes seraient communes à tous les visiteurs.
- Les fichiers de `/assets` sont mis en cache un an (leur nom change à chaque version) ; la page elle-même est revérifiée à chaque visite, une nouvelle version s'affiche donc tout de suite.

## Réglages Cloud Run indispensables

Le serveur fait tourner des tâches en continu (prélèvements, expirations, mails, transferts, rapprochement Stripe). D'où :

| Réglage | Valeur | Pourquoi |
|---|---|---|
| Instances minimum | **1** | sinon le serveur s'endort sans visite et les tâches s'arrêtent |
| Instances maximum | **1** | les tâches automatiques ne doivent pas tourner en double tant que ce n'est pas vérifié |
| Processeur | **toujours alloué** (`--no-cpu-throttling`) | sinon le processeur est coupé entre deux requêtes |
| Mémoire | 1 Gio | marge pour les PDF et Firebase |
| Région | celle de la base Firestore (par exemple `europe-west9`, Paris) | moins de latence ; à vérifier dans la console Firebase › Firestore |
| Projet | le **même projet Google** que Firebase | le serveur accède à Firestore et à Firebase Auth sans clé |

Coût indicatif d'une instance toujours active (1 processeur, 1 Gio) : de l'ordre de 40 à 60 € par mois.

## Première mise en ligne (à faire par Paul)

1. Installer l'outil Google : <https://cloud.google.com/sdk/docs/install>, puis `gcloud auth login` et `gcloud config set project <id du projet Firebase>`.
2. Activer les services : `gcloud services enable run.googleapis.com cloudbuild.googleapis.com artifactregistry.googleapis.com secretmanager.googleapis.com`.
3. Créer les secrets dans **Secret Manager** (console Google Cloud › Secret Manager), un par valeur : `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `STRIPE_CONNECT_WEBHOOK_SECRET`, `RESEND_API_KEY`. Les valeurs se saisissent dans la console, jamais dans Git ni dans une conversation.
4. Donner au compte de service de Cloud Run (par défaut « Compute Engine default service account ») les rôles : *Utilisateur Cloud Datastore*, *Administrateur Firebase Authentication*, *Accesseur de secrets Secret Manager*.
5. Déployer depuis le dossier Haven :

```bash
gcloud run deploy haven --source . --region europe-west9 \
  --min-instances 1 --max-instances 1 --no-cpu-throttling --memory 1Gi \
  --allow-unauthenticated \
  --set-secrets STRIPE_SECRET_KEY=STRIPE_SECRET_KEY:latest,STRIPE_WEBHOOK_SECRET=STRIPE_WEBHOOK_SECRET:latest,STRIPE_CONNECT_WEBHOOK_SECRET=STRIPE_CONNECT_WEBHOOK_SECRET:latest,RESEND_API_KEY=RESEND_API_KEY:latest \
  --set-env-vars APP_ORIGIN=https://havencoloc.fr,EMAIL_FROM="Haven <bonjour@havencoloc.fr>",EMAIL_REPLY_TO=contact@havencoloc.fr,HAVEN_TEAM_EMAIL=equipe@havencoloc.fr,RESEND_TEMPLATES_ENABLED=true,RESERVATION_EMAIL_ENABLED=true,RESERVATION_EMAIL_START_AT=<date fixe ISO>
```

   Les adresses e-mail sont des exemples à remplacer par les choix définitifs. `RESEND_TEST_EMAIL_TO` et `PAYMENT_MODE` ne sont pas à renseigner en production.

6. Relier le domaine : Cloud Run › *Gérer les domaines personnalisés* › ajouter `havencoloc.fr`, puis saisir chez Gandi les enregistrements DNS indiqués. Le certificat HTTPS est fourni automatiquement.
7. Firebase › Authentication › Paramètres › **Domaines autorisés** : ajouter `havencoloc.fr` (sinon la connexion échoue).
8. Stripe : créer les deux webhooks live vers `https://havencoloc.fr/api/stripe/webhook` et `https://havencoloc.fr/api/stripe/connect-webhook` (événements listés dans `A-FAIRE.md`), puis mettre leurs secrets dans Secret Manager.
9. Vérifier : `https://havencoloc.fr/api/health` doit répondre `"paymentMode":"STRIPE"` et `"emailConfigured":true`, et les journaux ne doivent plus montrer de ligne « Production configuration missing ».

Les versions suivantes se publient avec la même commande `gcloud run deploy haven --source . --region europe-west9` : les réglages et secrets sont conservés.

## Essai local du mode production

```bash
npm run build && PORT=3099 node --env-file-if-exists=.env --import tsx server.ts
```

avec `NODE_ENV=production` dans l'environnement. Attention : la base Firestore utilisée est la vraie, comme en développement.
