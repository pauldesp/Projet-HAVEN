# Stripe Sandbox Haven

Environnement géré créé le 26 octobre 2026 : **Haven - Développement** (`acct_1UUwQnB51ekrVQMG`).

[Ouvrir le Dashboard de test](https://dashboard.stripe.com/acct_1UUwQnB51ekrVQMG/test/dashboard).

Connect est activé dans cette Sandbox. L’autorisation du CLI est limitée à cet environnement ; aucun accès de production n’a été accordé. La clé serveur de test et les secrets de signature restent dans `.env` (mode 600), hors Git. Le CLI et sa configuration locale sont dans `.stripe-local/`, également exclu de Git et interdit d’accès par le serveur de développement. La caution reste désactivée.

## Démarrer

```sh
npm run dev
```

Cette commande détecte la clé de test et démarre le relais Stripe signé **avant** Haven. `npm run dev:stripe` lance explicitement le même parcours. Le relais reçoit les événements de la plateforme et des comptes connectés et les transmet aux deux routes locales. Ses secrets sont actualisés automatiquement sans être imprimés. L’identifiant du compte est vérifié auprès de Stripe avant tout démarrage pour éviter d’utiliser une autre Sandbox par erreur. Les clés live sont refusées par ce lanceur de test.

Laisser cette commande active pendant les essais. Arrêter puis redémarrer l’ensemble avec Ctrl+C, puis `npm run dev`. Un simple démarrage de `server.ts` sans le relais ne permet pas la réception immédiate des notifications locales ; le rapprochement périodique reste une récupération, pas un remplacement du relais.

L’origine locale conserve l’adresse du Mac pour permettre les essais sur smartphone sur le même réseau. HTTP est accepté uniquement en développement avec une clé de test et une adresse locale ; le mode live exige HTTPS.

## Tester dans Haven

1. Se connecter en propriétaire, ouvrir **Finances → Mes versements → Configurer mes versements** et terminer l’onboarding Stripe de test. Le formulaire Stripe peut demander ses données de test et son accord de service ; Haven ne valide pas ces informations à la place du propriétaire.
2. Créer une **nouvelle** réservation côté locataire. Les anciennes réservations payées en simulation restent des simulations et ne sont pas converties en paiements Stripe.
3. Le paiement ouvre la page Stripe Checkout de la Sandbox. Utiliser la carte de test `4242 4242 4242 4242`, une date future et un CVC fictif de trois chiffres. Ne pas utiliser une vraie carte.
4. Vérifier la confirmation et l’absence de transfert avant l’arrivée. Valider l’EDLE le jour autorisé pour déclencher la part du propriétaire.
5. Contrôler le transfert et le virement dans Stripe, puis leur synchronisation dans Haven. Les virements test ne rentrent jamais dans les revenus réellement versés.

IBAN français de **test Stripe**, si demandé par le formulaire : `FR1420041010050500013M02606`. Utiliser exclusivement ces données fictives dans la Sandbox.

Sources officielles : [cartes de test](https://docs.stripe.com/testing), [onboarding et virements Connect de test](https://docs.stripe.com/connect/testing), [notifications locales](https://docs.stripe.com/cli/listen).

## Recette technique effectuée

Une recette isolée a créé un compte Express de test et un lien d’onboarding valide, une session Checkout de test (expirée ensuite), puis un paiement fictif de 142 €, un transfert de 125 € et un virement fictif. Un destinataire Custom fictif a été utilisé uniquement pour automatiser la recette bancaire sans accepter l’onboarding Express à la place d’un propriétaire. Aucune location existante, aucun compte utilisateur Haven, aucune banque réelle et aucun e-mail locataire n’ont été utilisés par cette recette. Le résultat détaillé reste dans le dossier privé `.stripe-local/smoke-result.json`.

L’acceptation des notifications est vérifiée via les codes HTTP du relais. Les objets restent visibles dans la Sandbox. Le virement fictif est ensuite passé au statut `paid` chez Stripe. Le suivi conserve toujours le statut réellement renvoyé par Stripe : on ne force jamais artificiellement un statut « payé » dans Haven.
