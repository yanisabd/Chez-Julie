# Mounoukid — Dark kitchen de cuisine africaine

Site de commande en ligne avec **espace client**, **espace cuisine** et **espace administrateur**, conforme au cahier des charges v1.0.

> Le nom « Mounoukid », les textes, les plats et les photos sont des valeurs de démonstration : tout se modifie depuis **Administration → Paramètres du site** et **Plats & catégories**.

---

## Sommaire

1. [Démarrer en 2 minutes (sur votre ordinateur)](#1-démarrer-en-2-minutes)
2. [Mode d’emploi du propriétaire](#2-mode-demploi-du-propriétaire)
3. [Mode d’emploi de la cuisine](#3-mode-demploi-de-la-cuisine)
4. [Mise en ligne pas à pas](#4-mise-en-ligne-pas-à-pas)
5. [Sauvegardes et restauration](#5-sauvegardes-et-restauration)
6. [Sécurité](#6-sécurité)
7. [Tests](#7-tests)
8. [Architecture technique](#8-architecture-technique)
9. [Correspondance avec le cahier des charges](#9-correspondance-avec-le-cahier-des-charges)
10. [Checklist avant l’ouverture](#10-checklist-avant-louverture)

---

## 1. Démarrer en 2 minutes

Prérequis : [Node.js 20 ou plus](https://nodejs.org).

```bash
npm install
npm run setup     # crée la base locale + les données de démonstration
npm run dev       # lance le site sur http://localhost:3000
```

Sans aucune configuration, le site fonctionne en **mode démonstration** :

| Élément | En démonstration | En production |
|---|---|---|
| Base de données | PostgreSQL embarqué (dossier `data/`) | PostgreSQL hébergé (`DATABASE_URL`) |
| Paiement | Page de paiement simulé | Stripe (carte, Apple Pay, Google Pay) |
| Emails | Non envoyés, visibles dans *Admin → Emails & SMS* | Envoyés par Resend |
| SMS | Non envoyés, visibles dans *Admin → Emails & SMS* | Envoyés par Brevo |

**Accès de démonstration** (à changer avant la mise en ligne) :

| Espace | Adresse | Identifiants |
|---|---|---|
| Site client | http://localhost:3000 | — |
| Administration | http://localhost:3000/admin | `admin@mounoukid.fr` / `ChangezMoi-2026!` |
| Cuisine | http://localhost:3000/cuisine | profil **Awa**, code **2580** |

Code promo de démonstration : `BIENVENUE10`. Codes postaux livrés : 75011, 75012, 75020, 93100, 93170, 94300, 94160.

> Réinitialiser complètement les données de démo : arrêtez le serveur puis `npm run db:seed -- --reset`.

---

## 2. Mode d’emploi du propriétaire

Tout se passe dans **/admin**. Chaque page commence par un encadré jaune « Comment ça marche ? ».

**Au quotidien**
- **Tableau de bord** : ce qui demande votre attention (commandes à valider, problème signalé par la cuisine, stock bas, créneau presque plein, email non parti), chiffre d’affaires du jour et du mois.
- **Commandes** : recherche par n°, nom, téléphone ; filtres par jour et statut ; export Excel. Dans une commande : faire avancer l’étape, revenir en arrière, annuler (avec remboursement et remise en stock), rembourser une partie, ajouter une note interne, modifier les coordonnées, imprimer.
- **Écran cuisine** : vous pouvez aussi l’ouvrir.

**Ma carte**
- **Plats & catégories** : ajouter / modifier / dupliquer / supprimer un plat, photo, prix, description, ingrédients, 14 allergènes, options et suppléments (accompagnement, piment…), jours de vente, portions max par jour, stock, recette. L’œil 👁 masque un plat en un clic.
- **Stocks & ingrédients** : réapprovisionner (« Ajouter 10 »), corriger (« Fixer à »), saisir en kg ou en g, voir les ventes du jour face aux limites et l’historique des mouvements.
- **Codes promo** : pourcentage ou montant fixe, minimum d’achat, dates, nombre d’utilisations.

**Organisation**
- **Horaires & créneaux** : bouton **Mettre en pause** (imprévu), horaires de la semaine (avec plage midi/soir, retrait et/ou livraison), créneaux jour par jour (fermer, changer la capacité, ouvrir exceptionnellement), jours de fermeture, règles (délai minimum de 6 h, capacité par créneau, par jour, temps de préparation, annulation client…).
- **Retrait & livraison** : activer/désactiver, adresse de retrait, zones (codes postaux, frais, minimum, livraison offerte).
- **Équipe** : créer un profil cuisine (prénom + code à 4 chiffres), changer un code, désactiver (déconnexion immédiate), créer d’autres administrateurs, voir et bloquer les comptes clients.

**Suivi** : Paiements, Statistiques, Emails envoyés (aperçu, renvoi), Journal d’activité, Erreurs techniques, **Sauvegarde** (bouton de téléchargement), Paramètres du site (textes, coordonnées, mentions légales, durée de conservation RGPD).

---

## 3. Mode d’emploi de la cuisine

**Installer l’écran cuisine comme une application** (une seule fois) : sur la tablette, ouvrir `/cuisine` puis *Partager → Sur l’écran d’accueil* (iPad) ou *⋮ → Installer l’application* (Android). Une icône « Cuisine » apparaît et s’ouvre en plein écran, directement sur les commandes.

À afficher près de la tablette :

1. Ouvrir **/cuisine**, toucher son prénom, taper son **code à 4 chiffres** (la tablette reste connectée 30 jours).
2. Toucher **« Activer le son »** une fois : une sonnerie retentit à chaque nouvelle commande.
3. Chaque carte = une commande. Le **gros bouton** fait passer à l’étape suivante :
   **Commencer la préparation → Commande prête → Remise au client / Partie en livraison → Livrée**.
4. Erreur de clic ? **« Annuler mon clic »**.
5. Un souci (ingrédient manquant, retard…) ? **« Un problème »** : le responsable est prévenu immédiatement.
6. **« Quantités »** : le total de chaque plat à préparer pour la journée, et par créneau.
7. Un bandeau rouge signale les commandes annulées à **ne pas** préparer.

La cuisine ne voit **ni les prix, ni les emails, ni les téléphones, ni les adresses** des clients (seulement le prénom et la ville de livraison).

---

## 4. Mise en ligne pas à pas

Hébergement recommandé : **Vercel** (site) + **Neon** ou **Supabase** (PostgreSQL, sauvegardes automatiques incluses) + **Stripe** + **Resend**. Coût de départ : 0 € à ~25 €/mois selon les offres, hors commissions Stripe.

### 4.1 Base de données
1. Créez une base PostgreSQL (Neon, Supabase, Scaleway…), de préférence en région **UE (Paris/Francfort)** pour le RGPD.
2. Copiez l’URL de connexion (`postgres://…`) : c’est `DATABASE_URL`.
3. Depuis votre ordinateur, avec `DATABASE_URL`, `SEED_ADMIN_EMAIL` et `SEED_ADMIN_PASSWORD` (mot de passe personnel) définis dans `.env` :
   ```bash
   npm run setup:prod
   ```
   Cela crée les tables, les réglages par défaut et **uniquement** le compte administrateur — aucune donnée de démonstration.
   Pour démarrer avec la vraie carte (plats, photos, options, recettes) : `npm run import:carte` (ne fait rien si des plats existent déjà). Les commandes démarrent **en pause** : le propriétaire ajoute ses plats, horaires, zones et profils cuisine, puis rouvre les commandes dans *Horaires & créneaux*.

### 4.2 Stripe (paiement)
1. Créez un compte sur [stripe.com](https://stripe.com), activez-le (pièce d’identité, RIB).
2. *Développeurs → Clés API* : copiez la **clé secrète** → `STRIPE_SECRET_KEY`.
3. *Développeurs → Webhooks → Ajouter un endpoint* :
   - URL : `https://VOTRE-DOMAINE/api/stripe/webhook`
   - Évènements : `checkout.session.completed`, `checkout.session.async_payment_succeeded`, `checkout.session.async_payment_failed`, `checkout.session.expired`, `charge.refunded`
   - Copiez le **secret de signature** → `STRIPE_WEBHOOK_SECRET`
4. *Paramètres → Moyens de paiement* : activez Carte, Apple Pay, Google Pay (Apple Pay nécessite de valider votre domaine dans Stripe).
5. Testez d’abord avec les clés de **test** (carte `4242 4242 4242 4242`), puis passez aux clés **live**.

### 4.3 Resend (emails)
1. Créez un compte sur [resend.com](https://resend.com), ajoutez et **vérifiez votre domaine** (enregistrements DNS fournis).
2. Créez une clé API → `RESEND_API_KEY`, et définissez `EMAIL_FROM="Mounoukid <commandes@votre-domaine.fr>"`.

### 4.3 bis Brevo (SMS)
1. Créez un compte sur [brevo.com](https://www.brevo.com) et achetez un pack de crédits SMS (environ 0,045 € le SMS en France).
2. *SMTP & API → Clés API* : créez une clé → `BREVO_API_KEY`.
3. Facultatif : `SMS_SENDER` = nom d’expéditeur affiché (3 à 11 lettres, ex. `ChezJulie`).
4. Le client reçoit un SMS quand sa commande est **confirmée**, **prête**, **en livraison** ou **annulée** (réglable dans *Admin → Emails & SMS*). Le gérant peut aussi recevoir un SMS à chaque nouvelle commande et à chaque problème signalé par la cuisine.

### 4.4 Vercel (site)
1. Mettez le code sur GitHub, puis *Vercel → Add New Project* → importez le dépôt.
2. Variables d’environnement : `APP_URL` (ex. `https://mounoukid.fr`), `DATABASE_URL`, `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `RESEND_API_KEY`, `EMAIL_FROM`, `BREVO_API_KEY`, `SMS_SENDER`, `CRON_SECRET` (chaîne aléatoire longue).
3. Déployez. Les migrations de base s’exécutent automatiquement à chaque déploiement (`vercel-build`).
4. *Settings → Domains* : branchez votre nom de domaine (HTTPS automatique).
5. La tâche planifiée `/api/cron` (fichier `vercel.json`) libère les réservations expirées et relance les emails. Sur l’offre gratuite de Vercel, les tâches planifiées sont limitées à une fois par jour : ce n’est pas bloquant car **le site exécute aussi ces tâches à chaque visite**.

### 4.5 Après la mise en ligne
- Connectez-vous à `/admin`, **changez le mot de passe** (Équipe), créez les profils cuisine avec de vrais codes.
- Renseignez **Paramètres du site** (coordonnées, mentions légales) et l’email d’alerte (**Emails envoyés → Préférences**).
- Passez une vraie commande test de bout en bout, puis remboursez-la.

> Sécurité : en production, le paiement simulé est **désactivé automatiquement**. Si Stripe n’est pas configuré, les clients ne peuvent pas commander (au lieu de commander gratuitement).

---

## 4 bis. Photos des plats

- **Depuis l’administration** : *Plats & catégories → un plat → Photos*. La 1re photo est la photo principale ; « Ajouter à la galerie » ajoute d’autres angles (8 maximum), l’étoile ★ choisit la photo principale. Les photos envoyées sont automatiquement recadrées, optimisées et converties en WebP.
- **Photos de la carte de départ** : les originaux sont dans `photos-source/` (non versionné) et les versions préparées dans `assets/plats/`. Le script `npm run photos` les régénère (recadrage sur l’assiette, couleurs, netteté, visuels assemblés des formules) ; les cadrages se règlent dans `scripts/process-photos.ts`.
- Le site sert chaque photo à la taille adaptée à l’écran (320, 640 ou 1200 px) pour rester rapide sur mobile.

## 5. Sauvegardes et restauration

**Ce qui est sauvegardé** : commandes, clients, plats, photos, stocks, ingrédients, créneaux, fermetures, zones, codes promo, paiements, emails, réglages, journaux.

**Trois niveaux de protection :**
1. **Sauvegardes automatiques de l’hébergeur de base de données** (Neon / Supabase) : quotidiennes, avec restauration à un instant précis (« point-in-time recovery »). Vérifiez qu’elles sont activées et notez leur durée de rétention.
2. **Bouton « Télécharger une sauvegarde »** dans *Admin → Journal & sauvegardes* : fichier JSON complet, à conserver hors ligne (ex. une fois par semaine).
3. **`npm run backup`** : écrit une sauvegarde dans `./backups` (garde les 30 dernières). À planifier chaque nuit sur un serveur ou une machine de confiance (tâche planifiée Windows, cron, GitHub Action…).

**Procédure de restauration** (testée automatiquement par `tests/backup.test.ts`) :
1. Identifier la sauvegarde à restaurer (date juste avant l’incident).
2. Mettre le site en pause : *Admin → Horaires & créneaux → Mettre en pause*.
3. **Faire d’abord une sauvegarde de l’état actuel** (pour pouvoir revenir en arrière).
4. Avec `DATABASE_URL` pointant vers la base à restaurer :
   ```bash
   npm run restore -- backups/sauvegarde-AAAA-MM-JJ….json
   ```
   Le script demande de taper `RESTAURER` pour confirmer. La restauration se fait **en une seule transaction** : en cas d’erreur, rien n’est modifié.
5. Vérifier le tableau de bord et les dernières commandes, puis rouvrir les commandes.
6. Pour les commandes payées entre la sauvegarde et l’incident : les retrouver dans le tableau de bord Stripe et les recréer ou les rembourser.

> En local (base embarquée), arrêtez le serveur avant `npm run backup` ou `npm run restore`.

---

## 6. Sécurité

- **Mots de passe** hachés (bcrypt) ; **sessions** stockées en base sous forme hachée, cookie `httpOnly` + `SameSite` + `Secure` ; déconnexion immédiate de tous les appareils lors d’une désactivation.
- **Anti-force brute** : blocage du compte après 5 essais pendant 15 min + limitation par adresse IP (connexion, commandes, codes promo, mot de passe oublié).
- **Permissions vérifiées côté serveur** dans chaque action (`guarded`), jamais seulement en masquant des boutons. Les pages admin et cuisine vérifient aussi le rôle.
- **Prix recalculés côté serveur** : un client ne peut pas modifier un prix.
- **Paiement** : aucune donnée bancaire sur le site ; le paiement n’est validé qu’après confirmation de Stripe (webhook signé **ou** vérification directe auprès de Stripe) ; webhooks idempotents.
- **Stocks** : réservations atomiques en base (`UPDATE … WHERE disponible >= quantité`), réservation temporaire pendant le paiement, libération automatique.
- **En-têtes HTTP** : CSP, HSTS, X-Frame-Options, nosniff, Referrer-Policy. Formulaires protégés contre le CSRF (Server Actions). Export CSV protégé contre l’injection de formules Excel.
- **Données personnelles** : la cuisine ne voit que le prénom ; anonymisation automatique après la durée de conservation (36 mois par défaut) ; suppression de compte par le client ; journal d’activité.
- **Erreurs** : enregistrées dans *Journal → Erreurs techniques* et signalées sur le tableau de bord ; les emails en échec sont relancés 6 fois puis signalés.

---

## 7. Tests

```bash
npm run lint        # qualité du code (ESLint)
npm test            # tests automatiques (logique métier, concurrence, sauvegarde)
npm run load-test   # test de charge (commandes simultanées)
npm run e2e         # parcours réels dans un navigateur (serveur lancé + données de démo)
npm run typecheck
```

Ce qui est vérifié :
- 20 clients simultanés pour les 3 dernières portions → exactement 3 commandes ; le stock ne devient jamais négatif.
- Un créneau complet se ferme automatiquement ; capacité en plats respectée ; limite journalière ; ingrédients.
- Délai minimum de 6 h ; libération des réservations non payées ; paiement arrivé en retard.
- Un paiement confirmé plusieurs fois n’est compté qu’une fois ; un email n’est jamais envoyé en double.
- Annulation : remboursement, remise en stock, libération du créneau ; enchaînement des statuts.
- Sauvegarde puis restauration complète à l’identique.
- La cuisine ne reçoit aucune donnée personnelle.
- Parcours navigateur : commande mobile complète avec code promo et paiement, cuisine (code PIN, statuts, retour arrière, signalement), administration (alerte, modification d’un plat).

**Intégration continue** (`.github/workflows/ci.yml`) : à chaque envoi sur GitHub, lint + types + tests + build, et le **test de charge sur un vrai PostgreSQL 16**.

Scores Lighthouse (mobile, version de production) : Performance 90–97, Accessibilité 100, Bonnes pratiques 100, SEO 100 sur les pages publiques (les pages privées — panier, paiement, admin, cuisine — sont volontairement exclues des moteurs de recherche).

Pour lancer vous-même le test de charge sur un **vrai PostgreSQL** (recommandé avant l’ouverture), utilisez une base de test dédiée — elle sera effacée :
```bash
LOAD_TEST_DATABASE_URL=postgres://… npm run load-test
```

---

## 8. Architecture technique

| Élément | Choix |
|---|---|
| Interface | Next.js 15 (App Router, Server Components, Server Actions), React 19, TypeScript, Tailwind CSS 4 |
| Base de données | PostgreSQL + Drizzle ORM (PGlite embarqué en local) |
| Authentification | Sessions sécurisées maison (bcrypt), code PIN pour la cuisine |
| Paiement | Stripe Checkout + webhooks |
| Emails & SMS | Resend (emails) et Brevo (SMS), file d’envoi commune avec réessais et anti-doublon |
| Images | Stockées en base, redimensionnées et converties en WebP (sharp) |
| Référencement | sitemap.xml, robots.txt, image de partage générée, données structurées « Restaurant » |
| Application | Site et écran cuisine installables (manifest + icônes générées) |

```
src/
  app/(shop)/        site client (accueil, carte, panier, commande, suivi, compte, pages légales)
  app/cuisine/       espace cuisine
  app/admin/         administration
  app/api/           webhook Stripe, tâche planifiée, export, sauvegarde, images
  server/            logique métier (commandes, stocks, créneaux, paiements, emails, sécurité…)
  db/                schéma et migrations
  lib/               utilitaires partagés (dates Europe/Paris, prix, statuts…)
  components/        composants d’interface
tests/  scripts/  drizzle/ (migrations SQL)
```

Le cœur métier se trouve dans `src/server/inventory.ts` (réservations atomiques), `src/server/orders.ts` (cycle de vie d’une commande) et `src/server/slots.ts` (créneaux).

**Choix assumés par rapport au cahier des charges :**
- *Supabase Auth* remplacé par une authentification intégrée : aucune dépendance externe, connexion par code PIN pour la cuisine, et toutes les règles restent sur le serveur. Le cahier des charges autorisait une « solution équivalente ».
- *Confirmation de commande* et *confirmation de paiement* sont réunies en un seul email : la commande n’existe qu’une fois payée, et deux emails simultanés seraient redondants.
- *Sentry* : les erreurs sont journalisées en base et visibles dans l’administration ; Sentry peut être ajouté ensuite (`@sentry/nextjs`) sans changer le code métier.
- *Gestion des ingrédients* (§6.3, prévue « progressivement ») : incluse dès la V1.
- *Codes promo* (§4.3) : inclus et désactivables.

---

## 9. Correspondance avec le cahier des charges

| § | Exigence | Où |
|---|---|---|
| 3.1 | Client sans compte, compte facultatif, historique, annulation | `/`, `/menu`, `/commander`, `/commande/[jeton]`, `/compte` |
| 3.2 / 9 | Espace cuisine simple, statuts en un clic, problème, aucun accès sensible | `/cuisine` |
| 3.3 / 8 | Administration complète | `/admin/*` |
| 4 | Accueil, catalogue, fiche plat, panier revalidé, parcours mobile | site client |
| 5 | Commande ≥ 6 h à l’avance (configurable), créneaux, fermeture auto, ouverture exceptionnelle | Horaires & créneaux |
| 6 | Stocks, limites journalières, ingrédients, capacités, concurrence atomique, réservation temporaire | `server/inventory.ts` |
| 7 | Stripe, aucune donnée bancaire stockée, vérification réelle, remboursements | `server/payments.ts`, webhook |
| 10 | Retrait, zones de livraison, frais, minimum, éligibilité automatique | Retrait & livraison |
| 11 | 10 emails automatiques, journal, réessais, anti-doublon | `server/notifications.ts`, Emails envoyés |
| 12 | Identité africaine contemporaine, responsive | tout le site |
| 14 | Toutes les entités demandées (+ historique, mouvements de stock…) | `src/db/schema.ts` |
| 15 | Sécurité, RGPD, mentions légales, CGV, confidentialité, allergènes | §6 ci-dessus, pages légales |
| 16 | Sauvegardes, restauration documentée et testée, gestion des erreurs | §5 ci-dessus |
| 17 | Tests fonctionnels, sécurité, charge | §7 ci-dessus |
| 20 | Prêt pour les évolutions (fidélité, SMS, multi-cuisines…) | architecture modulaire |

---

## 10. Checklist avant l’ouverture

Points du §21 du cahier des charges à valider par le propriétaire :

- [ ] Nom, logo (remplacer `public/icon.svg`) et textes de la marque
- [ ] Liste des plats, prix, **photos**, allergènes vérifiés
- [ ] Horaires, délai minimum, capacités par créneau et par jour
- [ ] Zones et frais de livraison, minimum de commande
- [ ] Politique d’annulation (délai) et de remboursement
- [ ] Adresse et instructions de retrait, coordonnées de contact
- [ ] Mentions légales complètes (SIRET, adresse, hébergeur), médiateur de la consommation, CGV relues par un professionnel
- [ ] Déclaration de l’activité alimentaire (DDPP), formation hygiène (HACCP), assurance
- [ ] Comptes Stripe et Resend activés, domaine vérifié
- [ ] Mot de passe administrateur et codes cuisine changés
- [ ] Sauvegardes automatiques de la base activées + première sauvegarde manuelle téléchargée
- [ ] Une commande réelle de bout en bout testée puis remboursée
