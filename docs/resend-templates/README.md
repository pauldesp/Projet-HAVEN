# Personnaliser les e-mails Haven dans Resend

Les onze modèles sont publiés dans le compte Resend et raccordés à l’aperçu local depuis le 25 octobre 2026. Les liens exacts sont conservés dans `resend-models.json`. Le mode `RESEND_TEMPLATES_ENABLED=true` est activé dans le fichier `.env` local, ignoré par Git. Les futurs envois utilisent les modèles publiés, avec leurs objets et contenus modifiables dans Resend.

## Commencer avec le premier modèle

Ouvrir [01 · Réservation confirmée](https://resend.com/templates/b2c2500a-84a3-4bff-86ec-c3388ffe25b1/editor).

1. Rester dans **Editor**, l'éditeur visuel. Cliquer directement sur un texte pour le réécrire.
2. Sélectionner un titre, un paragraphe, le logo ou le bouton pour afficher ses réglages dans le panneau de droite. On peut ajuster les couleurs, la taille, les espacements et l'alignement.
3. L'objet se modifie dans **Subject** ; **Preview** est la courte phrase affichée à côté de l'objet dans la boîte mail.
4. Les modifications sont enregistrées dans le brouillon. **Publish** rend la nouvelle version disponible pour l'API Resend. La version publiée sera utilisée pour les prochains envois. Publier ne déclenche aucun e-mail à lui seul.
5. Le menu **… → Test email** permet un test. Utiliser uniquement des données fictives et l'adresse du titulaire Resend tant qu'aucun domaine n'est vérifié. Le PDF n'est pas inclus automatiquement par ce test d'éditeur : Haven doit l'ajouter lors de l'envoi de confirmation.

## Les éléments à conserver

- Logo original Haven, chargé dans Resend et hébergé sur son stockage d'images.
- Fond extérieur `#f3f0ea`, papier `#fffefa`, encarts `#f6f2ec`.
- Texte et boutons bleu nuit `#202b3d`, accents bordeaux `#913c48`.
- Titres Georgia, texte Arial, largeur de lecture de 600 px.
- Les champs `{{{PRENOM_LOCATAIRE}}}`, `{{{DATE_ARRIVEE}}}`, etc. représentent les informations injectées par le serveur. Modifier le texte autour, sans renommer ou supprimer ces champs. Même principe pour `{{{LIEN_ACTION}}}` dans le bouton.
- `MENTION_TEST` sera vide pour un vrai séjour ; les simulations et les validations exceptionnelles doivent rester clairement identifiées comme tests.
- Éviter des valeurs de secours fictives pour une adresse, un montant, une date ou des consignes : une donnée manquante doit être traitée par Haven avant l'envoi.

## Les onze modèles

| Modèle | Contenu et moment |
| --- | --- |
| [01 · Réservation confirmée](https://resend.com/templates/b2c2500a-84a3-4bff-86ec-c3388ffe25b1/editor) | Paiement confirmé, dates, adresse, détail des montants, justificatif PDF ajouté par le serveur, annonce des consignes à 72 h |
| [02 · Préparer mon arrivée](https://resend.com/templates/574da750-cb95-4ae2-bb9b-7abf2de6cf93/editor) | 72 h avant l'arrivée, adresse, horaires, accès et clés, règles, état des lieux d'entrée |
| [03 · Entrée enregistrée](https://resend.com/templates/1aed423d-aeaa-44e7-a077-d1b03fda42d0/editor) | Après l'état des lieux d'entrée enregistré, horodatage et accès au document |
| [04 · Préparer mon départ](https://resend.com/templates/94f026e5-1fd7-4944-beb2-81e3565a08dc/editor) | La veille à 10 h locale, rangement, ménage, état des lieux de sortie et clés |
| [05 · Départ enregistré](https://resend.com/templates/bb11203b-d4aa-4efb-b997-93ecf79d6588/editor) | Après l'état des lieux de sortie et la déclaration du dépôt des clés |
| [06 · Compte validé](https://resend.com/templates/cc072e4e-0a95-4472-a7a0-5bad53444ae2/editor) | Après décision de validation ; le texte injecté distingue la dérogation de test |
| [07 · Dossier à corriger](https://resend.com/templates/0ffc45ad-c5a9-43cc-9ae9-22f934e44471/editor) | Motif précis de la correction et nouvelle transmission du dossier |
| [08 · Réservation annulée](https://resend.com/templates/21691692-ec7e-456d-aefc-6110a0024f47/editor) | Annulation enregistrée d'une réservation payée, initiateur, motif, remboursement enregistré ou simulé |
| [09 · Invitation à laisser un avis](https://resend.com/templates/6cdab46e-ebc3-437d-abec-596924d199f9/editor) | 24 h après le départ effectif, sans avis existant, échéance exacte à 7 jours |
| [10 · Confirmer mon adresse e-mail](https://resend.com/templates/e0d3f410-4d3f-4d2d-8201-7a91dd1ee2e6/editor) | À la demande du membre connecté, lien Firebase sécurisé |
| [11 · Réinitialiser mon mot de passe](https://resend.com/templates/e06fedbf-75ee-4eff-a6e8-013d244d01ac/editor) | À la demande depuis la connexion, lien Firebase sécurisé, réponse sans divulgation du compte |

## Raccordement actif

Les IDs sont définis côté serveur dans `services/resendTemplates.ts`, sans clé API dans le navigateur. Haven transmet les variables et les pièces jointes ; Resend gère le contenu et l'objet du modèle publié. La correspondance et les variables sont couvertes par les tests. Les alias attribués automatiquement par Resend diffèrent des noms des fichiers locaux : utiliser les IDs vérifiés.

Le raccordement conserve les destinataires, les conditions de déclenchement, le justificatif PDF, la file d'attente et les clés d'idempotence. Les requêtes déjà figées avant une tentative gardent leur ancien contenu. Les mails de confirmation d'adresse et de réinitialisation utilisent des liens Firebase générés côté serveur ; ces liens ne sont ni renvoyés par l'API au navigateur, ni conservés dans la file d'attente Haven.

Les onze modèles ont été envoyés avec des données fictives au titulaire du compte Resend, et leur état `delivered` a été vérifié dans Resend. Un essai réel de la demande de réinitialisation depuis l'API Haven a également été indiqué `delivered` ; aucun mot de passe n'a été changé. La confirmation d'adresse garde la vérification Firebase existante ; son application effective devra être retestée avec un compte non confirmé lors du prochain essai utilisateur.

Pour modifier un mail : ouvrir son modèle, éditer le brouillon, vérifier le contenu puis publier. Garder les noms des variables. Pour changer le compte Resend utilisé par le serveur, recréer/publier les modèles et mettre à jour les onze IDs avant d'activer le mode templates. `RESEND_TEMPLATES_ENABLED=false` remet les neuf mails de séjour/dossier sur leur HTML de secours ; les deux envois de sécurité deviennent indisponibles et ne reviennent pas automatiquement à Firebase.

Le domaine expéditeur n'est pas encore vérifié. `onboarding@resend.dev` reste réservé au test autorisé vers le titulaire du compte Resend. La création des modèles ne lève pas cette limite.

## Sauvegarde locale de la préparation

- `*.html` : sources initiales importables dans l'éditeur visuel.
- `previews/` : maquettes avec informations fictives, sans envoi.
- `manifest.json` : objets, pré-en-têtes, variables et déclencheurs.
- `exemples-variables.json` : exemples fictifs pour les essais.
- `resend-models.json` : IDs et liens des onze modèles créés.
- `logo-haven.png` : copie du logo utilisé.

Régénérer les fichiers de préparation avec `node scripts/prepare-resend-templates.mjs`. Cette commande n'envoie aucun e-mail et ne modifie pas les modèles Resend. Après personnalisation dans Resend, ces sources initiales ne reflètent plus automatiquement les modifications de l'éditeur.

Documentation officielle : [éditeur](https://resend.com/docs/dashboard/templates/template-editor), [variables](https://resend.com/docs/dashboard/templates/template-variables), [envoi par modèle](https://resend.com/docs/dashboard/templates/introduction).
