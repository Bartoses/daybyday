# DaybyDay

The parenting companion that grows with families, one day at a time.

Monorepo for the DaybyDay platform (iOS / Android / Web + backend). The legacy Google Apps
Script SMS system lives at the repo root (`*.gs`/`*.js`) and runs untouched until SMS sunset;
the new platform lives under `apps/`, `packages/`, `workers/`, and `tools/`.

See [`docs/`](docs/00-INDEX.md) for the full PRD, architecture, DB design, API spec, and build plan.

## Layout

```
apps/
  api/        Node + Fastify backend (Supabase JWT, Twilio-signed SMS webhook)
  mobile/     Expo (React Native) app — iOS / Android / Web  (full app: EPIC 7)
packages/
  schemas/    Shared Zod types + enums ported from APP_CONFIG (source of truth)
  db/         Supabase migrations, RLS, reference seed data
workers/      (cron daily-send — Phase 1 EPIC 6)
tools/        (Sheets → Postgres content importer — Phase 1 EPIC 2)
docs/         Product + engineering documentation
```

## Develop

```bash
corepack enable pnpm        # one-time
pnpm install
pnpm typecheck              # all packages
pnpm test                   # unit/integration tests
pnpm lint
```

### Database (local Supabase)

```bash
# requires the Supabase CLI
cd packages/db
supabase start
supabase db reset           # applies migrations + seed.sql
```

### API

```bash
cp .env.example .env        # fill in secrets — NEVER commit .env (audit R2)
pnpm --filter @daybyday/api dev
curl localhost:8080/health
```

## Status

Epic 1 (platform foundation) scaffolded: monorepo + tooling, shared schemas, Supabase schema
with RLS and seed data, API skeleton with Twilio signature validation, and CI. Next: EPIC 2
(content import) and EPIC 3 (tip-selection engine port). See
[docs/10-BUILD-PLAN.md](docs/10-BUILD-PLAN.md).
