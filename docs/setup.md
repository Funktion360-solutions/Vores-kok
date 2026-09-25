# Opsætning

## Krav

Node 22+, pnpm 10 (`corepack enable`). Til database-tests: PostgreSQL 15+ binære filer (`initdb`, `pg_ctl`) — findes på de fleste Linux/macOS-installationer (`brew install postgresql@16`).

```bash
pnpm install
pnpm test          # unit-tests (domain, validation, database, ui, migration, mobile)
pnpm db:test       # alle migreringer + RLS/storage-tests på en lokal throwaway-Postgres
pnpm e2e:web       # Playwright mod web-appen + lokal Supabase-emulator
pnpm e2e:mobile    # Playwright mod mobil-appens web-build (offline + iPad-split)
pnpm migration:rehearse
```

## Miljøvariabler

| App | Variabel | Offentlig? | Hvor |
|---|---|---|---|
| web | `NEXT_PUBLIC_SUPABASE_URL` | ja | `https://tgqwyheqhquwncyloond.supabase.co` |
| web | `NEXT_PUBLIC_SUPABASE_ANON_KEY` | ja | Publishable key (`sb_publishable_…`) fra Project Settings → API keys |
| web | `NEXT_PUBLIC_SITE_URL` | ja | Web-appens offentlige adresse (bruges i e-mails og invitationslinks) |
| mobile | `EXPO_PUBLIC_SUPABASE_URL`, `EXPO_PUBLIC_SUPABASE_ANON_KEY`, `EXPO_PUBLIC_SITE_URL` | ja | Samme værdier |
| migration | `DATABASE_URL`, `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` | **nej** | Kun i din terminal ved import |

Kopiér `apps/web/.env.example` → `apps/web/.env.local` og `apps/mobile/.env.example` → `apps/mobile/.env`. `.env*` er git-ignoreret.

## Supabase

Projektet `tgqwyheqhquwncyloond` (eu-west-1) har allerede alle migreringer. Nye migreringer:

```bash
npx supabase link --project-ref tgqwyheqhquwncyloond
npx supabase migration new <navn>      # skriv SQL
pnpm db:test                           # test lokalt først
npx supabase db push                   # anvend på projektet
pnpm db:types                          # regenerér packages/database/src/database.gen.ts
```

**Manuelle indstillinger i Dashboard** (kan ikke sættes via migreringer):

1. Authentication → URL Configuration: *Site URL* = web-adressen. *Redirect URLs*: `https://<web>/auth/callback`, `http://localhost:3000/auth/callback`, `voreskok://**`.
2. Authentication → Sign In / Providers → Email: behold "Confirm email" slået til.
3. Authentication → Policies: minimum kodeordslængde 10, "Prevent use of leaked passwords".
4. Authentication → Emails: tilpas skabelonerne til dansk (valgfrit).

## Web — lokalt og i drift

```bash
pnpm --filter @vores-kok/web dev        # http://localhost:3000
pnpm --filter @vores-kok/web build
```

Deploy på Vercel: Root Directory `apps/web`, build command `cd ../.. && pnpm turbo run build --filter=@vores-kok/web`, sæt de tre `NEXT_PUBLIC_*`-variabler. Alternativt `next start` bag en reverse proxy med HTTPS.

## Mobil

Se [mobile.md](mobile.md).
