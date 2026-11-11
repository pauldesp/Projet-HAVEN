# Politique de confidentialité de Haven

> **BROUILLON du 11 novembre 2026 — à compléter et à faire valider par un juriste avant publication.**
> Rédigé d'après le fonctionnement réel du site à cette date. Les passages entre crochets `[…]` sont à compléter ; les durées marquées « proposition » sont à arbitrer.
> Une fois validé, le publier depuis le back office (onglet Légal) avec l'identifiant `politique-de-confidentialite`, puis ajouter le lien sur la page d'inscription.

Dernière mise à jour : [date de publication]

## 1. Qui est responsable de vos données ?

Le responsable du traitement est **[raison sociale]**, [forme juridique] au capital de [montant] €, immatriculée au RCS de [ville] sous le numéro [SIREN], dont le siège est situé [adresse], éditrice du site Haven (ci-après « Haven »).

Pour toute question sur vos données : **[adresse e-mail dédiée, par exemple confidentialite@…]** ou par courrier à l'adresse ci-dessus.
[Si un délégué à la protection des données est désigné : ses coordonnées.]

## 2. Quelles données collectons-nous, et pourquoi ?

| Ce que vous faites | Données concernées | Pourquoi | Base légale |
|---|---|---|---|
| Créer un compte | Prénom, nom, e-mail, téléphone, mot de passe (jamais lisible par Haven), photo de profil | Vous identifier et vous permettre d'utiliser le service | Exécution du contrat |
| Faire vérifier votre compte | Pièce d'identité, date de naissance, adresse de domicile et justificatif, informations professionnelles ou étudiantes demandées | Garantir la confiance entre membres et prévenir la fraude, avant toute réservation ou publication | Intérêt légitime de Haven et de ses membres ; exécution du contrat |
| Compléter votre profil public | Prénom, âge, activité, centres d'intérêt, présentation | Permettre aux futurs colocataires de se connaître | Exécution du contrat |
| Réserver un logement (locataire) | Dates, chambre, montants, historique des séjours, accord pour les prélèvements automatiques (texte et date) | Gérer la réservation, la série de séjours et les paiements | Exécution du contrat |
| Payer | Les données de carte sont saisies et conservées **uniquement par Stripe** ; Haven ne voit que la marque, les 4 derniers chiffres et le statut du paiement | Encaisser et rembourser | Exécution du contrat |
| Publier une annonce (propriétaire) | Adresse du logement, photos, descriptions, disponibilités, consignes d'accès | Présenter le logement et organiser les arrivées | Exécution du contrat |
| Recevoir vos revenus (propriétaire) | Identité et coordonnées bancaires, collectées et vérifiées **par Stripe** (Stripe Connect) | Vous verser votre part des séjours | Exécution du contrat ; obligations légales de Stripe |
| États des lieux | Photos, constats, signatures, dates | Prouver l'état du logement à l'arrivée et au départ | Exécution du contrat ; intérêt légitime (preuve en cas de litige) |
| Messagerie, signalements, incidents | Contenu des messages, photos jointes, description du problème | Échanger entre membres, traiter les difficultés et litiges | Exécution du contrat ; intérêt légitime |
| Avis | Note et commentaire | Informer les autres membres | Intérêt légitime |
| E-mails de service | Adresse e-mail, contenu des messages envoyés | Confirmations, rappels, prélèvements, sécurité du compte | Exécution du contrat |
| E-mails d'information (si vous l'avez accepté) | Adresse e-mail | Actualités et offres de Haven | Consentement, retirable à tout moment |
| Navigation | Voir la section 8 (mesure d'audience anonyme) | — | — |

Les champs obligatoires sont signalés dans les formulaires. Sans eux, le service correspondant ne peut pas être fourni.

**Décision automatisée :** aucune. La validation des comptes et des annonces est faite par une personne de l'équipe Haven.

## 3. Qui peut voir vos données ?

- **Les autres membres** voient uniquement votre profil public (prénom, initiale du nom, âge, activité, présentation, avis). Les colocataires d'un même logement aux mêmes dates se voient mutuellement. Le propriétaire voit les informations utiles au séjour de ses locataires ; les consignes d'accès d'une chambre ne sont envoyées qu'à son locataire.
- **L'équipe Haven**, pour la vérification des comptes, le support, la modération et la comptabilité, avec des accès limités et tracés.
- **Nos sous-traitants**, uniquement pour fournir le service :

| Prestataire | Rôle | Localisation des données |
|---|---|---|
| Google (Firebase, Google Cloud) | Hébergement du site, base de données, connexion | [Région à vérifier dans la console Firebase, par exemple europe-west] ; société américaine |
| Stripe | Paiements, enregistrement des cartes, versements aux propriétaires | Union européenne et États-Unis |
| Resend | Envoi des e-mails automatiques | États-Unis |
| [Gandi] | Nom de domaine | France |

Les transferts hors de l'Union européenne sont encadrés par le cadre de protection des données UE–États-Unis (Data Privacy Framework) lorsque le prestataire y est certifié, et à défaut par les clauses contractuelles types de la Commission européenne. [À vérifier pour chaque prestataire.]

- **Les autorités**, uniquement sur demande légale.

**Haven ne vend jamais vos données** et ne les utilise pas à des fins publicitaires.

## 4. Combien de temps les gardons-nous ?

| Données | Durée (proposition) |
|---|---|
| Compte et profil | Tant que le compte est actif ; supprimés 3 ans après la dernière connexion, après un e-mail d'avertissement |
| Pièce d'identité et justificatif de domicile | Tant que le compte est actif, pour permettre une nouvelle vérification ; supprimés à la suppression du compte |
| Réservations, paiements, factures, accords de prélèvement | 10 ans (obligations comptables, article L123-22 du Code de commerce), sans votre nom après suppression du compte |
| États des lieux et incidents | 5 ans après la fin du séjour (délai de prescription civile) |
| Messages | 3 ans après le dernier séjour concerné |
| Signalements traités | 3 ans |
| Mesure d'audience | Aucune donnée personnelle ; totaux quotidiens gardés 25 mois |

> Note interne : la suppression automatique selon ces durées n'est pas encore programmée (voir `docs/A-FAIRE.md`).

## 5. Vos droits

Vous disposez des droits d'accès, de rectification, d'effacement, de limitation, d'opposition et de portabilité de vos données, ainsi que du droit de définir des directives sur leur sort après votre décès.

- **Depuis « Mon compte »**, vous pouvez à tout moment modifier vos informations, **télécharger toutes vos données** (fichier JSON) et **supprimer votre compte**. Les réservations et paiements passés sont alors conservés sans votre nom pour les obligations légales.
- Pour tout autre demande : [adresse e-mail dédiée]. Nous répondons sous un mois. Une preuve d'identité peut être demandée en cas de doute.
- Vous pouvez retirer à tout moment votre consentement aux e-mails d'information.
- Si vous estimez que vos droits ne sont pas respectés, vous pouvez saisir la **CNIL** (www.cnil.fr).

## 6. Sécurité

Les échanges sont chiffrés (HTTPS). L'accès aux données est limité par des règles de sécurité : chaque membre ne peut lire que ses propres données privées, et les justificatifs ne sont visibles que par leur titulaire et l'équipe Haven. Les numéros de carte ne transitent jamais par Haven. Les actions sensibles de l'équipe sont journalisées. [Mentionner la double authentification des comptes d'administration une fois activée.]

## 7. Mineurs

Haven est réservé aux personnes majeures. [À confirmer.]

## 8. Cookies et mesure d'audience

Haven n'utilise **aucun cookie publicitaire** ni outil de suivi d'un site à l'autre. Le détail de ce qui est enregistré sur votre appareil figure sur la page **Cookies**.

Haven mesure son audience avec son propre outil, conçu pour être exempté de consentement selon les recommandations de la CNIL. Il ne dépose pas de cookie, ne transmet rien à un tiers et ne conserve ni identifiant ni adresse IP. Seuls des totaux par jour sont gardés : type de page consultée, site d'origine, type d'appareil, ville recherchée et étapes du parcours de réservation. Vous pouvez refuser d'être compté depuis la page Cookies, et les demandes « Do Not Track » ou « Global Privacy Control » de votre navigateur sont respectées.

Lors d'un paiement, la page de Stripe peut déposer ses propres cookies, nécessaires à la sécurité du paiement.

## 9. Modifications

Toute modification importante de cette politique vous sera signalée par e-mail ou sur le site avant son entrée en vigueur.
