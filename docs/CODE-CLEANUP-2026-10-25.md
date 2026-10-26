# Audit ciblé du code inutilisé — 25 octobre 2026

## Retiré : anciens e-mails

- Routes Resend `/api/send-verification` et `/api/verify-code`, leur stockage temporaire et le mécanisme de ticket de code.
- Ancienne route `/api/send-booking-notification` et la méthode cliente `notifications.sendBookingNotification`, sans appel depuis les écrans actuels. Les anciens modèles de demande, approbation, paiement et annulation ont été retirés avec cette route.
- La synchronisation de vérification e-mail exige toujours une preuve Firebase pour l’adresse exacte du compte authentifié. Les envois de liens Firebase et les réinitialisations de mot de passe sont conservés.
- Les cinq e-mails automatiques de réservation et le script manuel de test Resend sont conservés.

## Éléments supplémentaires retirés après accord explicite

Analyse des imports statiques, exports et imports dynamiques littéraux depuis `index.tsx`, `server.ts`, les scripts et les configurations ; recherche globale complémentaire des noms. Ce contrôle ne prétend pas prouver l’absence de toute utilisation externe au dépôt.

| Élément | Constat |
| --- | --- |
| `components/AddListingModal.tsx` | Placeholder déclaré obsolète au profit de `pages/PublishListing.tsx`, sans import |
| `components/CommuneInput.tsx` et `services/cities.ts` | Ancien duo de saisie de commune, hors du graphe de l’application |
| `components/MapsAppProvider.tsx` et `src/config.ts` | Ancienne configuration de carte hors du graphe ; le `MapsProvider` actif est distinct |
| `components/ScreenLoader.tsx` | Composant non importé par l’application |
| `components/TenantProfileModal.tsx` | Ancienne fiche locataire non importée |
| `components/MobileBottomNav.tsx` | Navigation mobile non montée dans l’application |
| `contexts/BookingContext.tsx` | Provider monté dans App, mais aucun consommateur de `useBookings` ; entretient une écoute admin ou deux écoutes propriétaire/locataire inutilisées par les écrans |
| Imports et variables inutilisés | Le compilateur avec `noUnusedLocals` et `noUnusedParameters` signale des icônes, imports et états devenus inutilisés dans plusieurs écrans. Imports non lus retirés, variables et fonctions locales sans usage supprimées. Les hooks dont les setters restent utilisés sont conservés pour préserver leurs effets et le comportement actuel. |

## Conservé intentionnellement

Préparation Stripe, simulation de paiement, jeu de données et écran de tests encore appelés, authentification par téléphone utilisée à la connexion, fonctions d’annulation et de remboursement actuelles. Aucun changement des formulaires ou de l’interface.

## Périmètre

Le contrôle automatique avait initialement refusé une suppression élargie. L’utilisateur a ensuite expressément autorisé le retrait des éléments listés, à condition de préserver l’utilisation du site. Les neuf fichiers inutilisés listés ci-dessus ont été supprimés, ainsi que le montage de BookingProvider dans App. Les écoutes propres aux tableaux de bord sont conservées.

Le fichier de tests de l’ancien service de communes a été retiré avec ce service. Les trois tests de ce service obsolète sont supprimés ; le test de proximité qui partageait ce fichier est conservé dans `tests/proximity.test.ts`. Les contrôles TypeScript `noUnusedLocals` et `noUnusedParameters` sont activés pour prévenir la réintroduction de symboles inutilisés.

Les routes d’interface, les protections d’accès, les formulaires utilisés, le calcul effectif des prix et le parcours paiement / e-mails ne sont pas modifiés par cette seconde passe.

## Vérification finale

188 tests réussis ; TypeScript sans symbole local inutilisé et compilation réussis. Aucun module de production orphelin restant selon l’analyse d’imports effectuée. Contrôle navigateur des parcours publics : accueil, recherche, fiche logement et accès à la connexion. Les espaces authentifiés sont couverts par les contrôles automatisés existants, sans modification de comptes ou de réservations réels pour cet audit.

## Prestataires inutilisés — retrait demandé

- Suppression du service Gemini et de la dépendance `@google/genai` (ainsi que ses dépendances devenues inutiles). La publication d'annonce utilise désormais `resolveCityCoordinates`, l'API publique française déjà utilisée par la recherche. Le délai réseau est borné à cinq secondes et le repli existant est conservé.
- Suppression du bloc d'avis fictifs sur les profils et de ses avatars DiceBear. Les avis des réservations et des annonces ne sont pas concernés.
- Retrait du champ `storageBucket` inutilisé de la configuration Firebase. Aucune ressource distante ni donnée Firebase n'est supprimée.
- Google Maps/Places reste préparé pour l'autocomplétion des adresses ; Stripe reste préparé pour le paiement réel. Les services utilisés par les parcours actuels restent en place.

Validation : 202 tests réussis, TypeScript et compilation de production réussis. Géolocalisation de La Rochelle vérifiée sur l'API publique. Le bundle JavaScript principal passe d'environ 2 400 Ko à 2 118 Ko.
