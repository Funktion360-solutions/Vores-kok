# Fase 1-rapport — Fundament + komplet opskriftsprodukt

*Dato: 25. september 2026*

## Funktionalitet

**Web (Next.js 16)** og **iPhone/iPad (Expo SDK 57)**:

- Konto (e-mail/kodeord, bekræftelse, glemt kodeord på web), profil og visningsnavn
- Husstande: opret, invitér (link, evt. e-mail-bundet, 14 dage, engangs), acceptér, skift, roller ejer/admin/medlem/læser, fjern medlem, forlad, slet
- Opskrifter: gennemse, søg (dansk fuldtekst + trigram + ingredienser), filtrér (kategori, tags, måltid, sværhedsgrad, tid, favoritter, familiehistorie, person, ingredienser, arkiverede), sortér, sideinddeling
- Opskriftsside: struktureret ingrediensliste med sektioner, **deterministisk portionsomregning** med enhedsomregning (g→kg, tsk→spsk, dl→l, intervaller, halve stk), trin, gode råd, favorit, print/"Gem som PDF", arkivér, slet (admin)
- Opret/redigér: alle felter, indsæt-liste-parser ("2½ dl hvedemel"), sektioner, utraditionelle mængder bevares, kategorier og personer oprettes direkte, optimistisk låsning, automatisk versionshistorik + historik-side
- Familiehistorie: personer (relation, år, bio), oprindelse pr. opskrift (person/tekst/år), historier med person/fortæller/år/historisk kontekst, scannede originaler og historiske billeder
- Medier: flere billeder pr. opskrift (foto, original scan, historisk foto, PDF), forsidebillede, billedtekst, cirka-år, kamera på mobil; EXIF/GPS fjernes før upload
- Noter: private eller delt med husstanden
- Mobil: offline-læsning af hele kogebogen, offline favoritter med outbox, lokale kladder ved redigering, iPad split-visning og side-om-side opskrift

## Arkitektur

pnpm + Turborepo-monorepo: `apps/web`, `apps/mobile`, `packages/{domain,validation,database,ui,config}`, `supabase/`, `scripts/{migration,dev}`, `docs/`. Delt forretningslogik (mængder, enheder, skalering, rettigheder, medie-stier), validering (Zod) og dataadgang bruges af både web og mobil. Se [architecture.md](../architecture.md).

## Database-migreringer (anvendt på `tgqwyheqhquwncyloond`)

| Version | Indhold |
|---|---|
| 20260925210027_foundation | Extensions, `private`-skema, profiler, husstande, medlemmer, invitationer, husstands-RPC'er, RLS |
| 20260925210137_recipes | Enheder (referencedata), personer, kategorier, tags, opskrifter, ingredienser, trin, historier, medier, favoritter, noter, versioner, søgevektor-triggere, RLS |
| 20260925210147_storage | Privat bucket `household-media` + storage-policies |
| 20260925210259_recipe_rpc | `save_recipe`, `get_recipe`, `get_recipes_since`, `search_recipes`, `set_favorite`, `set_recipe_archived`; anon-hærdning |
| 20260925210359_fk_indexes | Dækkende indeks for alle fremmednøgler (advisor) + låsning af `rls_auto_enable` |
| 20260925212141_legacy_import | `legacy_import`-skema til sporbar, idempotent migrering |

## Sikkerhedsarbejde

- RLS på alle tabeller, husstand som grænse, ingen `TO authenticated`-only policies (undtagen referencedata `units`)
- Sammensatte FK'er forhindrer krydshusstands-referencer; triggere låser `household_id`/`user_id`; `created_by` stemples server-side
- SECURITY DEFINER kun hvor nødvendigt, i ikke-eksponeret skema eller med eksplicitte tjek — fuld liste i [rls.md](../security/rls.md)
- Privat storage med sti-regex, MIME-whitelist, 25 MB; signerede URL'er; EXIF fjernes
- Web: CSP med nonce, sikkerhedsheadere, open-redirect-beskyttelse, auth-formularer kan ikke sende kodeord i URL før hydrering (fundet og rettet under E2E)
- Mobil: session i Keychain, cache slettes ved log ud
- Legacy-fund dokumenteret og adresseret: offentlige billeder, uvaliderede uploads, SSRF, fejllæk, svage kodeord, ingen familie-isolation
- Supabase-rådgiver: resterende punkter er tilsigtede (dokumenterede SECURITY DEFINER-RPC'er, `legacy_import` uden policies = ingen adgang) + **"Leaked password protection" skal slås til i Dashboard**

## Tests

| Suite | Resultat |
|---|---|
| Unit: domain (38), validation (4), database (4), ui (8), migration (5), mobile (5) | ✓ 64 tests |
| SQL: husstande/roller/invitationer, opskrifts-RLS inkl. IDOR, søgning, storage-policies | ✓ 3 filer, 117 assertions |
| RLS-røgtest direkte mod produktionsprojektet (rullet tilbage) | ✓ viewer kan ikke redigere, udenforstående ser 0 og kan ikke uploade, anon afvist |
| Web E2E (Playwright, desktop + iPhone- og iPad-viewport) | ✓ 6/6: tilmelding → husstand → opskrift med parser → skalering → favorit → historie → scan-upload → note → søgning/filtre → redigering/historik → invitation → læser-rolle |
| Mobil E2E (universel app via react-native-web) | ✓ 2/2: login, søgning, skalering, favorit, genstart uden backend (offline), iPad split |
| Migrering (fixture → import → verify → genkørsel → sen tilmelding) | ✓ 14/14 kontroller, idempotent, favoritter og roller kobles på |
| Typecheck + lint (strict TS, ingen `any`) | ✓ alle 7 pakker |

## Build-status

- `next build` ✓ (alle ruter dynamiske pga. CSP-nonce)
- `expo export --platform ios` ✓ (Hermes-bundle, 4,4 MB) og `--platform web` ✓
- CI-workflow (`.github/workflows/ci.yml`) kører alt ovenstående på GitHub

## Migreringsstatus

Værktøjet er færdigt og generalprøvet. **De rigtige data er ikke migreret endnu**: `morsopskrifter.db` og `App_files` ligger i den gamle servers Docker-volumes og var ikke med i repoet. Fremgangsmåde: [migration-mapping.md](../legacy/migration-mapping.md).

## Kendte begrænsninger

- Opskriftsredigering på mobil kræver forbindelse (kladder bevares lokalt); kun favoritter synkroniseres offline
- Mobil-editoren er tekstbaseret (én ingrediens pr. linje); web har række-editor
- Mobil har ikke glemt-kodeord, sletning af billeder/historier eller rolleadministration — bruges via web
- Ingen egne e-mail-skabeloner (Supabase-standard på engelsk)
- iOS-appen er bundlet, men ikke kørt på fysisk enhed/simulator i dette miljø (ingen macOS); første EAS-build skal testes på iPhone og iPad
- Supabase-typer for RPC-tabelresultater mister null-information; kompenseret med manuelle domænetyper (`RecipeSummary`)

## Teknisk gæld

- Lokal Supabase-emulator til E2E (fordi Docker-images ikke kunne hentes) — erstat med `supabase start` i CI, når muligt
- Storage-oprydning af forældreløse filer er manuel
- Familie-siden på web laver én søgning pr. person for at tælle opskrifter (fint for familie-størrelse, bør samles i én RPC)

## Risici

- Første rigtige migrering: den rigtige database kan indeholde data, fixturen ikke dækker — kør altid `--dry-run` og `verify` først
- Auth-indstillinger (redirect-URL'er, leaked password protection) skal sættes manuelt i Dashboard
- Apple-distribution kræver Apple Developer-konto og EAS-opsætning

## Anbefalet næste arbejde (fase 2)

1. Sæt Auth-indstillinger, deploy web (Vercel), og kør den rigtige migrering + verify
2. EAS-build og test på fysisk iPhone og iPad
3. Fase 2: kogetilstand (timere, skærm-vågen), madplan, indkøbslister med realtime og aggregering, Mit køkken, offline-skrivning for indkøb
