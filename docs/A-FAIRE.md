# Ce qu'il reste à faire pour un Haven opérationnel et professionnel

Liste établie le 6 novembre 2026, mise à jour le 10 novembre, à partir d'une revue du code, de la configuration et de [la checklist de mise en ligne](AVANT-MISE-EN-LIGNE.md), qu'elle reprend et complète. Cocher au fur et à mesure.

Légende : **[Paul]** à faire par toi (comptes, contrats, décisions), **[Code]** développement, **[Test]** vérification à la main.

## 1. Bloquant avant toute mise en ligne

### Sécurité

- [x] **[Code] Interdire la création de réservation depuis le navigateur** dans `firestore.rules` (règle `bookings` → `allow create`). Aujourd'hui, un locataire vérifié peut écrire une réservation au prix de son choix (1 € par exemple), la payer, et réserver des dates déjà prises. Le site passe déjà par le serveur : rien ne casse.
- [x] **[Code] Resserrer les autres règles Firestore** (7 novembre) : profils privés lisibles seulement par leur titulaire et les administrateurs (les autres membres passent par une vue limitée du serveur) ; disponibilités, états des lieux et justificatifs écrits par le serveur seulement ; messages limités au locataire et au propriétaire d'une réservation ; note et nombre d'avis non modifiables par le propriétaire ; suppression d'annonce réservée aux administrateurs.
- [x] **[Code] Publier les règles Firestore** sur la base du projet (7 novembre, 00 h 13). Compilation validée par Firebase ; pages publiques vérifiées après publication. Les règles précédentes (29 septembre) restent disponibles pour un retour arrière.
- [ ] **[Test] Vérifier les pages connectées avec les nouvelles règles** : tableaux de bord, messagerie (nom et photo de l'autre personne), carte du propriétaire sur une fiche, modification d'annonce, blocage de dates.
- [x] **[Code] Faire revalider une annonce modifiée** : un propriétaire peut aujourd'hui changer photos, textes et prix d'une annonce validée sans nouveau contrôle.
- [ ] **[Paul] Activer la double authentification** sur les comptes Google/Firebase, Stripe, Resend, GitHub et l'hébergeur.
- [ ] **[Paul] Vérifier qui a accès** à Firebase, Stripe et Resend ; retirer les accès inutiles.

### Hébergement

- [ ] **[Paul] Choisir l'hébergeur.** Le serveur doit rester allumé en continu (prélèvements, expirations, mails, rapprochement Stripe toutes les minutes) : par exemple Cloud Run avec une instance toujours active, ou un petit serveur. Pas d'hébergement qui se met en veille.
- [ ] **[Code] Ajouter le démarrage de production** (script `start`, configuration de l'hébergeur, variables d'environnement).
- [ ] **[Paul] Acheter et relier le nom de domaine** en HTTPS.
- [ ] **[Code] Renseigner `APP_ORIGIN`** avec l'adresse publique et vérifier tous les liens des e-mails.
- [ ] **[Paul] Saisir les secrets de production** chez l'hébergeur (jamais dans Git ni dans une conversation).
- [ ] **[Code] Mettre en place une sauvegarde automatique de Firestore** et tester une restauration.

### Paiements Stripe

- [ ] **[Paul] Faire valider le compte Stripe et la plateforme Connect** en mode réel (informations de l'entreprise, compte bancaire de Haven).
- [ ] **[Paul] Créer les deux webhooks live** (paiements et Connect) avec leurs secrets. Événements nécessaires : `checkout.session.completed`, `checkout.session.async_payment_succeeded`, `payment_intent.succeeded` (récurrence), `refund.created`, `refund.updated`, `refund.failed`, et ceux de Connect (comptes, transferts, virements).
- [ ] **[Paul] Remplacer les clés de test par les clés live** sur l'hébergement uniquement.
- [ ] **[Test] Faire un parcours complet en mode test** : paiement d'un séjour, état des lieux d'entrée, transfert au propriétaire après l'arrivée, virement, annulation et remboursement.
- [ ] **[Test] Tester la récurrence en mode test** : série réservée, carte enregistrée, séjour prélevé juste après (arrivée à moins d'un mois), carte refusée (`4000 0000 0000 0341`), authentification demandée (`4000 0027 6000 3184`), relance, annulation après 5 jours.
- [ ] **[Test] Faire un premier paiement réel de faible montant**, puis le rembourser.

### E-mails Resend

- [ ] **[Paul] Ajouter un domaine Haven dans Resend** et valider les enregistrements DNS (SPF, DKIM, DMARC).
- [ ] **[Paul] Choisir les adresses** d'expédition (`EMAIL_FROM`) et de réponse (`EMAIL_REPLY_TO`). L'expéditeur actuel `onboarding@resend.dev` ne délivre qu'à ton adresse.
- [x] **[Code] Créer les modèles Resend des quatre mails de récurrence** (série confirmée, rappel de prélèvement, prélèvement échoué, séjour annulé faute de paiement). Ils utilisent pour l'instant la mise en page Haven du code.
- [ ] **[Test] Tester la confirmation d'adresse e-mail** avec un compte non confirmé, et une vraie réinitialisation de mot de passe sur un compte de test.
- [ ] **[Test] Vérifier un séjour de bout en bout** : confirmation et justificatif PDF, consignes à 72 h (ou dès confirmation si tardive), entrée enregistrée, rappel de départ, départ enregistré, invitation à laisser un avis.
- [ ] **[Test] Vérifier les décisions sur le dossier** (validé, à corriger) et l'annulation avec son remboursement.
- [ ] **[Code] Configurer la suppression automatique (TTL)** de `auth_mail_limits` sur `expiresAt`.

### Juridique

- [ ] **[Paul] Mettre à jour les conditions générales de réservation** : réservation récurrente, enregistrement de la carte, prélèvements automatiques un mois avant chaque arrivée, délai de 5 jours en cas d'échec, annulation séjour par séjour, séjours courts entre deux locations.
- [ ] **[Code] Faire accepter explicitement le prélèvement automatique** au moment de réserver une série (case dédiée).
- [ ] **[Paul] Faire relire par un juriste** : conditions générales (locataires et propriétaires), accord tripartite, mentions légales, politique de confidentialité.
- [ ] **[Paul] RGPD** : registre des traitements, durée de conservation des pièces d'identité, photos et états des lieux, sous-traitants (Firebase, Stripe, Resend, hébergeur).
- [ ] **[Code] Bandeau cookies conforme** (refus aussi simple que l'acceptation) si des cookies non essentiels sont ajoutés.
- [ ] **[Paul] Statut et fiscalité de Haven** : TVA sur les frais de service, factures aux locataires, obligations de déclaration des revenus des propriétaires par la plateforme.

### Données

- [ ] **[Code] Nettoyer la base avant l'ouverture** : réservations « Simulation », comptes, annonces et paiements de test.
- [ ] **[Paul] Corriger les photos en double** de l'annonce « Coloc Jeanne d'Arc ».

## 2. Important pour un site professionnel

### Sécurité technique

- [x] **[Code] Compiler Tailwind dans le projet** au lieu du CDN, puis **activer la politique de sécurité des contenus (CSP)** en production (7 novembre ; rendu identique vérifié sur 6 pages, aucune violation sur les pages publiques).
- [ ] **[Test] Vérifier la CSP sur les pages connectées** une fois en ligne : connexion Google, messagerie, paiement Stripe, publication d'annonce.
- [ ] **[Code] Ajouter un suivi des erreurs** en production (Sentry ou équivalent) et des alertes.
- [ ] **[Code] Revoir les limites de requêtes** (connexion, paiement, signalements) une fois le trafic réel connu.
- [x] **[Code] Mettre à jour les dépendances** et lancer un audit de sécurité (`npm audit`) : 29 failles → 17, dont plus aucune critique ; React Router mis à jour, `showdown` (inutilisé) retiré.
- [ ] **[Code] Suivre la mise à jour de Firebase** : les 4 failles « élevées » restantes viennent de son module gRPC interne, sans correction compatible pour l'instant.

### Performance

- [ ] **[Code] Découper le fichier principal** (environ 1 Mo) pour accélérer l'ouverture sur mobile.
- [ ] **[Code] Optimiser les images** (WebP ou AVIF, tailles adaptées au téléphone).

### Parcours locataire

- [ ] **[Code] Recherche par adresse complète** (aujourd'hui, seulement par ville).
- [ ] **[Code] Page « Mon séjour »** qui regroupe consignes, état des lieux, messages et paiements.
- [ ] **[Code] Historique des paiements d'une série** et remplacement de la carte sans payer un séjour.
- [ ] **[Code] Modification des dates** après réservation (aujourd'hui : annuler puis réserver à nouveau).
- [ ] **[Paul] Décider de la caution par empreinte bancaire** (montant, moment, conditions), puis **[Code]** l'activer.
- [ ] **[Code] Photos des chambres en plein écran** (un clic sélectionne la chambre aujourd'hui).

### Parcours propriétaire

- [x] **[Code] Mails au propriétaire** : nouvelle réservation, série récurrente, annulation, signalement, virement effectué (modèles Resend 16 à 20, 10 novembre ; exemple de test envoyé).
- [x] **[Code] Bloquer des dates en quelques clics** pour tout le logement ou une chambre (onglet Disponibilités de la modification d'annonce, 7 novembre).
- [x] **[Code] Limiter l'annulation par le propriétaire** à 30 jours avant l'arrivée minimum, locataire remboursé à 100 % (7 novembre).
- [ ] **[Code] Calendrier d'occupation par chambre** pour voir d'un coup d'œil les séjours et les trous.
- [ ] **[Code] Relevés mensuels et factures** téléchargeables pour sa comptabilité.
- [ ] **[Code] Gérer la perte des versements Stripe en cours de série** : si le compte du propriétaire n'est plus prêt, ne pas annuler le séjour du locataire à tort.
- [ ] **[Paul] Décider d'une remise** pour la récurrence ou les séjours courts entre deux locations.

### Comptes et connexion

- [ ] **[Code] Connexion avec Google** (une documentation existe dans `docs/GOOGLE-SIGN-IN.md`).
- [ ] **[Code] Double authentification pour les administrateurs.**
- [ ] **[Code] Suppression du compte et export des données** par l'utilisateur (RGPD).

### Signalements et incidents

- [ ] **[Test] Envoyer un vrai signalement** d'annonce et d'incident de séjour, puis suivre son traitement jusqu'au back office.
- [x] **[Code] Prévenir le propriétaire par mail** à chaque nouveau signalement.
- [ ] **[Code] Prévenir l'équipe Haven par mail** des signalements qui lui sont transmis et des demandes d'intervention.
- [ ] **[Paul] Définir les délais de réponse** attendus du propriétaire et de Haven, et les afficher.

### Back office

- [ ] **[Code] Annuler une réservation à la place du propriétaire** depuis le back office (sous 30 jours, le propriétaire ne peut plus le faire seul).
- [ ] **[Code] Alertes pour l'équipe Haven** : mails bloqués, prélèvements échoués, versements en attente, signalements transmis.
- [ ] **[Code] Tableau des séries récurrentes et des échéances**, avec remboursement ou nouvelle tentative de prélèvement à la main.
- [ ] **[Code] Suivi des mails envoyés** (statut, rebonds, renvoi).
- [ ] **[Paul] Rédiger les procédures internes** : litige, dégradation, annulation par le propriétaire, fraude.

### Automatisations

- [ ] **[Test] Vérifier que chaque tâche automatique tourne en production** : prélèvements, expirations, mails, transferts après arrivée, rapprochement Stripe, clôture des avis.
- [ ] **[Code] Tableau de santé** de ces tâches (dernière exécution, erreurs).

## 3. Finitions

### Textes

- [ ] **[Paul] Choisir tutoiement ou vouvoiement** pour tout le site ; **[Code]** uniformiser (l'accueil et la récurrence tutoient, les espaces personnels vouvoient).
- [ ] **[Code] Corriger les majuscules et accents irréguliers** (« Mes Favoris », « Certificat de Conformité »…).
- [ ] **[Code] Retirer les codes techniques des messages** (« (Erreur 403) », « (Erreur 422) »).
- [ ] **[Paul] Faire relire tous les textes** par une personne extérieure.

### Images et identité

- [ ] **[Paul] Logo et favicon définitifs**, images d'accueil professionnelles (droits d'utilisation vérifiés).
- [ ] **[Paul] Photos de qualité** pour les premières annonces.

### Référencement et partage

- [ ] **[Code] Adresses sans `#`** (meilleur référencement Google).
- [ ] **[Code] Description du site, aperçus de partage** (Open Graph), `robots.txt` et sitemap.
- [ ] **[Paul] Créer la fiche Google Search Console** une fois le domaine en ligne.

### Vérifications à la main, sur téléphone et ordinateur

- [ ] **[Test] Pages connectées** : tableaux de bord, compte, messagerie, paiement, publication d'annonce.
- [ ] **[Test] Fenêtre des conditions générales** dans le parcours de réservation.
- [ ] **[Test] Partage d'une annonce** sur téléphone en HTTPS (partage natif).
- [ ] **[Test] Fiche propriétaire** visible par un visiteur connecté.
- [ ] **[Test] Séjours courts entre deux locations** : recherche, fiche, réservation (règle en place et testée par le code depuis le 6 novembre).
- [ ] **[Test] Nouveaux tableaux de bord** propriétaire et locataire, et onglet Signalements.
- [ ] **[Test] Navigateurs** : Safari iPhone, Chrome Android, Chrome, Safari et Firefox sur ordinateur.

## Références

[Checklist de mise en ligne](AVANT-MISE-EN-LIGNE.md) · [Paiement](PAYMENTS.md) · [E-mails](EMAILS.md) · [Modèles Resend](resend-templates/README.md)
