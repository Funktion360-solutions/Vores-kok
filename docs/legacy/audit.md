# Mors Opskrifter — gennemgang af den gamle app

> Kilde: `Mors-Opskrifter-master` (ASP.NET Core 10 MVC, commit fra maj 2026). Denne gennemgang er grundlaget for Vores Kok. Den gamle app bevares som arkiv, indtil migreringen er verificeret mod de rigtige data.

## Arkitektur

| Del | Legacy |
|---|---|
| Runtime | ASP.NET Core 10 MVC (Razor views + jQuery/vanilla JS i `wwwroot/js/site.js`, ~1.200 linjer) |
| Database | SQLite via EF Core 10 (`App_dbs/morsopskrifter.db`), én migration: `20260531190801_InitialCreate` |
| Filer | Uploadede billeder på disk i `App_files/` (GUID-filnavn), serveret af `RecipesController.Image` |
| Auth | ASP.NET Identity med cookie (30 dage, sliding), roller `Administrator` / `User` |
| PDF | QuestPDF (Community-licens) — `DownloadPdf` genererer en A4-side pr. opskrift |
| AI | Ollama (`gemma4:latest`) på en fast intern IP (`http://10.64.50.30:11434/api`) til at udtrække opskrifter fra hjemmesider |
| Drift | Dockerfile + docker-compose med to volumes (`app_dbs`, `app_files`) |

Databasefilen og billederne ligger i Docker-volumes og er **ikke** med i repoet. Migreringen er derfor bygget og testet mod en syntetisk database med præcis samme skema (se `scripts/migration/src/fixture.ts`).

## Datamodel

| Tabel | Kolonner | Bemærkninger |
|---|---|---|
| `Recipes` | Id, Title (200), Category (tekst!), CategoryIcon, PrepTimeMinutes, CookTimeMinutes, Servings, Difficulty (`Let`/`Middel`/`Svær` som tekst), Author (100, default "Mor"), LastModified (lokal tid som tekst), Notes, OriginalImagePath | Kategori gemt som **navn**, ikke fremmednøgle. 0 bruges som "ikke angivet" for tider og portioner. |
| `Ingredients` | Id, RecipeId, Amount (tekst, fx "2½"), Unit (tekst), Name | Ingen sortering ud over Id. Seed-data gemmer "1 æg" som `Amount=1, Unit="æg", Name=""`. |
| `RecipeSteps` | Id, RecipeId, SortOrder, Text | Seeder bruger 1..n, UI'et 0..n. |
| `Categories` | Id, Name, Icon | Ikon-navne: bread, cake, cookie, croissant, … Sletning nulstiller opskrifternes kategori-tekst. |
| `UserFavorites` | UserId, RecipeId | Personlige favoritter. |
| `AspNetUsers` + roller | Id, UserName, DisplayName, Email (valgfri), PasswordHash … | Første bruger oprettes via `/Setup` og bliver Administrator. |

## Funktioner (bevaret / forbedret i Vores Kok)

| Legacy-funktion | Vores Kok (fase 1) |
|---|---|
| Opskriftsliste med søgning i titel + kategori | Fuldtekst (dansk stemming), trigram og ingredienssøgning + filtre (kategori, tags, sværhedsgrad, tid, måltid, favoritter, familiehistorie, person, ingredienser) |
| Opskriftsdetalje, ingredienser, trin, "Mine noter" | Samme + sektioner, struktureret mængde/enhed, historier, originaler, private/fælles noter |
| "Skalér"-knap | I den gamle app udvidede den kun visningen. Vores Kok har **rigtig portionsomregning** (deterministisk, med enhedsomregning) |
| Favoritter pr. bruger (egen side) | Favoritter pr. bruger, filter + forside-hylde; migreres |
| Opret/rediger opskrift (kun Administrator), billede med beskæring | Opret/rediger for rollen *medlem*+, flere billeder pr. opskrift, EXIF fjernes |
| Slet opskrift (kun Administrator) | Slet kræver *admin*; medlemmer kan arkivere |
| Kategoristyring (tilføj/omdøb/ikon/slet) | Samme under Indstillinger; kategori er nu en rigtig relation |
| Brugerstyring (opret bruger med kodeord, roller) | Husstande med invitationslinks og fire roller (ejer/admin/medlem/læser) |
| Print + PDF-download (QuestPDF) | Print-stylesheet → "Gem som PDF" i browserens printdialog (ingen serverkomponent) |
| AI-scan af URL: JSON-LD først, derefter Ollama | Flyttes til fase 3 (Edge Function med samme strategi: Schema.org først, AI som fallback) |
| Fejlsider (404/403/500) | Next.js error/not-found med danske tekster, ingen tekniske detaljer |

## Sikkerhedsgennemgang (fund i legacy)

| # | Fund | Risiko | Håndtering i Vores Kok |
|---|---|---|---|
| 1 | `Image`-endpointet er `[AllowAnonymous]` — alle billeder kan hentes uden login, hvis man kender filnavnet | Privatlivslæk af familiebilleder | Privat bucket, adgang via RLS pr. husstand, kortlivede signerede URL'er |
| 2 | Uploads valideres ikke: filtype tages fra klientens filnavn, ingen størrelsesgrænse, ingen MIME-kontrol | Upload af vilkårlige filer / stored XSS via SVG/HTML | Bucket med MIME-whitelist + 25 MB grænse, sti-regex i storage-policy, klient-genkodning, magic-byte-tjek i migrering |
| 3 | `AiScanUrl` henter vilkårlige URL'er fra serveren (inkl. interne adresser) | SSRF mod det interne netværk (fx Ollama-serveren) | Ikke porteret. Fase 3: Edge Function med allowlist af schemes, blokering af private IP-intervaller, størrelses- og tidsgrænser |
| 4 | Fejlbeskeder returnerer `ex.Message` til klienten | Informationslæk | Fejl mappes til danske brugerbeskeder (`toDataError`); detaljer logges kun server-side |
| 5 | Ingen lockout (`lockoutOnFailure: false`), kodeord min. 6 tegn uden krav | Brute force | Supabase Auth rate limits; min. 10 tegn i UI (sæt også minimum i Supabase → Auth → Policies) |
| 6 | Ollama-endpoint på fast intern IP i `appsettings.json` | Konfiguration i kode | AI-nøgler kun som Edge Function secrets (fase 3) |
| 7 | Autorisation kun på controller-niveau (`[Authorize(Roles=…)]`); alle brugere ser alle opskrifter | Ingen isolation mellem familier | Husstand som autorisationsgrænse håndhævet af RLS i databasen |
| 8 | Ingen CSRF-beskyttelse på `ToggleFavorite`, `DeleteRecipe`, `UpdateRecipe` (ingen `[ValidateAntiForgeryToken]`) | CSRF | Supabase-kald bruger Bearer-token (ikke cookie-auth til data-API'et); Next.js server actions har indbygget origin-tjek |
| 9 | Setup-siden giver den første besøgende administratorrettigheder | Overtagelse af ny installation | Ingen "første bruger"-mekanik; alle opretter egen husstand |

## Data der skal bevares

Opskrifter (inkl. forfatter, sidst ændret, noter), ingredienser (med original tekst), trin (rækkefølge), kategorier (inkl. ikon og kategorinavne der kun findes på opskrifter), billeder, favoritter og brugere (navn, e-mail, rolle). Kodeord kan **ikke** flyttes: ASP.NET Identity bruger PBKDF2-hashes, Supabase Auth bruger bcrypt. Familien genindtræder via invitationslinks, og deres favoritter kobles på automatisk (se [migration-mapping.md](migration-mapping.md)).
