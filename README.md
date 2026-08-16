# HAVEN - Plateforme de Colocation Courte Durée

Bienvenue dans le code source de la Phase 1 & 2 de HAVEN. Ce projet est une Single Page Application (SPA) construite avec React, TypeScript et TailwindCSS.

## 🏗 Structure du Projet

Voici comment j'ai organisé le code pour qu'il soit propre et scalable :

*   **`index.html`** : Le point d'entrée. C'est ici que j'ai configuré **TailwindCSS** pour utiliser ta charte graphique (Bleu Nuit, Framboise, Blanc Cassé) et chargé les polices **DM Sans** et **Inter**.
*   **`App.tsx`** : Le cerveau de l'application. Il gère le routing (navigation entre les pages) et l'état global (qui est connecté ?).
*   **`types.ts`** : Le dictionnaire. J'y ai défini à quoi ressemble un `User`, une `Listing` (logement), une `Room`, pour que TypeScript nous aide à ne pas faire d'erreurs.
*   **`services/mockData.ts`** : Les fausses données. Pour le moment, pas de base de données réelle. J'ai créé des objets statiques pour que tu puisses voir l'interface remplie.
*   **`components/`** : Les briques LEGO réutilisables.
    *   `Button.tsx` : Un bouton standardisé.
    *   `Header.tsx` : La barre de navigation intelligente (change si on est connecté).
    *   `ListingCard.tsx` : La carte qui affiche un logement.
*   **`pages/`** : Les écrans complets.
    *   `Home.tsx` : La page d'accueil avec le Hero et la recherche.
    *   `ListingDetails.tsx` : La page d'un logement spécifique.

## 🚀 Prochaines Étapes (Roadmap)

Tu as maintenant la **coquille vide mais jolie** de ton application. Voici ce qu'il faut faire ensuite pour la rendre réelle (Phase 3 à 10) :

1.  **Backend (Next.js)** : Migrer ce code React vers un vrai projet Next.js pour avoir une API.
2.  **Base de Données (Prisma + Postgres)** : Remplacer `mockData.ts` par des vrais appels à une base de données.
3.  **Authentification (Clerk)** : Remplacer l'objet `CURRENT_USER` par le vrai hook `<SignedIn>` de Clerk.
4.  **Paiement (Stripe)** : Brancher le bouton "Réserver" sur l'API Stripe Connect.

## 🎨 Design System

J'ai respecté scrupuleusement tes couleurs :
*   `bg-haven-cream` (#F9FAF5) pour le fond.
*   `text-haven-navy` (#0B245B) pour les textes.
*   `bg-haven-red` (#9A073C) pour les actions importantes.

Pour tester, lance simplement l'application. Tu peux naviguer de l'accueil vers un détail de logement en cliquant sur une carte.