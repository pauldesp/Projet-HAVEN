# Haven — colocation courte durée

Application web responsive avec espaces locataire, propriétaire et administration. Ce dépôt contient le code source, les ressources visuelles, les tests et la documentation de configuration.

## Architecture actuelle

- **Interface** : React 18, TypeScript, React Router, Tailwind CSS et Vite.
- **Serveur** : Express dans `server.ts`, lancé avec Node.js et `tsx`. En développement, Vite est intégré au serveur ; en production, Express sert le dossier `dist` compilé.
- **Comptes et données** : Firebase Authentication, Firestore et Firebase Admin côté serveur. La configuration publique du projet est dans `firebase-applet-config.json` ; les règles sont dans `firestore.rules`.
- **Paiements** : Stripe Checkout et Stripe Connect, avec environnement de test et suivi des transferts/virements. Une simulation interne reste disponible en développement.
- **E-mails et documents** : Resend et génération de justificatifs PDF côté serveur.
- **Applications mobiles** : projets Capacitor dans `ios/` et `android/`.

## Installation locale

Prérequis : Node.js 22 ou ultérieur et npm.

```sh
npm ci
cp .env.example .env
npm run dev
```

Le site s’ouvre sur `http://localhost:3000`. Le fichier d’exemple utilise la simulation de paiement, sans clé Stripe. Les fonctions serveur qui accèdent aux comptes et réservations nécessitent des identifiants Firebase Admin autorisés : configurer les Application Default Credentials ou `GOOGLE_APPLICATION_CREDENTIALS` avec un fichier privé extérieur au dépôt.

Pour tester directement avec Stripe, suivre [la configuration Sandbox](docs/STRIPE-SANDBOX.md). La commande habituelle `npm run dev` démarre aussi le relais de notifications lorsque les clés de test et l’identifiant de la Sandbox sont configurés. Le CLI Stripe local doit alors être installé selon la procédure indiquée. Les clés et identifiants privés ne sont pas inclus dans cette sauvegarde et doivent être configurés séparément dans chaque environnement.

## Vérifications

```sh
npm run lint     # Vérification TypeScript
npm test         # Tests métier et de sécurité
npm run build    # Compilation web dans dist/
npm run check    # Les trois vérifications, dans cet ordre
```

## Repères pour reprendre le projet dans un autre outil

- `App.tsx` : routes et chargement des pages.
- `pages/` et `components/` : écrans et composants réutilisables.
- `contexts/` : état partagé, authentification et langues.
- `services/` : règles métier, accès API, documents et tests unitaires.
- `server.ts` : API authentifiée, intégrations et traitements périodiques.
- `types.ts` : modèles des données.
- `public/` et `styles/` : ressources publiques et styles responsives.
- `docs/` : documentation des paiements, e-mails, guides du séjour, mobile et connexions.
- `output/imagegen/` : propositions visuelles et prompts d’origine.

Ce dépôt n’exporte pas les utilisateurs, réservations, fichiers privés ou données de la base Firebase. Accéder au code ne donne pas automatiquement accès aux services externes. Les clés Stripe, Resend et identifiants Firebase Admin restent exclusivement côté serveur. Ne pas mettre de clé secrète dans une variable `VITE_`.

Les dossiers `.stripe-local/`, `node_modules/`, `dist/`, les fichiers `.env` et les aperçus PDF locaux sont exclus de Git. `.env.example` documente les paramètres sans contenir de secrets.

## Documentation utile

- [Paiements et reversements propriétaires](docs/PAYMENTS.md)
- [Sandbox Stripe](docs/STRIPE-SANDBOX.md)
- [Connexion Google](docs/GOOGLE-SIGN-IN.md)
- [Adaptation mobile](docs/MOBILE.md)

La publication du code sur GitHub ne déploie pas le site. Un hébergement doit prendre en charge le serveur Node.js et ses traitements périodiques ; un hébergement statique seul ne suffit pas pour les fonctionnalités serveur.
