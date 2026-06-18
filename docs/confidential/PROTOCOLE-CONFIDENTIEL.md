# 🔒 CONFIDENTIEL — Fonctionnement du protocole NVP

> **Classification : CONFIDENTIEL.** Ne pas diffuser hors de l'équipe et des parties
> sous NDA. Ce document décrit le fonctionnement réel, l'état actuel (v0), les
> choix techniques, l'économie et les avantages défendables (« moat ») du protocole.

---

## 1. Résumé en une phrase

NVP est un **réseau d'inférence IA distribué** : des smartphones grand public
exécutent des modèles de langage **localement**, répondent à des requêtes
envoyées par un **coordinateur**, et leurs propriétaires sont **payés** pour la
puissance de calcul fournie. L'IA tourne sur les appareils des gens, pas dans des
datacenters.

## 2. Le problème

- L'inférence IA est centralisée chez quelques acteurs (coûts datacenter, GPU
  rares, énergie, dépendance).
- Des **milliards** d'appareils (iPhone, Android) embarquent des **NPU**
  puissants (dizaines de TOPS) **inutilisés** la plupart du temps, surtout la
  nuit en charge.
- Les propriétaires de ces appareils ne tirent aucune valeur de ce matériel.

## 3. La solution (vision)

Un protocole qui transforme la **puissance dormante** des appareils grand public
en un **réseau d'inférence mondial**, rémunéré, vérifiable, et accessible via une
API compatible avec l'écosystème existant (OpenAI). Trois acteurs :

| Acteur          | Rôle                                                       |
| --------------- | ---------------------------------------------------------- |
| **Worker**      | Un téléphone qui exécute le modèle et gagne de l'argent.   |
| **Requester**   | Un utilisateur/app qui pose des requêtes (chatbot ou API). |
| **Coordinateur**| Distribue les jobs, vérifie, règle les paiements.          |

## 4. Architecture réelle (v0 — état actuel)

```
Requester (chatbot web / API /v1)
        │  POST job
        ▼
  COORDINATEUR (Next.js + Postgres, Vercel/Neon)
   ├─ File de jobs (Postgres, FOR UPDATE SKIP LOCKED)
   ├─ Vérification (jobs-canaris + réputation)
   ├─ Registre des workers + présence (last_seen)
   └─ Ledger (gains workers, crédits users)
        ▲  GET /jobs/next (long-poll)   │ POST /jobs/:id/result
        │                               ▼
  WORKERS = iPhones (SwiftUI + MLX, modèle Gemma 3 on-device)
```

**Points clés de l'implémentation actuelle :**

- **Coordinateur central** (assumé en v0) : Next.js App Router + Drizzle ORM +
  Neon Postgres, déployable sur Vercel. Pas de broker externe : la file de jobs
  est en Postgres avec `FOR UPDATE SKIP LOCKED` (dispatch atomique, zéro
  collision entre workers).
- **Livraison des jobs** : long-polling HTTP (`GET /jobs/next`, attente ~25 s).
  Simple, sans websocket, coût quasi nul.
- **Modèle on-device** : **Gemma 3** (1B, 4-bit QAT) via **MLX Swift**, exécuté
  sur le GPU/NPU de l'iPhone. Décodage **déterministe** (greedy, temperature 0).
- **API compatible OpenAI** (`/v1/chat/completions`, `/v1/models`) : les apps
  tierces (OpenClaw, etc.) branchent NVP en changeant juste l'URL de base + une
  clé `sk-nvp-…`.
- **Recherche web** : outil gratuit (DuckDuckGo, sans clé API) injecté dans le
  prompt → réponses « augmentées » par le web.

## 5. Vérification (le cœur de la confiance)

Comment être sûr qu'un téléphone a **réellement** calculé, sans tout recalculer
côté serveur ? Trois mécanismes combinés :

1. **Jobs-canaris** (toujours actifs) : une fraction des jobs servis ont une
   **réponse attendue connue** côté serveur (le worker ne sait pas que c'en est
   un). Comparaison exacte (possible grâce au décodage **greedy déterministe**).
   Mauvaise réponse → **rejet + baisse de réputation**.
2. **Redondance échantillonnée** (optionnelle) : un même job envoyé à 2 workers ;
   désaccord → arbitre.
3. **Réputation + gating** : sous un seuil, le worker est **suspendu**.

> Le déterminisme (temperature 0, top-k 1, seed fixe, même modèle/quant) est
> **obligatoire** : sans lui, deux réponses correctes peuvent différer et la
> vérification casse.

## 6. Économie

- **Prix réel en USD** par job, défini dans un module unique (`pricing.ts`) :
  `coût = frais_par_requête + tokens_in×prix_in + tokens_out×prix_out`.
- **Worker** : crédité du prix réel à chaque job accepté (ledger Postgres). Il
  voit ses gains réels et peut demander un **retrait** (statut `requested`, traité
  hors-app en v0 — pas de virement réel encore).
- **Requester (chatbot)** : en **bêta gratuite** — l'utilisateur reçoit un crédit
  de démarrage et **n'est pas débité** (le worker est financé par la plateforme).
  Le passage à la facturation réelle est un simple changement de configuration.
- **Modèle de revenus cible** : marge entre le prix payé par le requester et la
  part reversée au worker (take-rate, réglable ; 0 % en bêta).

## 7. Contraintes assumées (vérités à ne pas masquer)

- **iOS interdit le calcul lourd en arrière-plan prolongé.** Le worker travaille
  **app au premier plan**, idéalement **en charge**. Positionnement produit :
  « gagne pendant que ton téléphone charge la nuit », pas « 24/7 passif ».
- **Petits modèles** : Gemma 3 1B sur device → qualité limitée vs modèles cloud
  géants. L'avantage n'est pas la qualité brute mais l'**accès distribué**, le
  **coût** et la **propriété par les utilisateurs**.
- **Anti-fraude** : clé d'API par appareil + réputation + canaris en v0 ;
  **App Attest (DeviceCheck)** prévu pour prouver que c'est une vraie app non
  trafiquée.
- **Gemma 4 / E2B on-device** : pas encore de port Swift iOS fiable → cible
  future.

## 8. Avantages défendables (moat)

1. **Effet de réseau** : plus de téléphones = plus de capacité, latence plus
   basse, meilleure couverture géo. Difficile à rattraper une fois la base
   installée.
2. **Coût marginal proche de zéro** : pas de capex datacenter ; le matériel
   appartient aux utilisateurs.
3. **Vérification déterministe + réputation** : savoir-faire non trivial.
4. **Distribution & marque** : « le réseau d'IA qui appartient au peuple » — une
   histoire forte, alignée avec la défiance envers les Big Tech.
5. **Compatibilité OpenAI** : adoption sans friction pour les développeurs.

## 9. Feuille de route (de la v0 à la décentralisation)

- **v0 (actuel)** : coordinateur central, chatbot, API, app iOS worker, paiements
  en ledger.
- **v1** : App Attest (anti-fraude), retraits réels (Stripe Connect / seuils),
  SSE/WebSocket, signature cryptographique des résultats, Android.
- **v2** : remplacer le dispatch par un **marché/DHT**, le règlement par des
  **canaux de paiement / L2**, la vérif par **redondance + attestation + preuves
  optimistes** ; pipeline d'activations pour de **gros modèles** répartis sur
  plusieurs appareils. (Détail dans `docs/07-decentralisation.md`.)

## 10. Risques & mitigations

| Risque                                  | Mitigation                                       |
| --------------------------------------- | ------------------------------------------------ |
| iOS limite le background                | Positionnement « en charge / premier plan »      |
| Fraude / faux workers                   | Canaris + réputation + App Attest (v1)           |
| Qualité des petits modèles              | Recherche web, agents serveur, modèles + gros (E2B) |
| Dépendance au coordinateur central      | Roadmap décentralisation (v2)                    |
| Réglementaire (paiements, KYC)          | Seuils de retrait, partenaire paiement (v1)      |

---

*Document vivant — mettre à jour à chaque jalon. Toute diffusion externe requiert
un accord écrit.*
