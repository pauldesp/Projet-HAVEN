# Connexion Google — 26 octobre 2026

## Correction

Haven utilisait systématiquement `signInWithRedirect` avec un `authDomain` Firebase différent du domaine de l’application. Safari peut bloquer le stockage tiers utilisé pour récupérer le résultat après la redirection. Un retour à la connexion sans session visible est donc possible.

Le bouton utilise maintenant `signInWithPopup`, appelé immédiatement depuis le clic, sans requête ou attente préalable. Aucun repli automatique vers la redirection problématique n’est ajouté. Les erreurs distinguent fenêtre bloquée, fermeture volontaire, domaine non autorisé, fournisseur indisponible et compte existant avec un autre mode de connexion.

La création du profil reste liée à l’utilisateur authentifié par Firebase. Une transaction conserve le profil existant, son rôle et son dossier. Un nouveau profil reste locataire et en attente. Les doubles clics partagent la même opération ; un échec permet une nouvelle tentative. La reprise des anciennes redirections reste disponible.

## Vérifications

- Configuration publique Firebase consultée en lecture seule : `macbook-pro-de-desplanques.local` figure dans les domaines autorisés. Aucune configuration distante modifiée.
- La lecture administrative de l’activation du fournisseur Google renvoie `PERMISSION_DENIED` (403) avec les identifiants locaux : son état n’a pas pu être confirmé par cette API. Aucun paramètre n’a été changé.
- Tests : ouverture immédiate, doubles clics, fenêtre bloquée et reprise, échec de sauvegarde du profil, résultat absent, messages d’erreur ; tests de création du profil existants.
- Aucun compte Google réel n’a été connecté pour les tests. Une connexion complète sur Safari iPhone reste à valider par l’utilisateur.

Référence officielle : https://firebase.google.com/docs/auth/web/redirect-best-practices (option 2).
