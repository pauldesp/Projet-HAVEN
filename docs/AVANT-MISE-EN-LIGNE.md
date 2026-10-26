# À rappeler avant la mise en ligne de Haven

Demande de Paul du 25 octobre 2026 : conserver ces points et les lui rappeler lorsque la préparation de la mise en ligne commence. Ils ne bloquent pas les essais locaux actuels.

## E-mails Resend

- [ ] Choisir un domaine possédé par Haven, l'ajouter dans Resend et valider les enregistrements DNS demandés.
- [ ] Configurer l'adresse d'expédition professionnelle (`EMAIL_FROM`) et la boîte de réponse (`EMAIL_REPLY_TO`). Le mode actuel `onboarding@resend.dev` reste limité à l'adresse du titulaire Resend.
- [ ] Remplacer l'URL locale par l'URL publique dans `APP_ORIGIN` et vérifier les liens des onze modèles.
- [ ] Tester la confirmation complète de l'adresse avec un compte non confirmé, puis la réinitialisation complète du mot de passe sur un compte de test.
- [ ] Vérifier un séjour de bout en bout : confirmation et justificatif PDF, consignes à 72 h (ou dès confirmation pour une réservation tardive), entrée enregistrée, rappel de départ, départ enregistré et invitation à laisser un avis.
- [ ] Vérifier également les décisions sur le dossier et l'annulation, avec les informations de remboursement enregistrées.
- [ ] Prévoir un traitement persistant de la file d'envoi sur l'hébergement, le suivi des échecs/rebonds et la conservation des données ; configurer la suppression TTL de `auth_mail_limits` sur `expiresAt`.

État au 25 octobre : onze modèles publiés et raccordés à l'aperçu local, onze tests fictifs indiqués distribués par Resend ; demande réelle de réinitialisation testée sur l'adresse du titulaire, sans changer son mot de passe. La confirmation effective d'adresse attend un compte non confirmé.

## Paiement

- [ ] Configurer et sécuriser Stripe avant publication, comme demandé précédemment. Les paiements sont actuellement simulés.

Références : [e-mails](EMAILS.md), [personnalisation des modèles](resend-templates/README.md), [paiement](PAYMENTS.md).
