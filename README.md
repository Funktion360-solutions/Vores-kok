# Vores Kok

Familiens fælles, private digitale køkken — kogebog, familiehistorie og (snart) madplan, indkøb, køkken og kogetilstand. Afløser for *Mors Opskrifter*.

- **Web**: Next.js 16 (`apps/web`) — desktop, tablet og mobil-browser
- **iPhone/iPad**: Expo / React Native (`apps/mobile`) — én universel app med offline-cache og iPad-split-visning
- **Backend**: Supabase (Postgres + RLS, Auth, Storage) — projekt `tgqwyheqhquwncyloond`
- **Delt TypeScript**: forretningslogik, validering og dataadgang i `packages/*`

## Kom i gang

```bash
corepack enable && pnpm install
cp apps/web/.env.example apps/web/.env.local
pnpm --filter @vores-kok/web dev          # http://localhost:3000
cd apps/mobile && cp .env.example .env && pnpm start
```

## Kvalitet

```bash
pnpm turbo run typecheck lint test   # alle pakker
pnpm db:test                         # migreringer + RLS/storage-tests (lokal Postgres)
pnpm e2e:web                         # Playwright: web-appen end-to-end
pnpm e2e:mobile                      # Playwright: mobil-appens web-build (offline, iPad)
pnpm migration:rehearse              # generalprøve på migrering fra Mors Opskrifter
```

## Dokumentation

| Emne | Fil |
|---|---|
| Arkitektur og beslutninger | [docs/architecture.md](docs/architecture.md) |
| Opsætning, miljøvariabler, Supabase, deploy | [docs/setup.md](docs/setup.md) |
| Sikkerhed, RLS, storage, roller | [docs/security/rls.md](docs/security/rls.md) |
| Mobil og offline/synkronisering | [docs/mobile.md](docs/mobile.md) |
| Gennemgang af Mors Opskrifter | [docs/legacy/audit.md](docs/legacy/audit.md) |
| Migrering fra Mors Opskrifter | [docs/legacy/migration-mapping.md](docs/legacy/migration-mapping.md) |
| Backup, gendannelse, drift | [docs/operations.md](docs/operations.md) |
| AI-plan (fase 3) | [docs/ai.md](docs/ai.md) |
| Fase 1-rapport | [docs/reports/phase-1.md](docs/reports/phase-1.md) |

## Faser

1. **Fundament + komplet opskriftsprodukt** — denne leverance
2. Komplet køkkenplatform: kogetilstand, madplan, indkøb (realtime), Mit køkken, familie, bedre offline
3. Intelligens + import + produktionsklarhed
