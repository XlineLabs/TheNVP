# 08 — Déployer le coordinateur sur Vercel (pas à pas)

Objectif : mettre le coordinateur (API + chatbot web) en ligne sur Vercel avec
Neon Postgres, pour qu'un vrai iPhone et le chatbot web puissent s'y connecter en
HTTPS. Compte un déploiement en ~15 min.

## ⚡ Voie express (la base est déjà câblée)

La base Neon et les secrets sont **déjà dans le code** (`coordinator/app/lib/defaults.ts`)
et la base est **déjà migrée + seedée**. Donc le minimum vital :

1. Vercel → **Add New… → Project** → choisis le repo `IA-Revolution-Protocol`.
2. **Root Directory** → *Edit* → choisis **`coordinator`**.
3. Clique **Deploy**. (Aucune variable d'env à mettre.)
4. Ouvre `https://<ton-url>.vercel.app/signup` → crée un compte ($1500) → `/chat`.

C'est tout. Les sections ci-dessous sont pour : changer la base, sécuriser la prod
(remettre des secrets via variables d'env + rotation du mot de passe Neon), ou
comprendre chaque réglage.

---

## 0. Prérequis

- Le repo sur GitHub (déjà fait).
- Un compte **Neon** (gratuit) → une base Postgres.
- Un compte **Vercel** (gratuit) connecté à ton GitHub.
- En local : Node 20+ et `pnpm` (pour lancer migrations + seed une fois).

## 1. Base de données Neon

1. Crée un projet Neon → une base (ex. `neondb`).
2. Récupère la **connection string POOLED** (Neon → Dashboard → *Connection
   string* → coche **Pooled connection**). Elle ressemble à :
   ```
   postgresql://USER:PASSWORD@ep-xxxx-pooler.REGION.aws.neon.tech/neondb?sslmode=require&channel_binding=require
   ```
   ⚠️ Utilise bien l'endpoint **-pooler** : le coordinateur parle à Postgres en
   **HTTP** (driver `@neondatabase/serverless`), idéal pour le serverless Vercel
   et insensible au blocage du port 5432.

## 2. Secrets

Génère deux secrets forts (terminal) :
```bash
openssl rand -hex 32   # -> ADMIN_TOKEN
openssl rand -hex 32   # -> JWT_SECRET
```
- `ADMIN_TOKEN` : protège les endpoints admin + la soumission de jobs requester.
- `JWT_SECRET` : signe les cookies de session du chatbot.

## 3. Migrer + seeder la base (une fois, en local, vers la prod)

Depuis le repo :
```bash
cd coordinator
# pointe temporairement vers la base de prod :
DATABASE_URL="postgresql://...-pooler...neon.tech/neondb?sslmode=require&channel_binding=require" pnpm db:migrate
DATABASE_URL="postgresql://...-pooler...neon.tech/neondb?sslmode=require&channel_binding=require" pnpm db:seed
```
(Ou mets ces valeurs dans `coordinator/.env.local` et lance `pnpm db:migrate && pnpm db:seed`.)
Tu dois voir « Migrations complete » puis « Seeded 2 models / 12 canary jobs ».

## 4. Importer le projet sur Vercel

1. Vercel → **Add New… → Project** → choisis le repo `IA-Revolution-Protocol`.
2. **Root Directory** : clique *Edit* et choisis **`coordinator`** (essentiel —
   l'app Next.js est dans ce sous-dossier).
3. **Framework Preset** : Next.js (détecté automatiquement).
4. **Build & Output** : laisse par défaut (Install: `pnpm install`, Build:
   `next build`). Rien à changer.

## 5. Variables d'environnement (Vercel)

Project → **Settings → Environment Variables** → ajoute pour *Production*
(et *Preview* si tu veux) :

| Name           | Value                                              |
| -------------- | -------------------------------------------------- |
| `DATABASE_URL` | la connection string **pooled** Neon (étape 1)     |
| `ADMIN_TOKEN`  | le secret de l'étape 2                             |
| `JWT_SECRET`   | l'autre secret de l'étape 2                        |

Puis **Deploy** (ou redeploy si tu as ajouté les variables après le 1er build).

## 6. Vérifier que ça marche

Remplace `<URL>` par l'URL Vercel (ex. `https://ton-projet.vercel.app`) :

```bash
# santé
curl https://<URL>/api/health           # -> {"status":"ok",...}

# le chatbot
# ouvre https://<URL>/signup  -> crée un compte (tu reçois $1500)
# ouvre https://<URL>/chat    -> envoie un message

# soumettre un job en tant que requester (admin token)
curl -X POST https://<URL>/api/jobs \
  -H "content-type: application/json" -H "x-admin-token: <ADMIN_TOKEN>" \
  -d '{"model":"gemma_4_e2b_it_4bit","prompt":"hello","max_tokens":32}'
```

> Tant qu'aucun worker (iPhone) n'est en ligne, un message de chat attend ~55 s
> puis renvoie « No workers are online ». C'est normal : connecte un iPhone
> (app → *Become a worker*) ou, pour tester le backend seulement, lance le
> simulateur : `cd simulator && COORDINATOR_URL=https://<URL> pnpm honest`.

## 7. Connecter l'app iOS

Dans l'app → onglet **Settings** → *Coordinator URL* = `https://<URL>` → *Save*.
(Ou édite `Config.defaultCoordinatorURL` avant de builder.)

## Notes « bien fonctionner »

- **Durées des fonctions** : le long-poll `/api/jobs/next` tient ~25 s et `/api/chat`
  ~55 s. Le plan **Hobby** de Vercel autorise `maxDuration` jusqu'à 60 s (déjà
  configuré dans les routes). Si ton plan limite plus bas, réduis `LONG_POLL_MS`
  (`app/api/jobs/next/route.ts`) et `ANSWER_TIMEOUT_MS` (`app/lib/chat.ts`).
- **Pas de port 5432** : on parle à Neon en HTTPS, donc aucun souci de pare-feu
  ni de pooling TCP côté serverless.
- **Migrations** : ne sont **pas** rejouées au build. Relance `pnpm db:migrate`
  (vers la prod) seulement quand le schéma change.
- **Sécurité** : garde `ADMIN_TOKEN` et `JWT_SECRET` secrets ; ne les commit jamais
  (`.env.local` est gitignoré). Pour invalider toutes les sessions, change
  `JWT_SECRET` et redeploy.
- **Domaine** : ajoute un domaine perso dans Vercel → Settings → Domains (option).
