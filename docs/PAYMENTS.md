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

1. Configurer et vérifier le compte Stripe qui encaissera les réservations, ainsi que les modalités de reversement aux propriétaires. Activer Stripe Connect et vérifier que le modèle « separate charges and transfers » est autorisé pour les pays concernés.
2. Définir `PAYMENT_MODE=stripe`, `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `STRIPE_CONNECT_WEBHOOK_SECRET` et `APP_ORIGIN` côté serveur. En production, définir `NODE_ENV=production` et l’URL HTTPS du site.
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

Le serveur traite la file au démarrage, après un paiement et toutes les 30 secondes. Une indisponibilité du service d’e-mail ne défait jamais un paiement confirmé. Les tâches sont reprises avec temporisation, verrou transactionnel et clé d’idempotence Resend. L’état SENT signifie accepté par le fournisseur, pas une garantie d’arrivée en boîte de réception. Les tâches d’arrivée sont abandonnées si la réservation est annulée. Depuis le 25 octobre, si les consignes manquent, le mail d’arrivée invite le locataire à contacter le propriétaire ; aucun code n’est inventé. Le locataire voit les consignes dans son séjour à partir de l’échéance, même si l’e-mail est indisponible.

À configurer avant un test d’envoi réel : `RESEND_API_KEY`, un `EMAIL_FROM` autorisé et le domaine expéditeur vérifié. Sans cela, les messages restent en file et l’interface le signale. Aucun e-mail de test réel n’a été envoyé automatiquement pendant le développement. Les codes d’accès ne sont pas exposés dans le mail de confirmation ni dans le PDF.

L’hébergement de production doit maintenir ce serveur actif pour le traitement des tâches. Pour une architecture sans serveur, déplacer le traitement vers un worker/ordonnanceur durable avant publication. Prévoir également les événements de livraison/rebond Resend et la réconciliation des envois ambigus dépassant sa fenêtre d’idempotence avant un lancement à grande échelle.

## Automatisation étendue (25 octobre 2026)

La confirmation et les consignes sont complétées par le mail après EDLE, le rappel de départ la veille à 10 h locale et le mail après EDLS / déclaration de dépôt des clés. Une activation explicite et une date de démarrage sont nécessaires. Voir [EMAILS.md](EMAILS.md) pour la configuration Resend, les tests et les reprises.


## Tableau de bord propriétaire : versements bancaires

Les revenus versés et virements en attente lisent uniquement la collection privée `owner_payouts`, via `GET /api/owner/payouts` (propriétaire authentifié uniquement). Aucun client ne peut écrire dans cette collection. Les règlements des locataires (`payments`) restent dans un historique distinct et ne constituent pas des revenus propriétaires.

Le modèle `OwnerPayout` contient un montant net en centimes, la devise, le propriétaire, le prestataire, le mode test, le statut et les références/dates du virement. Seuls les enregistrements EUR Stripe explicitement hors test entrent dans les compteurs : `PAID` avec référence prestataire et date de versement valide pour les revenus, `PENDING` ou `PROCESSING` pour les virements en attente. Les statuts échoué, annulé ou retourné ne sont pas comptabilisés. Le passage à la date d’arrivée ne modifie aucun montant.

Le registre est alimenté par les notifications signées Stripe et par un rapprochement avec les objets actuels du prestataire. Les échecs et retours remplacent les anciens statuts, y compris après un événement « payé ». Un paiement Checkout ou un transfert vers un solde Stripe ne constitue pas une confirmation de versement bancaire. Aucune écriture de versement fictive ou migration depuis `payments` n’est effectuée. Sans enregistrement de versement réel, les compteurs restent à zéro ; une erreur de chargement affiche un tiret plutôt qu’un faux zéro.


## Stripe Connect : configuration et règles de reversement (26 octobre 2026)

L’interface **Propriétaire → Finances → Mes versements** ouvre l’onboarding hébergé Stripe (compte avec dashboard Express, collecte des exigences par Stripe, responsabilité des frais et pertes côté plateforme). Stripe reçoit les informations d’identité et de banque ; Haven conserve l’identifiant du compte et un aperçu bancaire masqué, dans des collections privées accessibles uniquement au serveur. Les routes authentifiées utilisent exclusivement l’identifiant de l’utilisateur connecté, jamais un propriétaire transmis par le client.

Le prix du séjour est encaissé à la réservation sur le compte plateforme. Le montant propriétaire est **prix du séjour + forfait ménage**, sans déduction des frais Stripe. Haven garde ses frais de service et supporte les frais Stripe, y compris si ceux-ci dépassent ponctuellement sa commission. Il ne s’agit pas d’un prélèvement différé du locataire.

La réservation payante exige un compte propriétaire prêt (capacité `transfers` active, versements activés, banque EUR). Après validation serveur de l’EDLE par le locataire, un justificatif d’arrivée privé `owner_arrivals` autorise le transfert. La seule date d’arrivée, un rapport créé directement par un client ou une URL de retour ne suffisent pas. Le destinataire et les montants sont liés au paiement d’origine et conservés dans `owner_settlements`. Le transfert utilise `source_transaction`, `transfer_group` et une clé d’idempotence stable. Un verrou transactionnel évite les traitements concurrents ; une réponse perdue est rapprochée des transferts existants avant toute nouvelle création. Les cas ambigus dépassant 23 heures passent en vérification manuelle, sans second transfert aveugle.

Un transfert alimente le solde Stripe du propriétaire : il n’est **jamais** affiché comme virement bancaire payé. Le virement bancaire suit le calendrier Stripe du compte connecté et la disponibilité des fonds. Haven n’annonce pas une réception instantanée. Les compteurs excluent les tests ; ceux-ci restent identifiés dans le suivi des transferts.

### Activation indispensable

Sans configuration, le panneau indique honnêtement que Connect n’est pas activé ; il ne crée aucun faux compte ni virement. Aucun accès bancaire réel n’a été réalisé pendant cette implémentation. Configurer les secrets uniquement dans l’environnement serveur, jamais dans le chat, Git ou des variables `VITE_`.

- Compte plateforme : webhook HTTPS `POST /api/stripe/webhook`, avec son secret `STRIPE_WEBHOOK_SECRET`. Événements : `checkout.session.completed`, `checkout.session.async_payment_succeeded`, `transfer.created`, `transfer.updated`, `transfer.reversed`, `charge.refunded`, `charge.dispute.created`, `charge.dispute.updated`, `charge.dispute.closed`, `refund.created`, `refund.updated`, `refund.failed`.
- Comptes connectés : webhook HTTPS `POST /api/stripe/connect-webhook`, avec son **propre** secret `STRIPE_CONNECT_WEBHOOK_SECRET`, destination couvrant les événements des comptes connectés. Événements : `account.updated`, `account.external_account.created`, `account.external_account.updated`, `account.external_account.deleted`, `payout.created`, `payout.updated`, `payout.paid`, `payout.failed`, `payout.canceled`.
- `APP_ORIGIN` est une origine fixe de confiance en HTTPS (HTTP localhost uniquement en développement) ; les retours autorisés pointent vers `/#/owner/dashboard?stripe=return` ou `?stripe=refresh`. Le retour ouvre Finances, puis relit Stripe. Il ne valide pas un compte.
- Déployer les règles Firestore privées et maintenir le serveur/worker actif. Traitement des arrivées toutes les 30 secondes, rapprochement complet au démarrage puis toutes les cinq minutes, rapprochement des virements lors de la lecture du dashboard. Aucun ordonnanceur local ponctuel ne remplace un worker de production.
- En environnement de test Stripe : terminer un onboarding, tester KYC incomplet/restriction et changement de banque, payer un séjour, vérifier qu’aucun transfert ne part avant l’EDLE, valider l’EDLE, vérifier le transfert puis les événements de virement. Tester refus, remboursement, contestation, événement dupliqué/désordonné, notification perdue, redémarrage et réponse réseau perdue. Passer au live seulement après cette recette et validation de Connect chez Stripe.

Les signatures sont vérifiées avant tout traitement ; un échec métier répond 500 afin que Stripe réessaie. Les événements du mauvais mode test/live sont ignorés. Les notifications de virement déclenchent une relecture du statut actuel de Stripe : un ancien événement ne rétablit pas à tort un virement finalement échoué. Les notifications de transfert et le rapprochement récupèrent aussi un transfert créé avant une interruption du serveur. Les rapports et paiements antérieurs à cette politique ne sont pas automatiquement convertis en transferts.

### Cas nécessitant une intervention Haven

Un paiement remboursé ou contesté bloque le transfert avant libération. Un remboursement ou litige **après** transfert passe en `REVIEW_REQUIRED` avec montants remboursés et statut de contestation réels conservés. Les remboursements sur la plateforme n’annulent pas automatiquement les transferts Stripe : l’équipe Haven doit rapprocher le dossier et décider/reverser les fonds dans Stripe. Une annulation totale ou partielle de transfert effectuée dans Stripe est synchronisée. Cette intervention n’est pas automatisée arbitrairement ; une contestation ne justifie pas de débiter automatiquement la banque du propriétaire.

Les dossiers `owner_settlements` en `REVIEW_REQUIRED` doivent être surveillés par l’exploitation via l’accès serveur à Firestore ; mettre une alerte d’exploitation en place avant mise en production. Le dashboard propriétaire affiche « Vérification par Haven nécessaire ». Le traitement périodique reprend les erreurs transitoires, mais ne masque pas ces dossiers comme des virements normaux. Les remboursements locataires sont désormais idempotents et ne passent à « terminé » que lorsque Stripe les confirme.

### Future empreinte de caution

`DEPOSIT_POLICY` est explicitement **désactivée**, sans montant ni date de mise en place. Aucun blocage bancaire, débit de caution, enregistrement de carte ou consentement de caution n’est réalisé. L’ancienne mention laissant croire à une empreinte déjà active dans le récapitulatif d’entrée a été retirée.

À décider avant activation : montant fixe/plafond proportionnel, règles communes ou par logement, limites, date de demande, consentement explicite et information du locataire, conditions de capture et de libération, gestion des contestations et de l’expiration. Une autorisation de carte en ligne expire généralement après quelques jours (souvent 7, parfois 5) : il faudra vérifier `capture_before`, prévoir le déclenchement près de l’arrivée et étudier les autorisations étendues selon éligibilité. Une réservation faite longtemps à l’avance ne permet pas de garantir une empreinte jusqu’à la fin du séjour.

Sources : [onboarding hébergé](https://docs.stripe.com/connect/hosted-onboarding), [paiements et transferts séparés](https://docs.stripe.com/connect/separate-charges-and-transfers), [webhooks Connect](https://docs.stripe.com/connect/webhooks), [virements des comptes connectés](https://docs.stripe.com/connect/manage-connected-account-payouts), [durée des autorisations](https://docs.stripe.com/payments/place-a-hold-on-a-payment-method).
