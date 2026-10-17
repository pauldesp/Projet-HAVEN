# Paiement des réservations

## Tester aujourd’hui

Le serveur de développement utilise `PAYMENT_MODE=simulation` par défaut. Le parcours est : dates et conditions → page `/payment/:bookingId` → bouton **Simuler le paiement** → confirmation → séjours du locataire et du propriétaire.

La page utilise des valeurs de carte fictives en lecture seule. Aucun numéro de carte ni cryptogramme n’est envoyé ou conservé. L’ouverture de la page et sa consultation ne confirment rien. Le bouton appelle une route authentifiée, réservée au locataire de la réservation. Un double clic ou une réponse réseau perdue peut être réessayé sans doubler l’encaissement de test.

Les écritures de réservation, paiement, calendrier et message de confirmation utilisent une transaction commune à la simulation et à Stripe. Les données simulées portent `provider=SIMULATION` et `isTest=true`. Le remboursement d’un paiement simulé reste simulé, même si Stripe est activé par la suite.

Une tentative non payée reste invisible au propriétaire. Elle conserve une retenue technique de disponibilité pendant le délai de paiement.

## Modes du serveur

- `PAYMENT_MODE=simulation` : autorisé uniquement hors production. Aucun appel de débit à Stripe.
- `PAYMENT_MODE=stripe` : impose une clé serveur et un secret de webhook valides ; toute erreur désactive le paiement, sans basculer en simulation.
- `NODE_ENV=production` : interdit toujours la simulation et exige une origine HTTPS. Si le mode n’est pas renseigné, Stripe est exigé, jamais la simulation.

Les clés restent exclusivement côté serveur, sans préfixe `VITE_`. Le paiement réel utilisera Stripe Checkout hébergé : les données bancaires ne passeront pas par le serveur Haven. Aucun SDK de carte n’est chargé dans la page de simulation.

## Paramétrage Stripe à faire avant mise en ligne

1. Configurer et vérifier le compte Stripe qui encaissera les réservations, ainsi que les modalités de reversement aux propriétaires. Le paiement de réservation ne constitue pas à lui seul une intégration de virements automatiques ou de Stripe Connect.
2. Définir `PAYMENT_MODE=stripe`, `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET` et `APP_ORIGIN` côté serveur. En production, définir `NODE_ENV=production` et l’URL HTTPS du site.
3. Déclarer le webhook HTTPS `POST /api/stripe/webhook` pour `checkout.session.completed`. Le corps brut et la signature Stripe sont contrôlés ; la confirmation exige un paiement `paid`, la bonne session, la devise EUR et le montant de la réservation.
4. Effectuer d’abord les tests Stripe en environnement de test : succès, refus, authentification bancaire, retour arrière, double clic, notifications répétées, interruption réseau, expiration et remboursement. La simulation locale n’est pas un test de l’intégration bancaire réelle.
5. Passer aux clés de production et au secret du webhook correspondant après vérification du compte, des reversements, des conditions applicables et du parcours complet. Aucune clé de production n’est nécessaire pour les tests actuels.

La route de création de session utilise une clé d’idempotence par réservation et réutilise une session ouverte. Le montant et les informations du séjour viennent du serveur. Le titre et les prix sont conservés à la création de la réservation. Une session Stripe expire une heure après la création de la tentative ; elle doit être ouverte dans les 30 premières minutes et sa date d’expiration devient alors celle de la retenue de disponibilité.

Un retour navigateur ou une URL de succès ne suffit jamais à confirmer la réservation. Le webhook signé utilise le même traitement transactionnel que le simulateur. Les notifications répétées ne créent pas de doublon. Un paiement incompatible avec une réservation annulée, expirée, une autre session ou un autre montant est refusé par la confirmation et remboursé avec une clé d’idempotence.

Les annulations continuent à appliquer la politique de remboursement Haven. Les paiements réellement encaissés ne peuvent pas être « remboursés » par une simulation si la configuration Stripe est indisponible.

## Routes

- `GET /api/payments/:bookingId` : récapitulatif du locataire authentifié, mode serveur, état et échéance ; aucune mutation.
- `POST /api/payments/:bookingId/simulate` : confirmation explicite de test, interdite en production et lorsque Stripe est sélectionné. Le corps ne transporte aucune donnée de carte ni montant.
- `POST /api/create-checkout-session` : ouvre Stripe si configuré ; en simulation, conduit uniquement à la page de paiement, sans confirmer automatiquement.
- `POST /api/stripe/webhook` : confirmation bancaire authentifiée par signature Stripe.

## Sources Stripe utilisées

- [Confirmation et webhooks](https://docs.stripe.com/checkout/fulfillment?payment-ui=stripe-hosted)
- [Création et expiration des sessions](https://docs.stripe.com/api/checkout/sessions/create)
- [Requêtes idempotentes](https://docs.stripe.com/api/idempotent_requests)

## Confirmation et informations du séjour (18 octobre 2026)

La même transaction serveur qui confirme le paiement crée désormais :
- un instantané privé `reservation_confirmations/{bookingId}` (adresse complète, frais, dates, règles communes Haven, référence du paiement) ;
- le document `RENT_RECEIPT` dans les documents du locataire ;
- deux tâches durables `reservation_mail_outbox` : confirmation immédiate avec PDF joint, puis consignes d’entrée 72 heures avant l’arrivée.

Le justificatif PDF est généré par PDFKit via une route authentifiée réservée aux participants de la réservation. Les paiements simulés et les paiements Stripe en environnement de test produisent toujours un document explicitement marqué comme test, sans preuve d’encaissement réel. Aucun document n’est créé pour un simple passage sur la page de paiement. Les anciennes réservations déjà payées ne sont pas rétroactivement dotées d’un justificatif.

Les règles communes sont centralisées dans `services/reservationFulfillment.ts` et copiées lors du paiement. Les consignes d’accès et de remise des clés sont distinctes : le propriétaire les renseigne dans la modification du logement. Elles sont stockées dans `listing_access`, jamais dans l’annonce publique. Le fuseau horaire du logement est réglable dans ce même espace (Europe/Paris par défaut). Le calcul de l’envoi utilise ce fuseau et tient compte des changements d’heure. Une réservation de dernière minute déclenche l’envoi dès confirmation.

Le serveur traite la file au démarrage, après un paiement et toutes les 30 secondes. Une indisponibilité du service d’e-mail ne défait jamais un paiement confirmé. Les tâches sont reprises avec temporisation, verrou transactionnel et clé d’idempotence Resend. L’état SENT signifie accepté par le fournisseur, pas une garantie d’arrivée en boîte de réception. Les tâches d’arrivée sont abandonnées si la réservation est annulée. Si les consignes manquent, elles restent en attente et le propriétaire doit les compléter ; aucun message vide n’est envoyé. Le locataire voit les consignes dans son séjour à partir de l’échéance, même si l’e-mail est indisponible.

À configurer avant un test d’envoi réel : `RESEND_API_KEY`, un `EMAIL_FROM` autorisé et le domaine expéditeur vérifié. Sans cela, les messages restent en file et l’interface le signale. Aucun e-mail de test réel n’a été envoyé automatiquement pendant le développement. Les codes d’accès ne sont pas exposés dans le mail de confirmation ni dans le PDF.

L’hébergement de production doit maintenir ce serveur actif pour le traitement des tâches. Pour une architecture sans serveur, déplacer le traitement vers un worker/ordonnanceur durable avant publication. Prévoir également les événements de livraison/rebond Resend et la réconciliation des envois ambigus dépassant sa fenêtre d’idempotence avant un lancement à grande échelle.
