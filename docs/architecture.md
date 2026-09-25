# Arkitektur

```
vores-kok/
├─ apps/
│  ├─ web/          Next.js 16 (App Router, React 19, Tailwind 4) — fuld klient til desktop/tablet/mobil-browser
│  └─ mobile/       Expo SDK 57 / React Native 0.86 — én universel app til iPhone og iPad (Android muligt senere)
├─ packages/
│  ├─ domain/       Ren forretningslogik: mængder, enheder, portionsomregning, tid, rettigheder, medie-stier
│  ├─ validation/   Zod-skemaer ved alle grænser (formularer, RPC-payloads, dokumenter fra databasen, filtre)
│  ├─ database/     Genererede Supabase-typer + delte forespørgsler (bruges af web OG mobil) + lokal filtrering
│  ├─ ui/           Design tokens (farver, radius, størrelser) → tokens.css til web, direkte import i mobil
│  └─ config/       Fælles tsconfig og ESLint
├─ supabase/
│  ├─ migrations/   SQL-migreringer (versioner matcher det rigtige projekt)
│  ├─ tests/        SQL-tests af RLS, storage-policies, RPC'er og constraints
│  └─ config.toml   Supabase CLI-konfiguration
├─ scripts/
│  ├─ migration/    Import fra Mors Opskrifter + verifikation + fixture
│  └─ dev/          Lokal Postgres, Supabase-emulator til tests, E2E-runnere
└─ docs/
```

`pnpm` workspaces + Turborepo. Delte pakker publiceres ikke; de eksporterer TypeScript-kilde, som Next (`transpilePackages`) og Metro kompilerer direkte. `node-linker=hoisted` er valgt, fordi React Native/Metro er mest stabil med et fladt `node_modules` i monorepos.

## Dataflow

- **Ingen egen backend.** Web og mobil taler direkte med Supabase (PostgREST, Auth, Storage) med brugerens JWT. Al autorisation sker i databasen via RLS.
- **RPC'er for sammensatte operationer**: `save_recipe` (atomisk opskrift + ingredienser + trin + tags, optimistisk låsning, versionshistorik), `get_recipe` (ét JSON-dokument pr. opskrift — samme form bruges til mobilens offline-cache), `search_recipes` (rangeret søgning + filtre), husstands-RPC'er.
- **Server Components** i web henter data på serveren med brugerens session (cookie via `@supabase/ssr`); interaktive dele (redigering, favorit, upload) er klientkomponenter, der kalder de samme delte funktioner i `@vores-kok/database`.
- **Mobil** læser altid fra en lokal kopi af husstandens opskrifter og synkroniserer i baggrunden (se [mobile.md](mobile.md)).
- **Edge Functions** er reserveret til betroede operationer (AI, URL-import, OCR) i fase 3. Almindelig CRUD går ikke gennem Edge Functions.

## Vigtige beslutninger (ADR)

| # | Beslutning | Begrundelse |
|---|---|---|
| 1 | Husstand er autorisationsgrænsen; rolle læses fra `household_members`, aldrig fra JWT-metadata | Brugerredigerbar metadata må ikke styre adgang |
| 2 | Alle børnetabeller har `household_id` + sammensat FK `(parent_id, household_id)` | Umuliggør krydshusstands-referencer (IDOR) selv ved fejl i en policy; hurtige RLS-tjek uden joins |
| 3 | `private`-skema til SECURITY DEFINER-hjælpere; ikke eksponeret i API'et | Undgår RLS-rekursion og holder privilegeret kode uden for API'et |
| 4 | Opskriftslagring via `save_recipe` (SECURITY INVOKER) | Atomisk, RLS gælder uændret; versionssnapshot + `version`-tjek giver konfliktdetektering |
| 5 | Mængder struktureret (`quantity`, `quantity_max`, `unit`, `unit_code`) + `original_text` altid bevaret | Portionsomregning og fremtidig indkøbsaggregering uden at miste familiens formuleringer |
| 6 | Portionsomregning er ren, deterministisk TypeScript i `domain` | Ingen AI til matematik; samme resultat på web og mobil; unit-testet |
| 7 | Én privat bucket `household-media` med sti `<husstand>/<type>/<id>/<uuid>.<ext>` | Storage-policies kan udlede husstand fra stien; klienten vælger aldrig selv filnavn |
| 8 | Billeder genkodes på klienten (canvas / expo-image-manipulator) før upload | Fjerner EXIF/GPS (privatliv) og begrænser størrelse |
| 9 | Print-stylesheet i stedet for server-PDF | Ingen serverkomponent; browserens "Gem som PDF" giver samme resultat som legacy QuestPDF |
| 10 | Mobil offline = eksplicit dokument-cache + outbox (kun favoritter i fase 1) | Forudsigelig adfærd; opskriftsredigering kræver forbindelse, men kladder gemmes lokalt |
| 11 | Madplan/indkøb/køkken-tabeller oprettes først i fase 2 | Spec: ingen tabeller "bare fordi" — de designes sammen med funktionerne |
| 12 | Lokal Supabase-emulator (`scripts/dev/local-supabase.mjs`) til E2E | Docker-images kan ikke hentes i byggemiljøet; emulatoren kører alle forespørgsler som `SET ROLE authenticated` + JWT-claims ligesom PostgREST, så RLS testes for alvor |
