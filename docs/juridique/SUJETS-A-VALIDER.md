# Haven — tous les sujets juridiques à valider

Liste établie le 15 novembre 2026 d'après le fonctionnement réel du site (code) et les brouillons de `docs/juridique/`. Elle sert à préparer les rendez-vous avec les professionnels ; elle ne remplace pas leur avis.

**Urgence** — 🔴 à trancher avant l'ouverture au public · 🟠 dans les premiers mois d'activité · ⚪ plus tard (évolutions prévues).
**Qui** — *Avocat* (droit immobilier et numérique) · *Comptable* (expert-comptable) · *Vous* (décision d'entreprise ou démarche).

Les sujets marqués ⭐ conditionnent beaucoup d'autres : à traiter en premier.

---

## A. Haven, l'entreprise

1. 🔴 ⭐ **Forme juridique et immatriculation** — *Vous, Comptable*. SAS, SASU, EURL… ; siège, capital, SIREN, TVA intracommunautaire, dirigeant. Nécessaire pour les mentions légales, Stripe en mode réel, les factures et toutes les conditions (encore « [Raison sociale] », « [SIREN] »…).
2. 🔴 ⭐ **Haven est-il un agent immobilier (loi Hoguet de 1970) ?** — *Avocat*. Haven met en relation, fixe des règles communes (annulation, ménage, caution), encaisse et reverse, et peut annuler ou déplacer un séjour. Selon la réponse : carte professionnelle « transactions » ou « gestion », garantie financière, assurance responsabilité professionnelle, mandats écrits, registre — ou bien un statut de simple plateforme technique, à défendre par la rédaction des conditions et le fonctionnement réel.
3. 🔴 ⭐ **Encaissement pour le compte des propriétaires** — *Avocat*. Aujourd'hui, le locataire paie Haven (Stripe), qui reverse la part du propriétaire après l'arrivée. Il faut valider ce schéma (mandat d'encaissement, exemption des règles des services de paiement grâce à Stripe Connect, mention dans les conditions propriétaires) et sa compatibilité avec la réponse au point 2.
4. 🔴 **Assurance de Haven** — *Vous, Avocat*. Responsabilité civile professionnelle de la plateforme (et garantie spécifique si la loi Hoguet s'applique) ; vérifier ce qu'elle couvre en cas de sinistre dans un logement.
5. 🟠 **Marque « Haven »** — *Vous, Avocat*. Recherche d'antériorité et dépôt à l'INPI (mot courant : risque de conflit) ; nom de domaine havencoloc.fr.

## B. La nature des locations ⭐

6. 🔴 ⭐ **Quel contrat lie le locataire et le propriétaire ?** — *Avocat*. Location saisonnière / meublé de tourisme, bail mobilité (1 à 10 mois, réservé à certains publics : études, stage, mutation, mission…), simple hébergement, ou chambre chez l'habitant. La réponse décide de la caution (interdite en bail mobilité), du préavis, des documents obligatoires, de l'assurance et des taxes.
7. 🔴 **Durée maximale d'un séjour** — *Avocat, puis code*. Plafond fixé à **90 nuits d'affilée** le 25 novembre 2026 (voir « Points tranchés »). Un long séjour qui devient la résidence principale du locataire relève du bail meublé de la loi de 1989 (1 an, ou 9 mois pour un étudiant), que Haven ne gère pas. Fixer un plafond cohérent avec le point 6, que je reporterai dans le code.
8. 🔴 **La récurrence** — *Avocat*. Des séjours répétés dans la même chambre, réservés en une fois, peuvent être requalifiés en bail d'habitation. Valider les limites (nombre de séjours, durée cumulée, intervalle entre séjours).
9. 🔴 **Meublés de tourisme : déclaration et numéro d'enregistrement** — *Avocat, puis code*. Depuis la loi du 19 novembre 2024, la déclaration en mairie et le numéro d'enregistrement se généralisent ; la plateforme doit afficher ce numéro sur chaque annonce concernée et peut devoir refuser les annonces sans numéro. La Rochelle applique déjà un régime d'enregistrement. **Le site ne demande ni n'affiche aucun numéro aujourd'hui.**
10. 🔴 **Plafond de nuitées des résidences principales** — *Avocat, puis code*. Un propriétaire qui loue sa résidence principale est limité à 120 nuits par an (moins si la commune l'a décidé) ; la plateforme doit compter les nuits et bloquer au-delà, et transmettre le décompte à la commune sur demande. **Non géré par le site.**
11. 🔴 **Changement d'usage, copropriété, sous-location** — *Avocat*. Autorisations de changement d'usage selon les communes ; règlement de copropriété qui peut interdire la location de courte durée ; interdiction pour un locataire de sous-louer sans accord écrit de son bailleur. Définir ce que le propriétaire doit attester à la publication (le cahier des charges et les conditions propriétaires sont les bons endroits).
12. 🟠 **Performance énergétique et décence** — *Avocat*. Seuils de DPE imposés progressivement aux meublés de tourisme et aux logements loués ; normes minimales (surface, sécurité, détecteur de fumée). Décider ce que Haven vérifie à la validation d'une annonce.
13. 🟠 **Colocation et chambre chez l'habitant** — *Avocat*. Règles différentes selon que le propriétaire habite ou non le logement ; responsabilité entre colocataires (dégâts dans les parties communes, exclusion d'un colocataire dangereux).

## C. Fiscalité

14. 🔴 **TVA sur les frais de service Haven (15 %)** — *Comptable*. Taux, affichage TTC, factures aux locataires (le justificatif PDF actuel n'est pas une facture conforme), régime de Haven (franchise ou non).
15. 🔴 **Taxe de séjour** — *Comptable, Avocat, puis code*. Une plateforme qui encaisse pour des loueurs particuliers doit collecter la taxe de séjour et la reverser aux communes. **Le site ne la calcule ni ne la collecte aujourd'hui**, et elle n'apparaît pas dans les prix (point lié à la comparaison de l'accueil).
16. 🔴 **DAC7 et article 242 bis du Code général des impôts** — *Comptable, puis code*. Collecte des informations fiscales des propriétaires (identité, numéro fiscal, IBAN…), déclaration annuelle des revenus versés avant le 31 janvier, relevé annuel envoyé à chaque propriétaire, information sur leurs obligations fiscales et sociales à chaque transaction. **Non géré par le site** (noté dans `A-FAIRE.md`).
17. 🟠 **Statut particulier ou professionnel du propriétaire** — *Avocat, puis code*. Obligation d'informer le locataire du statut de son cocontractant (droits différents) ; collecte au moment de la publication. Prévu dans `A-FAIRE.md`.
18. 🟠 **Comptabilité de Haven** — *Comptable*. Traitement des sommes encaissées pour le compte des propriétaires, des remboursements, des frais Stripe pris en charge par Haven et des cautions prélevées.

## D. Droit de la consommation et contrat en ligne

19. 🔴 **Bouton de paiement et récapitulatif** — *Avocat*. La loi impose un récapitulatif avant validation et un bouton qui dit clairement l'obligation de payer. Le site affiche « Confirmer et payer · montant », précédé du récapitulatif, des cases ménage et caution et de la mention « En sélectionnant ce bouton, j'accepte les conditions de réservation ». Faire valider cette formule, ainsi que l'acceptation des conditions par ce clic.
20. 🔴 **Informations obligatoires avant la réservation** — *Avocat*. Prix total TTC avec tous les frais, caractéristiques du logement, identité et statut du propriétaire, conditions d'annulation, durée, coordonnées de Haven.
21. 🔴 **Absence de droit de rétractation** — *Avocat*. L'hébergement réservé pour une date précise n'ouvre pas de droit de rétractation de 14 jours, à condition de le dire clairement avant le paiement. Vérifier la formulation dans les conditions et sur l'écran de paiement.
22. 🔴 **Conditions d'annulation et clauses abusives** — *Avocat*. Locataire (grille du 25 novembre 2026) : 100 % plus de 14 jours avant, 50 % de l'hébergement et du ménage de 14 à 8 jours (frais de service conservés), rien à moins de 8 jours ou en cas de non-présentation ; propriétaire : annulation seul seulement à 30 jours ou plus. Vérifier l'équilibre (risque de clause abusive), les pénalités du propriétaire qui annule, et la part du propriétaire en cas d'annulation tardive (avec le paiement au nom du propriétaire, il conserve la part non remboursée).
23. 🔴 **Médiateur de la consommation** — *Vous*. Adhésion obligatoire à un médiateur (payante) et mention dans les conditions et sur le site. Encore « [nom et coordonnées du médiateur] ».
24. 🔴 **Obligations de loyauté des plateformes (article L111-7 du Code de la consommation)** — *Avocat*. Afficher les critères de classement des annonces (le tri actuel des résultats doit être décrit), la qualité de l'annonceur (particulier ou professionnel), et les droits et obligations des parties.
25. 🔴 **Avis en ligne** — *Avocat*. Indiquer si les avis sont vérifiés et comment (sur Haven : seulement après un séjour réalisé, dans un délai de 7 jours), leurs règles de publication, de modération (le back office peut masquer un avis) et de durée d'affichage.
26. 🔴 **Publicité comparative de l'accueil** — *Avocat*. Relevé du 15 novembre 2026 et preuves dans `preuves-comparaison/` ; prix Haven à confirmer ; à l'heure du relevé, l'hôtel F1 était moins cher que Haven.
27. 🟠 **Âge minimum et capacité** — *Avocat*. Réservation réservée aux majeurs (à imposer à l'inscription), mineurs accompagnés.
28. 🟠 **Accessibilité numérique** — *Avocat*. Les obligations européennes d'accessibilité des services en ligne (depuis juin 2025) épargnent les très petites entreprises ; vérifier si Haven est concerné et à partir de quelle taille.

## E. Plateforme en ligne (droit européen)

29. 🔴 **Règlement sur les services numériques (DSA)** — *Avocat*. Point de contact, mécanisme de signalement des contenus illicites (signalements existants à adapter), motivation des décisions de modération (suspension d'annonce, bannissement) et voie de recours, traçabilité des loueurs professionnels (vérification d'identité avant publication). Les petites entreprises sont dispensées de certaines obligations : à confirmer.
30. 🔴 **Règlement « P2B » (plateformes et entreprises utilisatrices)** — *Avocat*. Pour les propriétaires professionnels : conditions claires, préavis de 15 jours avant toute modification des conditions, motifs de suspension ou de retrait, système interne de traitement des plaintes, médiateurs désignés.
31. 🟠 **Procédure de modération** — *Avocat*. Suspension d'une annonce, bannissement d'un membre, dérogations de test : règles écrites, information de la personne, possibilité de contester.

## F. Paiements, caution et argent

32. 🔴 **Prélèvements automatiques des séries** — *Avocat*. Accord exprès conservé (texte et date), rappel avant prélèvement, échec puis annulation du séjour au bout de 5 jours : valider la procédure et sa présentation.
33. 🔴 **Caution de 300 € par carte conservée** — *Avocat*. Compatibilité avec le contrat retenu (point 6), mandat de prélèvement pour le compte du propriétaire, information du locataire (e-mail avec délai de réponse de 3 jours), décision motivée de Haven, plafond, recours. Mise en place le 13 novembre, renforcée le 15.
34. 🔴 **Versement au propriétaire et blocage en cas de litige** — *Avocat*. Versement après l'arrivée, séjour par séjour ; possibilité pour Haven de bloquer un versement ou de rembourser le locataire sur sa commission : prévoir ces droits dans les conditions propriétaires.
35. 🟠 **Remboursements, contestations bancaires, frais Stripe** — *Avocat, Comptable*. Qui supporte quoi en cas de contestation d'un paiement ou de la caution.

## G. Données personnelles (RGPD)

36. 🔴 **Registre des traitements et bases légales** — *Vous, Avocat*. Comptes, vérification d'identité, réservations, paiements, messagerie, états des lieux avec photos, signalements, mesure d'audience, journal d'erreurs.
37. 🔴 **Pièces d'identité** — *Avocat, puis code*. Recto et verso conservés sans limite de durée aujourd'hui. Décider : durée de conservation après vérification, masquage éventuel, accès restreint (aujourd'hui : le membre et les administrateurs).
38. 🔴 **Durées de conservation** — *Avocat, Comptable, puis code*. Comptes inactifs, réservations et paiements (obligations comptables), messages, états des lieux et photos, signalements, journaux. Propositions dans le brouillon de politique de confidentialité ; **aucune suppression automatique** n'existe encore (noté dans `A-FAIRE.md`).
39. 🔴 **Sous-traitants et transferts hors Union européenne** — *Avocat*. Google (Firebase, Cloud Run, Maps), Stripe, Resend : contrats de sous-traitance, région de stockage (encore « [Région à vérifier] »), garanties pour les transferts vers les États-Unis.
40. 🔴 **Politique de confidentialité et information à l'inscription** — *Avocat, puis code*. Brouillon à compléter et publier ; lien à ajouter à l'inscription et en pied de page.
41. 🟠 **Lecture des conversations par Haven en cas de litige** — *Avocat*. À encadrer et annoncer si l'équipe doit pouvoir consulter une messagerie.
42. 🟠 **Mesure d'audience sans cookie** — *Avocat*. Vérifier que l'exemption de consentement (conditions de la CNIL) est bien remplie.
43. 🟠 **Violation de données** — *Vous*. Procédure interne : qui décide, notification à la CNIL sous 72 heures, information des personnes.

## H. Contrats et responsabilités

44. 🔴 ⭐ **L'« accord tripartite »** — *Avocat*. Le site dit que le paiement vaut signature d'un accord entre locataire, propriétaire et Haven. Définir qui est partie à quel contrat, et ce que Haven garantit ou non.
45. 🔴 **Responsabilité de Haven** — *Avocat*. Logement non conforme, inaccessible ou insalubre, sinistre, vol, accident ; limites de responsabilité admissibles face à des consommateurs.
46. 🔴 **Assurances des parties** — *Avocat*. Responsabilité civile ou assurance habitation exigée du locataire ? Assurance propriétaire non occupant ? Mention dans les conditions (encore « [À valider] »).
47. 🔴 **États des lieux numériques** — *Avocat*. Valeur probante des états des lieux faits sur le site (photos, cases, signature à l'écran), délais pour les faire, conséquences s'ils ne sont pas faits.
48. 🔴 **Ménage** — *Avocat*. Obligation du propriétaire (ménage hebdomadaire financé par le forfait) et du locataire (remise en état avant le départ) ; conséquences en cas de manquement.
49. 🟠 **Règles de vie et incidents graves en colocation** — *Avocat*. Exclusion d'un colocataire, violence, trouble, intervention de Haven.
50. 🔴 **Droit applicable et tribunal compétent** — *Avocat*. Droit français, juridiction du domicile du consommateur, médiation préalable.

## I. Contenus et propriété intellectuelle

51. 🔴 **Photos et textes des annonces** — *Avocat*. Licence accordée par le propriétaire à Haven (affichage, recadrage, réseaux sociaux), garantie que le propriétaire en détient les droits.
52. 🔴 **Images et textes du site** — *Vous*. Droits d'utilisation des photos d'accueil et du logo (noté dans `A-FAIRE.md`).
53. 🟠 **Articles du blog** — *Vous*. Droits sur les images et textes publiés depuis le back office.

## J. Mise en ligne

54. 🔴 **Publication de tous les documents** — *Vous*. Conditions générales d'utilisation, conditions de réservation, conditions propriétaires, cahier des charges du logement, politique de confidentialité, mentions légales : compléter les crochets, faire valider, publier depuis le back office (`node scripts/legal-documents.mjs check` refuse tant qu'il reste des points ouverts).
55. 🔴 **Acceptation et versions** — *Avocat*. Comment chaque membre accepte les conditions (inscription, publication d'une annonce, réservation), conservation de la version acceptée, information en cas de modification.

## K. Plus tard

56. ⚪ **Parrainage, codes promo, remises** — règles de l'offre, fiscalité des avantages.
57. ⚪ **Alerte « Prévenez-moi » et e-mails commerciaux** — consentement pour tout envoi non lié à une réservation.
58. ⚪ **Applications iPhone et Android** — conditions des boutons d'achat (règles Apple et Google), politique de confidentialité des boutiques, compte de démonstration.
59. ⚪ **Ouverture à d'autres villes ou pays** — règles locales des meublés (numéro, quotas), taxe de séjour, langue des conditions.
60. ⚪ **Assurance partenaire pour les dégâts au-delà de 300 €** — contrat, distribution d'assurance (règles spécifiques si Haven la propose).

---

## Points tranchés (mise en conformité du site, branche `conformite-cg`)

- **25 novembre 2026 — Annulation par le locataire.** Plus de 14 jours avant l'arrivée : tout est remboursé (hébergement, ménage, frais de service). De 14 à 8 jours : 50 % de l'hébergement et du forfait ménage, frais de service conservés. Moins de 8 jours ou non-présentation : rien. Le forfait ménage suit la même règle que l'hébergement (choix de Paul). Un séjour de série pas encore prélevé s'annule sans frais. Seuil propriétaire inchangé et désormais indépendant : annulation seul à 30 jours ou plus, ensuite Haven seulement. Code : `services/cancellationPolicy.ts`.
- **25 novembre 2026 — Durée maximale.** 90 nuits d'affilée au plus, pour une réservation unique, chaque séjour d'une série, et des séjours du même locataire dans le même logement qui se suivent sans nuit d'écart (choix de Paul). Contrôlé par le serveur et par les calendriers. Code : `MAX_STAY_NIGHTS` dans `services/stay.ts`.
- **25 novembre 2026 — Déclaration de résidence principale.** Case obligatoire, non cochée par défaut, à chaque réservation unique ou récurrente. Texte, version et date conservés avec la réservation et la série (conditions de réservation, art. 3.1 bis). Code : `services/residenceDeclaration.ts`.
- **25 novembre 2026 — Âge minimum et réservation pour un tiers.** Inscription réservée aux 18 ans et plus. Un parent peut réserver pour un occupant de 16 ou 17 ans : déclaration de représentant légal et autorisation parentale (PDF ou photo, conservée par Haven, non transmise au propriétaire). L'identité de l'occupant est visible par le propriétaire. L'occupant reçoit un lien personnel vers un espace séjour sans compte (consignes, états des lieux, messagerie, signalement), valable jusqu'à 7 jours après le départ ; les consignes d'arrivée partent au Réservant et à l'occupant. La déclaration de résidence principale porte sur l'occupant (choix de Paul). Conditions de réservation, art. 3.5 ; CGU, art. 4.1. Code : `services/occupant.ts`, `services/occupantAccess.ts`, `pages/OccupantStay.tsx`. **À faire valider par l'avocat :** responsabilité du parent pour un mineur, contenu de l'autorisation parentale, assurance.
- **25 novembre 2026 — Jours d'arrivée et de départ privilégiés : non retenus.** La règle du 4 novembre est maintenue : seul un nombre minimum de nuits s'applique, aucune confirmation par le propriétaire selon le jour d'arrivée ou de départ (choix de Paul, chantier 5 abandonné). Les conditions ne doivent donc mentionner ni jours privilégiés ni demande de réservation.
- **25 novembre 2026 — Paiement au nom du propriétaire (plan validé par Paul).** Le locataire paie sur le compte Stripe du propriétaire (`on_behalf_of` et transfert immédiat), Haven ne perçoit que ses frais de service (`application_fee_amount`) et continue de supporter les frais Stripe. Virements bancaires du propriétaire en mode manuel, lancés le lendemain de l'état des lieux d'entrée ; Haven peut les suspendre en cas de litige. Remboursements : intégral = part du propriétaire reprise et frais rendus ; 14 à 8 jours = repris sur la part du propriétaire, frais conservés ; geste commercial = pris sur Haven. Contestation : montant repris chez le propriétaire, virement suspendu. Séries et caution prélevées de la même façon ; les réservations et séries antérieures finissent avec l'ancien fonctionnement. **Conséquence :** en cas d'annulation tardive, le propriétaire conserve la part non remboursée (auparavant il ne recevait rien). Conditions de réservation art. 3.3 et 9 ; conditions propriétaires art. 4.2, 4.3, 4.5. Code : `services/onBehalfPayments.ts`, `services/stripeConnectServer.ts`. **À faire valider par l'avocat** (réglementation des services de paiement, virement manuel).

---

## Ce que le code devra suivre selon les réponses

Sujets où la réponse du juriste ou du comptable entraîne des développements : durée maximale (7), récurrence (8), numéro d'enregistrement (9), plafond de nuitées (10), taxe de séjour (15), DAC7 (16), statut du propriétaire (17), conservation et suppression des données (37, 38), lien vers la politique de confidentialité (40), acceptation des conditions propriétaires à la publication (55).
