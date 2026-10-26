# E-mails automatiques des réservations

## Événements locataire

| Message | Déclencheur |
| --- | --- |
| Confirmation et justificatif PDF | Paiement confirmé par le serveur, y compris simulation signalée TEST |
| Informations d’arrivée | 72 heures avant l’arrivée ; immédiatement si réservation plus tardive |
| Entrée enregistrée | Enregistrement réussi de l’état des lieux d’entrée |
| Préparer le départ | La veille à 10 h, dans le fuseau du logement ; immédiatement si réservation plus tardive |
| Départ enregistré | État des lieux de sortie et déclaration du dépôt des clés enregistrés |
| Compte validé / dossier à corriger | Décision administrateur enregistrée sur un profil locataire ; le motif accompagne la correction |
| Réservation annulée | Annulation enregistrée d’une réservation payée ; récapitulatif et remboursement enregistré ou simulé |
| Invitation à laisser un avis | Une fois, 24 h après le départ effectif, uniquement sans avis existant et dans la fenêtre de 7 jours |

Les mails d’arrivée reprennent les consignes privées renseignées par le propriétaire. À défaut, ils invitent à le contacter depuis la messagerie ; aucun code n’est inventé. Les règles communes Haven sont reprises dans les premiers messages et le rappel de départ donne la liste des actions attendues. Le mail de sortie confirme l’enregistrement de la déclaration, pas une vérification physique des clés ou une approbation du propriétaire.

## Configuration locale

La création d’un compte Resend ne suffit pas à activer la distribution. Le fichier `.env` reste local et ignoré par Git.

1. Dans Resend, créer une clé API avec permission d’envoi et la coller uniquement dans `RESEND_API_KEY` dans `.env` (jamais dans le navigateur, Git ou le chat).
2. Sans domaine : `EMAIL_FROM="Haven <onboarding@resend.dev>"`. Utiliser uniquement un compte locataire fictif avec l’adresse du titulaire du compte Resend pour les tests ; ne pas rediriger des données de vrais locataires vers une autre adresse. Avec cet expéditeur, les autres destinataires passent automatiquement en `WAITING_DOMAIN` sans appel à Resend, jusqu’à configuration d’un expéditeur professionnel.
3. Pour envoyer à tous les locataires : ajouter un domaine possédé dans Resend, recopier les enregistrements DNS demandés, attendre la validation puis renseigner `EMAIL_FROM` avec une adresse de ce domaine. `EMAIL_REPLY_TO` peut pointer vers la boîte où Haven reçoit les réponses.
4. Renseigner `APP_ORIGIN` avec l’URL de Haven accessible aux destinataires. Le lien `.local` fonctionne uniquement sur le réseau local. Aucune publication du site n’est nécessaire pour tester les envois, mais le Mac doit rester allumé et le serveur actif.
5. Lors de l’activation, fixer `RESERVATION_EMAIL_START_AT` à l’heure UTC courante au format ISO et `RESERVATION_EMAIL_ENABLED=true`. Garder cette date fixe après les redémarrages. Seules les réservations payées à partir de cette date sont concernées : les anciens essais ne déclenchent pas une rafale d’e-mails.
6. Redémarrer le serveur. Un premier essai sans réservation réelle est disponible via `node --env-file=.env --import tsx scripts/test-reservation-email.ts` (avec `RESEND_TEST_EMAIL_TO` égal à l’adresse du titulaire du compte Resend). Effectuer ensuite une nouvelle réservation de test, vérifier l’e-mail et le PDF, puis les autres étapes avec des données fictives. Les envois réels ne sont pas validés tant que cette réception n’a pas été constatée.

Les identifiants, domaines et adresses ne sont pas configurés via le frontend. L’indicateur `/api/health` distingue la présence de la configuration du fournisseur (`emailConfigured`) de l’activation de l’automatisation (`reservationEmailsEnabled`). Il ne vérifie ni la validité de la clé ni la délivrabilité.

## Reprise et exploitation

- La tâche et la réservation / l’état des lieux sont enregistrés dans la même transaction. Une validation rejetée ne crée aucun e-mail.
- IDs fixes par réservation et événement ; la reprise d’une requête d’état des lieux ne recrée pas de tâche.
- File privée Firestore `reservation_mail_outbox`, balayée toutes les 30 secondes et au démarrage. Aucun ordonnanceur Codex n’est requis.
- Le serveur doit tourner en continu pour les rappels. Avant publication, héberger un processus persistant ou déclencher ce traitement par une tâche planifiée de l’hébergeur ; un serveur qui dort ne peut pas envoyer à l’heure.
- Réservation annulée/non payée : pas d’envoi. Rappel après séjour ou après départ anticipé : supprimé. Consignes d’arrivée devenues inutiles après EDLE : supprimées. Confirmation d’état des lieux vieille de plus de 24 h : expirée.
- Les requêtes d’envoi (y compris le PDF) sont figées dans `reservation_mail_payloads` avant la première tentative pour conserver le même contenu lors d’une reprise. Ces données ne sont pas publiques.
- Bail de traitement de cinq minutes + clé d’idempotence Resend stable. Après 20 h depuis une première tentative, les reprises ambiguës passent à `REVIEW_REQUIRED` au lieu de franchir la fenêtre d’idempotence de 24 h de Resend. Vérifier le tableau Resend avant toute relance manuelle.
- `SENT` signifie accepté par l’API Resend, pas reçu en boîte de réception. La vérification de réception passe par Resend ; le suivi automatisé des rebonds / plaintes via webhook reste à configurer sur l’hébergement public.
- Les contenus privés figés et erreurs d’envoi doivent être soumis à la politique de conservation avant mise en production.

Documentation : https://resend.com/docs/dashboard/domains/introduction ; https://resend.com/docs/api-reference/errors ; https://resend.com/changelog/idempotency-keys.

## Ajouts locataire : compte, annulation et avis

- Le mail compte est lié à la décision encore actuelle (`approvedAt`, `moderatedAt` ou dérogation de test). Une décision remplacée ou un dossier resoumis annule le mail devenu obsolète. Les décisions identiques répétées ne créent pas de nouvel envoi. Les profils propriétaires et administrateurs ne sont pas concernés par ces mails de compte.
- Les validations exceptionnelles de test sont marquées TEST ; elles ne prétendent pas à un contrôle réel des pièces. Le bannissement ne déclenche pas de nouveau mail automatique.
- L’annulation concerne les réservations déjà payées, à l’initiative du locataire ou du propriétaire ; le destinataire reste le locataire. Les brouillons non payés et expirations de paiement ne déclenchent pas cette notification. Aucun envoi n’est créé si l’annulation échoue. Les règles de remboursement restent inchangées ; le mail décrit le statut enregistré sans promettre un crédit bancaire déjà reçu.
- L’invitation est créée dans la transaction de l’EDLS, avec un ID fixe par réservation. Elle part 24 h après le départ réel, y compris anticipé. L’existence d’un avis (manuel ou automatique) et l’échéance sont revérifiées avant l’envoi. Le test de reprise ne recrée pas l’invitation.
- Ces notifications sont déclenchées seulement par de nouveaux événements enregistrés, pas par une relecture de l’historique. La date de démarrage porte sur la décision, l’annulation ou le départ pour ces trois catégories. Une notification âgée de 7 jours est expirée. La fenêtre de reprise ambiguë de 20 h et la restriction du domaine de démonstration s’appliquent également.
- Le suivi d’incidents, signalements et nouveaux messages reste manuel. Aucune notification propriétaire nouvelle n’a été ajoutée.

## Modèles Resend et mails de sécurité — 25 octobre 2026

Les onze modèles éditables sont publiés et raccordés. Le [guide de personnalisation](resend-templates/README.md) donne leurs liens. Activer `RESEND_TEMPLATES_ENABLED=true` après configuration des IDs dans `services/resendTemplates.ts`. Le contenu, l’objet et le design se modifient dans Resend puis se publient ; le serveur transmet les variables de l’événement. Les messages déjà figés dans la file avant une tentative ne sont pas réécrits lors du changement de mode. Le justificatif PDF reste attaché par Haven.

Les appels client Firebase `sendEmailVerification` et `sendPasswordResetEmail` sont remplacés par deux endpoints Haven. Firebase Admin génère les liens et Firebase continue à appliquer la confirmation ou le changement de mot de passe sur sa page sécurisée habituelle. Le serveur vérifie le domaine et le type d’action du lien et conserve le français. Les liens ne sont pas journalisés ni stockés dans l’outbox Haven ; le prestataire Resend reçoit naturellement le lien dans le mail envoyé.

La confirmation d’adresse est réservée au membre authentifié et à son adresse Firebase actuelle, identique à celle du profil et de la session. Elle ne prend pas de destinataire arbitraire dans le corps de la requête. La finalisation existante vérifie toujours `emailVerified` auprès de Firebase avant de modifier le profil. La réinitialisation publique renvoie la même réponse pour une adresse existante ou inexistante, avec une formulation conditionnelle dans l’interface. Les comptes désactivés ne reçoivent pas de réinitialisation.

Un quota IP et un quota persistant par adresse/type de mail limitent les demandes (au moins 60 secondes entre deux liens ; au plus cinq par fenêtre de 15 minutes). La collection privée `auth_mail_limits` ne contient ni lien ni adresse en clair ; configurer sa suppression TTL sur le champ `expiresAt` avant exploitation en production. Les mails de sécurité ne sont pas repris tardivement dans la file : en cas d’échec, le membre peut demander un nouveau lien. Aucun double envoi automatique Firebase/Resend n’est prévu.

Le mode démonstration Resend ne permet toujours que l’adresse du titulaire du compte. Une confirmation vers une autre adresse affiche un message explicite. Une demande de réinitialisation vers une autre adresse garde une réponse générique pour ne pas divulguer l’existence du compte, mais aucun mail ne peut partir avant validation d’un domaine. Sans configuration de templates, ces deux endpoints de sécurité sont indisponibles.

Validation : 202 tests, TypeScript et build passent. Onze modèles testés avec données fictives et indiqués `delivered` dans Resend ; le PDF accompagne la confirmation. Une réinitialisation demandée via le serveur local pour le compte de test a aussi été indiquée `delivered`, avec le modèle 11 et un lien Firebase généré. Aucun mot de passe ni statut de vérification n’a été modifié par ces essais. Le parcours complet de confirmation d’adresse attend le prochain essai utilisateur avec un compte non confirmé.

Test manuel synthétique : `node --env-file=.env --import tsx scripts/test-resend-templates.ts --all`. Les liens de sécurité de ce script sont volontairement inutilisables. L’adresse de test doit être le titulaire du compte Resend.
