# NVP Node v0

MVP of a **distributed AI inference network**: iPhones act as workers running a
small language model on-device, process inference jobs from a central
coordinator, and their owners earn credits they can watch accrue and request to
withdraw. Target on-device model: **Gemma 4 E2B** (4-bit MLX).

See [`docs/`](docs/) for the full specs (read `01-prd` → `06-integration-mlx-gemma4`).

## Repo layout

```
coordinator/   # Next.js (App Router, TS) + Drizzle + Neon Postgres — API + job queue + ledger
ios/           # SwiftUI worker app (on-device inference via MLX + Gemma 4 port)
simulator/     # fake worker in TypeScript — validates the whole backend without a phone
scripts/       # Mac: model validation + canary generation (Python mlx-lm)
docs/          # the 6 specs
```

## Prerequisites

- **Node 20+** and **pnpm 9+** (`npm i -g pnpm`)
- A **Neon Postgres** database (free tier) — get a `DATABASE_URL`
- For the iOS app + model validation: a **Mac with Apple Silicon** + Xcode (see
  [`docs/06`](docs/06-integration-mlx-gemma4.md)). The coordinator and simulator
  run on any platform.

## 1. Coordinator

```bash
pnpm install                      # from repo root (installs coordinator + simulator)
cd coordinator
cp .env.example .env.local        # then edit: set DATABASE_URL (Neon) + ADMIN_TOKEN
pnpm dev                          # http://localhost:3000
curl http://localhost:3000/api/health   # -> {"status":"ok",...}
```

The Neon DB + secrets are **baked into the code** (`coordinator/app/lib/defaults.ts`)
so it runs with zero config. Override any of `DATABASE_URL`, `ADMIN_TOKEN`,
`JWT_SECRET` via env vars / `.env.local` for production (and rotate the Neon
password — see the security note in that file).

### Database (Drizzle migrations + seed)

```bash
cd coordinator
pnpm db:generate   # generate SQL migration from the Drizzle schema (only after schema changes)
pnpm db:migrate    # apply migrations to DATABASE_URL
pnpm db:seed       # seed models (Gemma 4 E2B + Qwen2.5-0.5B) and canary jobs
```

### Web app (chatbot + accounts)

With the coordinator running:

- `/` — landing page
- `/signup` — create an account (gets **$1500** free USD credit)
- `/chat` — ChatGPT-style chatbot. Each message becomes an inference job answered
  by a **real iPhone worker**; the user is billed the real USD cost and the phone
  is paid the same amount (see pricing in `coordinator/app/lib/pricing.ts`).
- `/test` — requester test page (submit raw jobs with the admin token)

> A chat reply only appears when a worker is online to answer. Run the iPhone app
> (or, for backend testing only, the simulator) so jobs get processed.

## 2. Simulator (fake worker)

A TypeScript fake worker that validates the whole backend without a phone. It is
a **test/CI harness only** — it never produces real chatbot answers (those come
from real iPhones). Honest mode answers canaries from the shared
`scripts/canaries.json` reference table; cheat mode returns garbage.

```bash
# with the coordinator running (and seeded), from repo root:
cd simulator

# self-contained proof: injects fresh canaries, runs a cheater (all rejected,
# balance 0), then an honest worker (all accepted, balance == sum credited).
ADMIN_TOKEN=dev-admin-token-local pnpm demo

# or run a single worker against a running coordinator:
COORDINATOR_URL=http://localhost:3000 pnpm honest   # or: pnpm cheat
pnpm start --mode honest --models qwen2_5_0_5b --max 100
```

## 3. iOS app

SwiftUI worker app. The Xcode project is generated from `ios/project.yml` with
[XcodeGen](https://github.com/yonaskolb/XcodeGen):

```bash
brew install xcodegen
cd ios && xcodegen generate && open NVPNode.xcodeproj
```

Set the coordinator URL in the app's **Settings** (or `Config.defaultCoordinatorURL`).
Onboarding registers the device; the **Worker** tab toggles the earning loop; the
**Earnings** tab shows the live USD balance + withdrawal. See [`ios/README.md`](ios/README.md)
and [`docs/06`](docs/06-integration-mlx-gemma4.md).

### Unsigned IPA (GitHub Actions)

`.github/workflows/ios-unsigned-ipa.yml` builds an unsigned `.ipa` on a macOS
runner (manual run, push to `ios/**`, or tag `v*`); the IPA is uploaded as an
artifact and attached to releases on tags.

## 4. Model validation & canaries (Mac, Apple Silicon)

_Scripts in `scripts/`. See `docs/06` §5 and §8. Run these on a Mac to generate
real Gemma 4 reference outputs; until then a placeholder `scripts/canaries.json`
keeps the backend testable._

## Deploying the coordinator (Vercel + Neon)

**Full step-by-step guide: [`docs/08-deploiement-vercel.md`](docs/08-deploiement-vercel.md).**
The DB + secrets are baked in, so the short version is: import the repo in Vercel,
set **Root Directory = `coordinator`**, deploy. (Migrations are already applied to
the baked-in Neon DB.) Quick version below:

1. Push this repo to GitHub (done) and import it in **Vercel**.
2. Set the project's **Root Directory** to `coordinator/`.
3. Add env vars (Project → Settings → Environment Variables):
   `DATABASE_URL` (Neon **pooled** URL), `ADMIN_TOKEN`, `JWT_SECRET`.
4. Deploy. Run migrations + seed against the same `DATABASE_URL`:
   `cd coordinator && pnpm db:migrate && pnpm db:seed`.
5. In the iOS app **Settings**, set the Coordinator URL to your Vercel URL
   (e.g. `https://<project>.vercel.app`), or edit `Config.defaultCoordinatorURL`.

Now: open the app → become a worker; open `/chat` on the web → messages are
answered by the phone, which earns real USD.

## Build milestones

Tracked in [`docs/05-build-plan.md`](docs/05-build-plan.md): **M-prep** (Mac
model validation) → **M0** scaffolding → **M1** schema/seed → **M2** API →
**M3** simulator → **M4** verification → **M5/M6** iOS.
