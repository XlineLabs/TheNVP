# 05 — Plan de build · NVP Node v0

Construis dans l’ordre. Fin de chaque jalon : commit + court résumé « ce qui marche / comment tester ».

## M0 — Scaffolding

- Monorepo : `coordinator/` (Next.js TS + Drizzle), `ios/`, `simulator/`, `docs/`, `README.md`.
- Config Neon (`DATABASE_URL`), lint/format, scripts npm.
- **Test** : `npm run dev` démarre le coordinateur, `/api/health` répond 200.

## M1 — Schéma DB + migrations

- Tables Drizzle conformes à `03-api-et-data-model.md`.
- Migration + script de seed (1 modèle, quelques canaris).
- **Test** : migration OK sur Neon, tables visibles, seed inséré.

## M2 — API coordinateur (sans iOS)

- `register`, `models`, `jobs` (submit), `jobs/next` (long-poll + dispatch SKIP LOCKED), `jobs/:id/result` (+ vérif canari), `me/balance`, `me/ledger`, `payouts`.
- Auth Bearer worker + `X-Admin-Token`.
- **Test** : via curl/REST, enregistrer un worker, soumettre un job, le réclamer, soumettre un résultat, voir le solde bouger.

## M3 — Simulateur de worker (TS)

- Script qui : register → boucle (next → “infère” → submit).
- Deux modes : **honnête** (renvoie la bonne réponse pour les canaris, via un mini-modèle ou une table de référence) et **tricheur** (réponses bidon) pour prouver que la vérif rejette.
- **Test** : 100 jobs ; le worker honnête est crédité, le tricheur voit sa réputation chuter et ses canaris rejetés. Solde = exactement les jobs acceptés.

## M4 — Vérification complète

- Canaris (`p_canary`) + redondance optionnelle (`p_redundant`, groupe + arbitre) + réputation/gating.
- **Test** : scénarios désaccord → arbitre tranche, minoritaire pénalisé.

## M5 — App iOS : worker + inférence

- Setup (clés Keychain, register, download modèle), `WorkerView` avec toggle, `InferenceEngine` (MLX) greedy, `WorkerLoop` respectant premier plan + thermal/charge.
- **Test** : sur un vrai iPhone, activer worker, traiter des jobs réels servis par le coordinateur, voir les crédits monter côté serveur.

## M6 — App iOS : Gains + retrait

- `EarningsView` (solde, graphe, historique), `PayoutView` (demande), `SettingsView`.
- **Test** : solde affiché = solde serveur ; une demande de retrait crée une ligne `requested`.

## Definition of done (rappel)

Les 5 critères de `01-prd.md` passent : compteur exact, canari rejeté, app iOS qui infère et affiche le solde live, retrait `requested`, tout lançable depuis le README.

## Pistes post-v0 (ne pas faire maintenant)

App Attest anti-fraude · SSE/WebSocket · Stripe Connect + seuil de retrait · Android · puis la grande étape : pipeline d’activations NVP-D (v2) pour les gros modèles.