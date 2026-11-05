# Reprise du développement Haven — 5 novembre 2026

## Projet et lancement

- Dossier local : `/Users/paul_desp/Documents/ChatGPT/Haven`.
- Dépôt : https://github.com/pauldesp/Projet-HAVEN, branche `main`.
- Application React / TypeScript / Vite, serveur Node Express, Firebase et Stripe.
- `npm run dev` lance l’application et son API sur le port 3000. En configuration Stripe test, le script lance aussi le relais local Stripe CLI.
- `npm run check` vérifie les types, les tests et la compilation.
- Les secrets sont dans `.env` et les fichiers locaux exclus de Git. Ils ne sont pas disponibles dans un clone GitHub : les configurer par un canal privé, sans les publier ni les afficher dans les conversations.
- Sur ce Mac, aperçu mobile : `http://macbook-pro-de-desplanques.local:3000/`, sur le même Wi-Fi. `localhost` sur le téléphone désigne le téléphone et ne pointe pas vers le Mac.

## État fonctionnel

- Recherche unique et recherche récurrente connectées aux logements et disponibilités réels. Ville sélectionnée par autocomplétion ; les adresses complètes ne sont pas encore recherchées par un service de géocodage d’adresses.
- La récurrence permet de renseigner plusieurs plages indépendantes et compare aussi les logements disponibles pour une partie du planning. Les périodes, les éventuels décalages et les compléments disponibles sont indiqués.
- Les réservations, blocages du logement et blocages de chaque chambre déterminent les disponibilités. Les quatre annonces vérifiées le 4 novembre exigeaient quatre nuits minimum ; un séjour trop court est distingué d’une chambre occupée.
- Les cartes de recherche récurrente montrent le prix moyen par nuit, frais inclus, et les périodes disponibles. Le détail des séjours est regroupé dans le panneau de réservation de la fiche logement.
- Ce panneau conserve les cartes par séjour : un clic sélectionne la période et déplie les dates et frais. Le calendrier de gauche affiche toutes les périodes recherchées ; le séjour consulté est bleu, les autres sont roses avec les repères S1, S2, etc.
- Sur mobile, les résultats commencent par une barre compacte lieu/dates et un bouton de filtres. Le formulaire de modification est replié par défaut. Le nombre de logements n’est plus affiché ; l’encart sans résultat dans la ville est compact.
- Les photos principales des annonces défilent horizontalement sur mobile directement dans les résultats. De petits points sans fond sombre servent de repères ; un toucher simple ouvre toujours la fiche.
- Le formulaire de connexion corrige automatiquement majuscules et accents des e-mails, y compris collés. Autocorrection, capitalisation automatique et correction orthographique sont désactivées sur ces champs. Le lien « Retour au site » en double a été retiré ; la flèche dans le formulaire est conservée.
- La recherche d’accueil a été resserrée. Textes de champ : « Rechercher une ville ou une adresse » et « Sélectionner les dates ». Sur mobile, les deux textes d’aide font 14 px ; le second n’est plus gras.

## Paiements : distinction essentielle

**L’échéancier récurrent est uniquement prévisionnel. Il ne programme aucun prélèvement Stripe et ne réserve pas toutes les périodes ensemble.** Chaque séjour suit encore son propre parcours de réservation et de paiement.

Règle souhaitée pour la suite : premier séjour payé à la réservation, suivants un mois avant leur arrivée, ou immédiatement si leur échéance est déjà passée. Le calcul d’affichage gère les fins de mois. Les montants des périodes autres que celle sélectionnée restent des estimations au tarif de chambre disponible le plus bas.

Stripe Connect et son environnement de test existent déjà dans le projet. L’objectif métier est que Haven supporte les frais Stripe sur ses frais de plateforme et déclenche le transfert au propriétaire après l’arrivée. Vérifier les services et les webhooks avant toute évolution ; ne pas confondre transfert au propriétaire et prélèvement du locataire.

Les conditions futures propres à la récurrence, les remises, la caution par empreinte bancaire et le bail mobilité restent à préciser. Les seuils d’annulation actuellement codés sont 100 % à au moins 30 jours, 50 % entre 14 et 29 jours, puis aucun remboursement en dessous de 14 jours, selon les conditions applicables à la réservation. Les modifications automatiques de réservations ne sont pas encore disponibles.

## Fichiers utiles

- `components/HomeSearchPreview.tsx` et `.css` : recherche d’accueil.
- `pages/SearchPage.tsx` : résultats, classement et filtres.
- `components/ListingCard.tsx` et `ListingPhotoCarousel.tsx` : cartes et photos.
- `components/DateRangePicker.tsx` et `ListingCalendar.tsx` : calendriers.
- `pages/ListingDetails.tsx` : chambre sélectionnée, périodes et échéancier.
- `services/availability.ts`, `recurringSearch.ts`, `recurringPaymentSchedule.ts` : logique associée.
- `pages/RecurringBookingGuide.tsx` : explications accessibles depuis le petit lien d’infos.
- `pages/LoginPage.tsx`, `services/accountEntry.ts` : saisie et vérification des identifiants.

## Git et déploiement

La sauvegarde demandée concerne le code local et GitHub ; elle ne constitue pas un déploiement du site. La base Firebase et les paramètres externes Stripe/Firebase ne sont pas sauvegardés par un commit Git.

L’envoi Git HTTPS depuis le terminal n’a pas d’identifiant utilisable dans cette session. Les dernières sauvegardes ont donc été envoyées avec le connecteur GitHub, puis les arbres local/distant ont été comparés et synchronisés. Ne pas afficher ni intégrer de jeton pour contourner ce point.
