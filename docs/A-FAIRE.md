# Ce qu'il reste à faire pour un Haven opérationnel et professionnel

Liste établie le 6 novembre 2026, mise à jour le 17 novembre, à partir d'une revue du code, de la configuration et de [la checklist de mise en ligne](AVANT-MISE-EN-LIGNE.md), qu'elle reprend et complète. Cocher au fur et à mesure.

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

- [x] **[Paul] Choisir l'hébergeur** : **Render** (décision du 16 novembre, remplace Cloud Run choisi le 11). Raison : le serveur doit rester allumé en continu (prélèvements, expirations, mails, rapprochement Stripe), et une instance Cloud Run toujours active coûte environ 47 $/mois (simulateur Google, Paris, 1 vCPU, 1 Gio), contre 7 $/mois chez Render (0,5 processeur, 512 Mo, espace Hobby gratuit). Mémoire mesurée le 16 novembre en mode production : 165-180 Mo en fonctionnement, 235-255 Mo au démarrage, donc 512 Mo suffisent. Passer à l'instance 2 Go (25 $/mois) seulement si besoin. Vercel écarté : il ne garde pas de serveur allumé. **Firebase est conservé** pour les comptes et les données (décision du 16 novembre).
- [x] **[Code] Ajouter le démarrage de production** : `npm start`, `Dockerfile`, vérification des réglages au démarrage. Notice Cloud Run dans `docs/MISE-EN-PRODUCTION.md`, à adapter à Render (tâche suivante).
- [ ] **[Code] Préparer le déploiement sur Render** : fichier `render.yaml` (service web Node, une seule instance toujours active, `npm ci && npm run build` puis `npm start`, `TZ=Europe/Paris`, région Frankfurt, en Europe comme la base), contrôle de santé sur `/api/health`, et nouvelle notice pas à pas `docs/MISE-EN-PRODUCTION-RENDER.md` écrite pour Paul (non développeur). Point clé : Render n'est pas chez Google, il n'y a donc pas d'identifiants automatiques. Firebase Admin doit lire une clé de compte de service déposée comme « Secret File » Render (par exemple `/etc/secrets/firebase-admin.json`, pointée par `GOOGLE_APPLICATION_CREDENTIALS`). Vérifier que Firestore, Firebase Auth et la sauvegarde fonctionnent avec cette clé, et que `trust proxy` reste correct derrière le proxy de Render. Garder la notice Cloud Run comme alternative.
- [ ] **[Paul] Créer la clé Firebase pour Render** : console Firebase › Paramètres du projet › Comptes de service › Générer une nouvelle clé privée. La déposer directement dans Render (Secret File), jamais dans Git ni dans une conversation, puis supprimer le fichier téléchargé.
- [ ] **[Paul] Déployer sur Render** en suivant la nouvelle notice.
- [ ] **[Paul] Acheter et relier le nom de domaine** en HTTPS.
- [ ] **[Code] Renseigner `APP_ORIGIN`** avec l'adresse publique et vérifier tous les liens des e-mails.
- [ ] **[Paul] Saisir les secrets de production** chez l'hébergeur (jamais dans Git ni dans une conversation).
- [x] **[Code] Préparer la sauvegarde automatique de Firestore** : `scripts/firestore-backup.mjs` (`status`, `enable` : chaque jour gardée 14 jours et chaque dimanche gardée 14 semaines, `restore-test` dans une base séparée, `drop-restore-test`).
- [x] **Sauvegardes activées** le 11 novembre (chaque jour, gardée 14 jours ; chaque dimanche, gardée 14 semaines).
- [ ] **[Test] Essayer une restauration** dès la première sauvegarde (`node scripts/firestore-backup.mjs restore-test`, puis `drop-restore-test`).

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

- [x] **[Paul] Mettre à jour les conditions générales de réservation** (brouillon rédigé le 12 nov. dans `docs/juridique/`, à valider avec le juriste) : réservation récurrente, enregistrement de la carte, prélèvements automatiques un mois avant chaque arrivée, délai de 5 jours en cas d'échec, annulation séjour par séjour, séjours courts entre deux locations.
- [x] **[Code] Faire accepter explicitement le prélèvement automatique** au moment de réserver une série (case obligatoire ; texte, version et date conservés avec la série, 11 novembre).
- [ ] **[Paul] Faire relire par un juriste** : conditions générales (locataires et propriétaires), accord tripartite, mentions légales, politique de confidentialité.
- [x] **[Code] Brouillons de la politique de confidentialité et des mentions légales** (11 nov.) : `docs/juridique/`, rédigés d'après le fonctionnement réel du site.
- [x] **[Code] Jeu juridique complet rédigé** (12 nov.) dans `docs/juridique/` : conditions générales d'utilisation, conditions de réservation, conditions propriétaires, cahier des charges révisé, confidentialité, mentions légales. Vérification et publication : `node scripts/legal-documents.mjs check | preview | publish` (la publication est refusée tant qu'il reste des crochets à compléter).
- [ ] **[Paul] Trancher avec le juriste** les points encadrés « À valider » : qualification du contrat (location meublée, bail mobilité), loi Hoguet, mandat d'encaissement, TVA sur les frais de service, taxe de séjour, obligations DSA, pénalités d'annulation du propriétaire.
- [ ] **[Paul] Décider** de la part reversée au propriétaire en cas d'annulation tardive du locataire (aujourd'hui rien).
- [ ] **[Code] Faire accepter les Conditions propriétaires** à la publication d'une annonce, et le lien vers la politique de confidentialité à l'inscription, une fois publiées.
- [ ] **[Code] Statut particulier ou professionnel du propriétaire** (affiché aux locataires) et collecte des informations fiscales DAC7, avec relevé annuel au 31 janvier.
- [ ] **[Paul] Compléter ces brouillons** (société, SIREN, adresses, médiateur, région Firebase), les faire valider, puis les publier dans le back office (onglet Légal) ; **[Code]** ajouter alors le lien vers la politique sur l'inscription et en pied de page.
- [ ] **[Paul] RGPD** : registre des traitements, durées de conservation à arbitrer (propositions dans le brouillon), contrats de sous-traitance (Firebase, Stripe, Resend, hébergeur).
- [ ] **[Code] Supprimer automatiquement les données** au terme des durées de conservation retenues.
- [x] **[Code] Polices servies par le site** (11 nov.) : plus aucune adresse IP de visiteur envoyée à Google Fonts.
- [x] **[Code] Page Cookies fidèle** (11 nov.) : liste réelle de ce qui est stocké, refus de la mesure d'audience en un clic, « Do Not Track » respecté.
- [ ] **[Code] Bandeau cookies conforme** (refus aussi simple que l'acceptation) **seulement** si des cookies non essentiels sont ajoutés un jour ; inutile aujourd'hui.
- [ ] **[Paul] Statut et fiscalité de Haven** : TVA sur les frais de service, factures aux locataires, obligations de déclaration des revenus des propriétaires par la plateforme.

### Fichiers et photos : passer sur Firebase Storage

Constat du 16 novembre : il n'y a aucun stockage de fichiers. Photos et documents sont compressés puis rangés en base64 **à l'intérieur** des fiches Firestore (photos d'annonce 960 px et 45 Ko maximum par `services/images.ts`, justificatifs 600 Ko maximum par `services/verificationDocument.ts`). Conséquences : une fiche Firestore ne peut pas dépasser 1 Mio (le verso de la pièce d'identité a déjà dû être déplacé dans `identity_documents` pour cette raison ; pièce d'identité + justificatif de revenus sur le même profil dépassent la limite) ; un état des lieux photographié ne tiendrait pas dans une fiche ; la recherche télécharge les photos de toutes les annonces ; la qualité des photos est faible pour un site premium. Principe retenu : les fichiers vont dans Firebase Storage (même projet), Firestore ne garde que leur chemin.

- [ ] **[Paul] Activer Firebase Storage** : console Firebase › Storage › Commencer, emplacement en Europe proche de Firestore. Nécessite la formule à l'usage, déjà prévue plus bas (« Passer la base Firestore sur une formule payante »).
- [ ] **[Code] Règles `storage.rules`, refus par défaut**, publiées avec le reste de la configuration Firebase. Photos d'annonces : lecture publique, écriture par le propriétaire de l'annonce ou par le serveur. Documents privés (identité, justificatifs, états des lieux) : jamais lisibles publiquement ; accès limité au titulaire, aux administrateurs et, pour un état des lieux, au propriétaire du logement de la réservation. **Attention : les liens « download URL » de Firebase sont des liens publics permanents**, à ne jamais utiliser pour un document privé ; servir ces fichiers par le serveur ou par des liens signés de courte durée. Tester les règles (un inconnu, un autre locataire et un propriétaire étranger à la réservation doivent être refusés).
- [ ] **[Code] Photos de l'état des lieux** (à faire en premier, rien à migrer) : le bouton « Ajouter une photo » de `pages/EntryInventory.tsx` n'est qu'un emplacement visuel, il n'envoie rien. Le brancher sur Storage : plusieurs photos par élément, compression raisonnable (environ 1600 px, 300 Ko), aperçu et suppression avant validation, photos reprises dans le récapitulatif et le PDF éventuel, aussi pour l'état des lieux de sortie.
- [ ] **[Code] Pièces d'identité et justificatifs** : déplacer `idCard`, le verso (`identity_documents`), `proofOfAddress`, `proofOfOwnership`, `proofOfIncome` vers Storage ; le profil ne garde que le chemin et l'état de vérification. Lever la limite de 600 Ko (PDF jusqu'à 10 Mo). Script de migration des documents existants, à tester d'abord en lecture seule, puis suppression des anciennes valeurs base64. Vérifier l'affichage dans le back office (`pages/AdminDashboard.tsx`, aperçu des documents).
- [ ] **[Code] Photos des annonces et des chambres** : déplacer `mainPhotoUrl`, `galleryUrls` et `roomPhotos` vers Storage, en deux tailles (miniature d'environ 480 px pour les cartes de recherche, grande d'environ 1600 px pour la fiche), WebP conservé. Remonter la qualité (aujourd'hui 960 px / 45 Ko). Script de migration des annonces existantes. Les images des articles (`components/AdminArticles.tsx`, `services/articlesServer.ts`) peuvent suivre le même chemin, moins urgent.
- [ ] **[Test] Parcours fichiers de bout en bout** : publier une annonce avec photos, déposer pièce d'identité recto verso et justificatif PDF, faire un état des lieux d'entrée et de sortie avec photos, vérifier l'accès refusé depuis un autre compte et depuis une fenêtre non connectée.

### Données

- [ ] **[Code] Nettoyer la base avant l'ouverture** : réservations « Simulation », comptes, annonces et paiements de test.
- [ ] **[Paul] Corriger les photos en double** de l'annonce « Coloc Jeanne d'Arc ».

## 2. Important pour un site professionnel

### Sécurité technique

- [x] **[Code] Compiler Tailwind dans le projet** au lieu du CDN, puis **activer la politique de sécurité des contenus (CSP)** en production (7 novembre ; rendu identique vérifié sur 6 pages, aucune violation sur les pages publiques).
- [ ] **[Test] Vérifier la CSP sur les pages connectées** une fois en ligne : connexion Google, messagerie, paiement Stripe, publication d'annonce.
- [x] **[Code] Suivi des erreurs** (11 nov.) : erreurs imprévues du site et du serveur regroupées dans Surveillance (« Erreurs de l’application »), sans donnée personnelle ; en ligne, une alerte à l’équipe à la première apparition (10 par heure au plus).
- [x] **[Code] Boucle d'erreurs qui faisait tomber le serveur** (16 novembre) : sans accès à Firestore (clé expirée, panne), chaque erreur était enregistrée dans Firestore, ce qui en créait une nouvelle (240 000 en 50 s, 2 Go de mémoire, arrêt du serveur). Enregistrements d'erreurs et lignes de journal plafonnés à 20 par minute (`createRateGuard`, tests associés) ; serveur vérifié stable à 177 Mo dans la même situation.
- [x] **[Code] Réduire les lectures Firestore** (15 novembre) : disponibilités servies depuis une copie tenue à jour par le serveur, tâches périodiques ralenties et ciblées. Le quota gratuit (50 000 lectures/jour) avait été épuisé le 14 au soir.
- [ ] **[Paul] Passer la base Firestore sur une formule payante** (paiement à l'usage) avant l'ouverture : la base actuelle est plafonnée au quota gratuit, même avec une carte bancaire ; à ce plafond, le site entier cesse de fonctionner jusqu'au lendemain 9 h.
- [ ] **[Code] Revoir les limites de requêtes** (connexion, paiement, signalements) une fois le trafic réel connu.
- [x] **[Code] Mettre à jour les dépendances** et lancer un audit de sécurité (`npm audit`) : 29 failles → 17, dont plus aucune critique ; React Router mis à jour, `showdown` (inutilisé) retiré.
- [ ] **[Code] Suivre la mise à jour de Firebase** : les 4 failles « élevées » restantes viennent de son module gRPC interne, sans correction compatible pour l'instant.

### Mesure d'audience

- [x] **[Code] Mesure d'audience maison** (11 nov.) : onglet Audience du back office, anonyme et sans cookie (exemption CNIL).

### Performance

- [x] **[Code] Découper le fichier principal** (11 nov.) : animations de l’accueil en CSS (−120 Ko), Firebase et React dans des fichiers séparés mis en cache, données de démonstration chargées à la demande.
- [ ] **[Code] Ne charger que le nécessaire dans la recherche** (après le passage des photos sur Storage) : aujourd'hui `services/api.ts` (`getAll`) lit toute la collection `listings`, photos comprises, puis trie dans le navigateur. Filtrer par ville côté base, charger les résultats par paquets d'environ 12 (suite au défilement), n'afficher que la miniature sur les cartes, les autres photos seulement à l'ouverture ou au balayage du carrousel, images en `loading="lazy"`. Vérifier que la recherche récurrente et les filtres donnent les mêmes résultats qu'avant.
- [x] **[Code] Optimiser les images** (11 nov.) : photo d’accueil en AVIF (79 Ko au lieu de 400 Ko, 42 Ko sur téléphone), logo allégé (34 Ko au lieu de 117 Ko, aussi dans les PDF), photos des annonces en WebP quand le navigateur le permet.

### Parcours locataire

- [ ] **[Code] Recherche par adresse complète** (aujourd'hui, seulement par ville).
- [ ] **[Code] Page « Mon séjour »** qui regroupe consignes, état des lieux, messages et paiements.
- [ ] **[Code] Historique des paiements d'une série** et remplacement de la carte sans payer un séjour.
- [ ] **[Code] Modification des dates** après réservation (aujourd'hui : annuler puis réserver à nouveau).
- [x] **Caution** (13 novembre) : carte gardée par Stripe, rien de bloqué ni débité ; le propriétaire déclare une dégradation dans les 7 jours suivant le départ, le locataire répond, Haven décide dans Finances › Cautions et prélève au plus 300 €, reversés au propriétaire (`services/damageDeposit*.ts`, `components/DamageClaims.tsx`, `AdminDamageClaims.tsx`). Montant modifiable dans `DAMAGE_DEPOSIT_POLICY`.
- [ ] **[Code] Mails de la caution** : prévenir le locataire d'une déclaration (pour qu'il réponde), les deux parties de la décision, et l'équipe d'une nouvelle déclaration. Aujourd'hui, c'est visible dans les espaces et le back office seulement.
- [ ] **[Test] Tester la caution en mode test** : réservation, carte gardée, déclaration, réponse, prélèvement, versement au propriétaire, carte refusée (`4000 0000 0000 0341`).
- [ ] **[Paul] Faire valider la caution par le juriste** (bail mobilité, mandat d'encaissement) et mentionner la conservation de la carte dans la politique de confidentialité.
- [ ] **[Code] Photos des chambres en plein écran** (un clic sélectionne la chambre aujourd'hui).

### Parcours propriétaire

- [x] **[Code] Mails au propriétaire** : nouvelle réservation, série récurrente, annulation, signalement, virement effectué (modèles Resend 16 à 20, 10 novembre ; exemple de test envoyé).
- [x] **[Code] Bloquer des dates en quelques clics** pour tout le logement ou une chambre (onglet Disponibilités de la modification d'annonce, 7 novembre).
- [x] **[Code] Limiter l'annulation par le propriétaire** à 30 jours avant l'arrivée minimum, locataire remboursé à 100 % (7 novembre).
- [ ] **[Code] Calendrier d'occupation par chambre** pour voir d'un coup d'œil les séjours et les trous.
- [ ] **[Code] Relevés mensuels et factures** téléchargeables pour sa comptabilité.
- [x] **[Code] Gérer la perte des versements Stripe en cours de série** (11 nov.) : le locataire est prélevé normalement, le versement du propriétaire attend son compte complet et l’équipe Haven reçoit une alerte.
- [ ] **[Paul] Décider d'une remise** pour la récurrence ou les séjours courts entre deux locations.

### Langues

- [ ] **[Code] Masquer le sélecteur de langue** (anglais, espagnol) tant que les pages ne sont pas traduites : la plupart des pages, dont toutes celles réécrites en novembre, sont uniquement en français.
- [ ] **[Code] Traduire le site** en anglais si une clientèle internationale est visée (étudiants en échange), puis réafficher le sélecteur.

### Comptes et connexion

- [ ] **[Code] Connexion avec Google** (une documentation existe dans `docs/GOOGLE-SIGN-IN.md`).
- [ ] **[Code] Double authentification pour les administrateurs.**
- [x] **[Code] Export et effacement des données d'un membre** depuis le back office (fiche du membre : export JSON, anonymisation avec conservation des données comptables, refusée s'il reste un séjour à venir ou une annonce en ligne, 11 novembre).
- [x] **[Code] Export et suppression du compte par le membre lui-même** (11 nov.) : « Mon compte › Mes données personnelles » ; suppression avec connexion récente, justificatifs effacés, données comptables conservées sans nom.

### Signalements et incidents

- [ ] **[Test] Envoyer un vrai signalement** d'annonce et d'incident de séjour, puis suivre son traitement jusqu'au back office.
- [x] **[Code] Prévenir le propriétaire par mail** à chaque nouveau signalement.
- [x] **[Code] Prévenir l'équipe Haven par mail** de chaque nouveau signalement d'annonce, problème de séjour transmis et demande d'intervention (modèle Resend 21, 11 novembre).
- [ ] **[Paul] Choisir l'adresse de l'équipe Haven** (`HAVEN_TEAM_EMAIL`) ; en attendant, les alertes partent vers l'adresse de réponse ou ton adresse de test Resend.
- [ ] **[Paul] Définir les délais de réponse** attendus du propriétaire et de Haven, et les afficher.

### Back office

- [x] **[Code] Annuler une réservation à la place du propriétaire** depuis le back office (onglet Réservations : jusqu'au jour d'arrivée, remboursement intégral, motif obligatoire, mails et journal d'administration, 11 novembre).
- [x] **[Code] Alertes pour l'équipe Haven** : mail après 3 échecs de suite d'une tâche automatique (modèle Resend 22) ; signalements transmis (modèle 21).
- [x] **[Code] Onglet Finances** : résumé du mois et export CSV pour la comptabilité, remboursement sans annulation (pris d'abord sur la commission Haven), blocage et déblocage d'un versement, transfert relancé après vérification, échéances des séries prélevées tout de suite ou reportées (11 novembre).
- [x] **[Code] Tableau des séries récurrentes et des échéances**, avec remboursement ou nouvelle tentative de prélèvement à la main (onglet Finances).
- [x] **[Code] Suivi des mails envoyés** (onglet Surveillance : statut, destinataire, erreur, renvoi). Les rebonds signalés par Resend restent à intégrer.
- [ ] **[Paul] Rédiger les procédures internes** : litige, dégradation, annulation par le propriétaire, fraude.
- [x] **[Code] Fiche 360° d'un membre** (chiffres, chronologie complète, notes internes de l'équipe) et **modération** (suspendre ou corriger une annonce, masquer un avis avec recalcul de la note, déplacer un séjour à nombre de nuits égal), **indicateurs clés** dans Stats (11 novembre).
- [ ] **[Code] Back office, suite** : réglages modifiables sans code (commission, seuils d'annulation, minimum de nuits, délai de la récurrence), consultation encadrée d'une conversation en cas de litige, signaux de fraude, codes promo et avoirs, création d'une réservation à la main, mail au propriétaire quand son annonce est suspendue, rebonds des mails signalés par Resend.

### Automatisations

- [ ] **[Test] Vérifier que chaque tâche automatique tourne en production** : prélèvements, expirations, mails, transferts après arrivée, rapprochement Stripe, clôture des avis.
- [x] **[Code] Tableau de santé** de ces tâches (onglet Surveillance : dernière réussite, échecs, retard).

## 3. Finitions

### Textes

- [x] **Vouvoiement sur tout le site** (12 nov.) : accueil, recherche et guide de la récurrence convertis.
- [x] **[Code] Corriger les majuscules et accents irréguliers** (11 nov.).
- [x] **[Code] Retirer les codes techniques des messages** (11 nov.) : gardés en interne pour le classement des erreurs, jamais affichés.
- [x] **[Code] Pages annexes réécrites** (12 nov.) d'après le fonctionnement réel : FAQ, centre d'aide, comment ça marche, devenir propriétaire, confiance et sécurité, partenaires (fausses statistiques et coordonnées inventées retirées, formulaire réellement envoyé).
- [ ] **[Paul] Faire relire tous les textes** par une personne extérieure.

### Images et identité

- [ ] **[Paul] Logo et favicon définitifs**, images d'accueil professionnelles (droits d'utilisation vérifiés).
- [ ] **[Paul] Photos de qualité** pour les premières annonces.

### Référencement et partage

- [ ] **[Code] Adresses sans `#`** (meilleur référencement Google).
- [x] **[Code] Articles et référencement** (13 nov.) : pages `/articles` rendues par le serveur (titre, description, adresse canonique, Open Graph, données structurées, fil d’Ariane), `sitemap.xml`, `robots.txt`, flux RSS ; rédaction sans code dans le back office (onglet Articles) avec aperçu Google et contrôle du référencement.
- [ ] **[Paul] Déclarer le plan du site** (`/sitemap.xml`) dans Google Search Console une fois le domaine en ligne, et renseigner `APP_ORIGIN` avec l’adresse définitive (adresses canoniques).
- [ ] **[Code] Description du site et aperçus de partage** (Open Graph) pour les pages de l’application elle-même.
- [ ] **[Paul] Créer la fiche Google Search Console** une fois le domaine en ligne.

### Vérifications à la main, sur téléphone et ordinateur

- [ ] **[Test] Pages connectées** : tableaux de bord, compte, messagerie, paiement, publication d'annonce.
- [ ] **[Test] Fenêtre des conditions générales** dans le parcours de réservation.
- [ ] **[Test] Partage d'une annonce** sur téléphone en HTTPS (partage natif).
- [ ] **[Test] Fiche propriétaire** visible par un visiteur connecté.
- [ ] **[Test] Séjours courts entre deux locations** : recherche, fiche, réservation (règle en place et testée par le code depuis le 6 novembre).
- [ ] **[Test] Nouveaux tableaux de bord** propriétaire et locataire, et onglet Signalements.
- [ ] **[Test] Navigateurs** : Safari iPhone, Chrome Android, Chrome, Safari et Firefox sur ordinateur.

## 4. Après la mise en ligne : application iPhone et Android

Choix retenu (11 nov.) : **Capacitor**, qui emballe le site mobile actuel (même code) dans une vraie application. Hébergement prévu : domaine chez **Gandi**, serveur sur **Google Cloud Run**.

- [ ] **[Paul] Comptes développeur** : Apple Developer (99 $/an, au nom de l'entreprise) et Google Play Console (25 $ une fois).
- [ ] **[Code] Projet Capacitor** iOS et Android branché sur le serveur en ligne.
- [ ] **[Code] Retour dans l'application après le paiement Stripe** (lien profond) et connexion Google native.
- [ ] **[Code] « Se connecter avec Apple »**, exigé par Apple dès qu'une connexion Google existe.
- [x] **[Code] Suppression du compte par le membre lui-même**, exigée par Apple (fait le 11 nov., « Mon compte »).
- [ ] **[Code] Notifications push** (confirmation, prélèvement à venir, arrivée) et appareil photo natif pour les états des lieux.
- [ ] **[Paul] Fiches des boutiques** : icône, captures, description, politique de confidentialité, compte de démonstration pour la validation Apple.

## 5. Pour faire grandir le site

- [ ] **[Code] Pages par ville** (« Colocation à Lyon », « Colocation à Bordeaux »…), générées automatiquement à partir des annonces en ligne, rendues par le serveur comme les articles et ajoutées au plan du site : levier n°1 du référencement local.
- [ ] **[Code] Alerte « Prévenez-moi »** : un locataire qui ne trouve rien reçoit un e-mail dès qu'une chambre se libère dans sa ville à ses dates.
- [ ] **[Code] Avis des locataires sur l'accueil**, dès les premiers séjours, pour rassurer les nouveaux visiteurs.
- [ ] **[Paul] Décider d'un parrainage** (locataires ou propriétaires), puis **[Code]** le mettre en place avec un lien personnel et son suivi dans le back office.
- [ ] **[Paul] Écrire les premiers articles** (au moins 600 mots, deux ou trois intertitres, un mot-clé précis dans le titre) depuis l'onglet Articles du back office.

## Références

[Checklist de mise en ligne](AVANT-MISE-EN-LIGNE.md) · [Paiement](PAYMENTS.md) · [E-mails](EMAILS.md) · [Modèles Resend](resend-templates/README.md)
