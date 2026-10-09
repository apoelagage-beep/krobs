# KRØBS

Storefront BLOCK 01 et textile Printful.

## Précommandes BLOCK 01

- Planche : 74,90 € TTC. Livraison deck France : 9,90 € par commande, soit 84,80 € pour une planche seule.
- Objectif : 50 planches payées, calculé à partir des commandes enregistrées par le webhook signé Stripe, jamais à partir du panier ou d'une visite de la page de retour.
- Les anciennes ventes ne sont pas ajoutées à cette campagne. La campagne est identifiée par `block-01-preorder-2026`.
- Le paiement est encaissé immédiatement. Aucun acompte client ou débit différé.
- À partir de 50 planches payées, les nouvelles sessions deck sont fermées. Des sessions déjà ouvertes ou des paiements différés peuvent faire dépasser 50 : il s'agit d'un objectif minimum, pas d'une limite garantie. Vérifier le nombre exact avec l'atelier avant production.
- Le site affiche l'objectif atteint ; il ne commande pas au fabricant et n'envoie pas de messages aux clients. Le lancement et son annonce restent manuels. Délai estimé : 4 à 5 semaines après lancement, puis transport.
- Sans date de clôture configurée, les précommandes deck sont fermées. Le textile continue de fonctionner.
- Si l'objectif n'est pas atteint à la clôture, effectuer les remboursements complets depuis Stripe et informer les clients. Aucun remboursement automatique n'est déclenché par le site.
- Les remboursements complets sont exclus du compteur, même si l'événement de remboursement arrive avant celui du paiement. Les remboursements partiels ne modifient pas le nombre de planches : rapprocher manuellement toute annulation partielle avant de lancer la fabrication.

## Configuration Vercel

Variables serveur existantes : `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `KROBS_DB_POSTGRES_URL`, `PRINTFUL_TOKEN`, éventuellement `PRINTFUL_STORE_ID` et `PUBLIC_BASE_URL`.

Ajouter `KROBS_PREORDER_DEADLINE` : date de clôture ISO 8601 avec fuseau explicite (exemple de format uniquement : `YYYY-MM-DDTHH:mm:ss+01:00`). Choisir la vraie date avec le vendeur avant activation. Les dates sont affichées en heure de Paris.

Utiliser une base et des clés Stripe de test séparées pour Preview/Development. Ne pas relier une preview à la base de production ou à Stripe live. Ne jamais committer de clés.

Le webhook `/api/webhook` doit recevoir :

- `checkout.session.completed`
- `checkout.session.async_payment_succeeded`
- `charge.refunded`

Il vérifie la signature Stripe et enregistre une seule commande par session. Les migrations ajoutent une colonne `preorder_campaign` et une table `krobs_payment_refunds` sans modifier les anciennes commandes.

## Vérification avant mise en ligne

Exécuter `node --experimental-vm-modules tests/preorder.test.mjs`. Ces tests utilisent des doubles Stripe/SQL et ne remplacent pas un paiement en environnement Stripe de test.

En preview isolée, tester : une planche à 84,80 €, les quantités multiples, un panier textile et un panier mixte ; paiement réussi/échoué/différé ; webhook livré deux fois ; remboursement complet ; compteur à 49 puis 50 ; clôture et indisponibilité de la base. Vérifier que les coordonnées de livraison sont enregistrées.

Avant publication : choisir la date de clôture, confirmer les modalités de remboursement et les caractéristiques avec le vendeur, configurer les événements du webhook, et effectuer un vrai parcours de test Stripe.
