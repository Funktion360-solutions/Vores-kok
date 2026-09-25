# Migrering: Mors Opskrifter → Vores Kok

Værktøjet ligger i `scripts/migration`. Det læser den gamle SQLite-fil **skrivebeskyttet**, bygger en plan (ren funktion, unit-testet), uploader billeder og skriver alt andet i én transaktion. Det er idempotent og kan køres igen.

## Sådan kører du den rigtige migrering

1. Hent data fra den gamle server (Docker-volumes):
   ```bash
   docker cp <container>:/app/App_dbs/morsopskrifter.db ./legacy/
   docker cp <container>:/app/App_files ./legacy/App_files
   ```
2. Log ind i Vores Kok (web) og opret husstanden. Kopiér husstandens id (Supabase → Table editor → `households`) — eller brug `select id, name from households;` i SQL-editoren.
3. Tørkørsel (skriver intet, viser advarsler):
   ```bash
   pnpm --filter @vores-kok/migration import -- --sqlite ./legacy/morsopskrifter.db --dry-run
   ```
4. Rigtig import. Miljøvariablerne sættes **kun i din terminal** — de må aldrig committes:
   ```bash
   # Kopiér "Session pooler"-strengen fra Supabase → Connect (projekt tgqwyheqhquwncyloond)
   export DATABASE_URL='postgresql://postgres.tgqwyheqhquwncyloond:<DB-KODEORD>@<pooler-host>:5432/postgres'
   export SUPABASE_URL='https://tgqwyheqhquwncyloond.supabase.co'
   export SUPABASE_SERVICE_ROLE_KEY='<secret key fra Project Settings → API keys>'
   pnpm --filter @vores-kok/migration import -- \
     --sqlite ./legacy/morsopskrifter.db --files ./legacy/App_files \
     --household <HUSSTANDS-ID> --invite --site-url https://<din-web-adresse>
   ```
5. Verifikation (skal ende med "Alle kontroller bestået"):
   ```bash
   pnpm --filter @vores-kok/migration verify -- --sqlite ./legacy/morsopskrifter.db --household <HUSSTANDS-ID>
   ```
6. Del invitationslinksene fra `migration-report.json` direkte med familien, og **slet filen** bagefter (den indeholder hemmelige links).
7. Når familiemedlemmer har oprettet konto, kør import igen (trin 4 uden `--invite`): de kobles på husstanden med deres gamle rolle, og deres favoritter tilføjes.
8. Behold den gamle app og dens volumes som arkiv, indtil I har brugt Vores Kok en periode.

Generalprøve lokalt: `pnpm migration:rehearse` (fixture → import → verify → genkørsel → sen tilmelding).

## Tabel-mapping

| Legacy | Vores Kok | Regel |
|---|---|---|
| `Categories` | `categories` | Navn trimmes; dubletter (uden for store/små bogstaver) slås sammen; ukendt ikon → `cookie`; `legacy_id` gemmes. |
| `Recipes.Category` (tekst) | `recipes.category_id` | Matcher kategori på navn. Kategorinavne der kun findes på opskrifter (slettet kategori) oprettes. |
| `Recipes.CategoryIcon` | `recipes.legacy_category_icon` | Bevares ordret (legacy kunne have ikon pr. opskrift). |
| `Recipes.Title` | `title` | Tom titel → "Opskrift #id" (advarsel). |
| `PrepTimeMinutes`, `CookTimeMinutes`, `Servings` | `prep_minutes`, `cook_minutes`, `servings` | **0 → tom** (legacy-formularens standardværdi betød "ikke angivet"). |
| `Difficulty` | `difficulty` | Let→easy, Middel→medium, Svær→hard; ukendt → tom (advarsel). |
| `Author` | `legacy_author` | Vises som "Forfatter" under Oprindelse. |
| `LastModified` | `legacy_last_modified` | Tolkes som dansk lokaltid (CET/CEST) → UTC. |
| `Notes` | `notes` ("Gode råd") | Uændret. |
| `OriginalImagePath` | `recipe_media` (kind `photo`, forsidebillede) | Filen læses fra `App_files`, typen bestemmes ud fra filens indhold (ikke navnet), EXIF/GPS fjernes, max 25 MB, uploades til `household-media/<husstand>/recipes/<opskrift>/<uuid>.<ext>`. Oprindeligt filnavn gemmes i `legacy_path`. Legacy brugte billedet som opskriftens hovedbillede; hvis det reelt er et scannet kort, kan typen ændres senere. |
| — | `source_type = legacy_import`, `source_name = "Mors Opskrifter"` | Oprindelse vises på opskriften. |
| `Ingredients` | `recipe_ingredients` | Rækkefølge = Id. `Amount` parses (2½, 1/2, 1-2, 2,5); `Unit` genkendes (g, dl, tsk, spsk, stk …). **Original tekst gemmes altid** i `original_text`. Ikke-numeriske mængder ("en smule", "efter smag") bevares som del af navnet. `Unit` uden navn ("1 æg") tolkes som ingrediensnavn. Helt tomme linjer springes over (logges). |
| `RecipeSteps` | `recipe_steps` | Sorteres på SortOrder, derefter Id; nummereres 0..n. Tomme trin springes over (logges). |
| `AspNetUsers` + roller | `legacy_import.users` + `household_members` | Matcher Supabase-bruger på e-mail. Administrator→admin, User→member (aldrig ejer). Uden match: e-mail-bundet invitation (30 dage) når `--invite` bruges. Brugere uden e-mail listes til manuel invitation. |
| `UserFavorites` | `legacy_import.favorites` → `favorites` | Alle bevares. Anvendes, så snart brugeren er matchet (også ved senere genkørsel). |
| Identity-hashes, claims, tokens | — | Kan ikke overføres (forskellige hash-algoritmer) og er ikke brugerdata. |

Ukendte kolonner eller tabeller i den rigtige fil stopper ikke importen, men rapporteres som advarsler, så intet forsvinder i stilhed.

## Idempotens og sporbarhed

- `legacy_import.id_map` (husstand, entitet, legacy-id → nyt id) + `recipes.legacy_id` (unik pr. husstand).
- Allerede importerede opskrifter springes over — ændringer lavet i Vores Kok overskrives aldrig.
- Hver kørsel logges i `legacy_import.runs` med SHA-256 af kildefilen og rapporten.
- `legacy_import`-skemaet er ikke eksponeret i Data API'et og har ingen rettigheder for `anon`/`authenticated`.

## Verifikation

`verify` sammenligner kilde og database: antal opskrifter, alle legacy-id'er, ingredienser og trin **pr. opskrift**, ingredienser i alt, billeder (række + fil i Storage), kategorier og kategori pr. opskrift, favoritter, brugere, samt en felt-for-felt-sammenligning (titel, noter, portioner, forfatter, alle ingrediens-originaltekster, alle trin) af tre repræsentative opskrifter (første, sidste, flest ingredienser).
