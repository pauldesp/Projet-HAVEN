# Adaptation mobile — 26 octobre 2026

Le smartphone est le format de référence. Les mises en page de bureau sont conservées aux points de rupture existants (768 et 1024 px).

## Parcours adaptés

- Navigation basse : recherche, espace personnel, messages, compte. Menu du compte commun aux formats mobile et bureau, avec langue, profil, changement de rôle et déconnexion.
- Accueil : recherche de ville et de dates directement disponible sur téléphone.
- Recherche : modification des critères sur place, filtres repliables sur petit écran et barre latérale fixe réservée aux grands écrans.
- Logement : toutes les photos accessibles dans une galerie tactile, calendrier compact, accès rapide à la réservation au-dessus de la navigation basse.
- Espaces locataire/propriétaire : onglets défilants, cartes et marges adaptées. Réservations, virements, paiements et incidents présentés sous forme de fiches étiquetées sur téléphone.
- Messagerie : champ qui peut rétrécir, messages longs repliés, hauteur liée au viewport visuel et au clavier, défilement réservé aux messages.
- États des lieux : contrôles tactiles, questions Oui/Non empilées, preuve photo et validation accessibles ; signature tactile sur le parcours dédié.
- Publication/édition : formulaires, actions fixes, gestion des photos et lecture des conditions adaptés aux petits écrans.
- Compte/documents : fenêtres bornées par la hauteur visible, zones de lecture défilantes et téléchargements conservés.
- Administration : tableaux convertis en fiches ; filtres et tris d’en-tête conservés sur mobile.
- Chargement : les pages hors accueil sont chargées à la demande ; les outils d’administration et l’éditeur riche ne sont plus téléchargés avec l’accueil.
- Socle : saisies de 16 px sur téléphone pour limiter le zoom automatique iOS, zones tactiles agrandies, respect des zones sûres et des préférences de réduction des animations.

## Vérification

- Suite automatique : 237 tests réussis, dont réservation/paiement, entrée/sortie, documents, messagerie, incidents, confidentialité et finances.
- TypeScript et compilation de production : exécutés après les adaptations.
- Aucune réservation, aucun paiement et aucun message réel n’ont été envoyés pour ces vérifications.

## Recette sur appareils à terminer

Ces tests techniques ne constituent pas une validation visuelle sur téléphone réel. Avant de revendiquer une couverture complète, vérifier Safari iOS et Chrome Android, en portrait et paysage, notamment aux largeurs de 320, 375, 390 et 430 px, puis tablette et bureau.

Vérifier en particulier le clavier ouvert dans la messagerie et les formulaires, les photos depuis la photothèque/l’appareil photo, les PDF téléchargés, les conditions imbriquées dans la réservation, les fenêtres sur écran court et les retours de paiement. Le parcours bancaire réel dépend toujours de la configuration Stripe documentée dans PAYMENTS.md.
