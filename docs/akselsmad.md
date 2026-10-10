# AkselsMad — første byggeetape

AkselsMad er en separat Next.js-webapp i `apps/akselsmad`. Vores Koks offentlige hjemmeside får ingen AkselsMad-links. Kun en godkendt redaktør får et link på den private opskriftsside.

## Med i denne version

- Forside i beige, sand og himmelblå; opskriftsoversigt og Om Aksel.
- Søgning i titel, introduktion, ingredienser og tags samt filtre for kategori, tid og sværhedsgrad.
- Ingrediensafkrydsning, portionsberegning og trinvis tilberedning.
- Redaktion med kladder, forhåndsvisning, særskilt godkendelse, udgivelse og tilbagetrækning.
- Felter til udstyr, råd, typiske fejl, opbevaring, frysning, variationer og detaljerede bagenoter/tidsplaner.
- Egne forsidebilleder, op til 10 MB (JPG, PNG, WebP). Billeder til kladder ligger i en privat bucket.
- Vores Kok → AkselsMad: vælg en privat opskrift og opret en uafhængig offentlig kladde. Familiehistorier, private noter, oprindelse, kildefiler og billeder kopieres ikke automatisk.
- AkselsMad → Vores Kok: en bruger med mindst medlemsadgang kan gemme en udgivet opskrift i sin familie. Teksten kopieres; det offentlige billede kopieres ikke til familiens billedarkiv.

Importerede opskrifter overskrives ikke ved genimport. Hvis opskriften allerede har en kladde, åbnes den eksisterende kladde. Den private original ændres aldrig af udgivelse. Senere ændringer i den private original synkroniseres heller ikke automatisk.

Ingen virkelige opskrifter er udgivet automatisk. Forsiden viser en tydeligt mærket illustration og en tom oversigt, indtil Aksel vælger indhold og egne billeder.

## Installer på din Mac

Kør fra roden af `Vores-kok`:

```bash
python3 ~/Downloads/installer-akselsmad.py --stage --configure-local
pnpm install
pnpm --filter @funktion360/akselsmad dev
```

Åbn `http://localhost:3001`. Administration: `http://localhost:3001/admin`.

`--configure-local` kopierer kun Supabase-projektets offentlige URL og offentlige klientnøgle fra `apps/web/.env.local` eller `apps/web/.env` til den nye webapps ignorerede `.env.local`. Den kopierer ingen servernøgler og ændrer ikke eksisterende AkselsMad-miljøfiler. Den tilføjer kun et lokalt redaktørlink til Vores Kok, hvis `AKSELSMAD_ADMIN_URL` ikke allerede er sat.

Hvis de offentlige værdier ikke findes lokalt, opret `apps/akselsmad/.env.local` ud fra `.env.example`. Brug samme Supabase-projekt og publishable-nøgle som Vores Kok. En eksisterende anon-klientnøgle understøttes også. Ingen service-role-nøgle er nødvendig.

Installerens `--check` kontrollerer alle filer uden at skrive. Ændrede eksisterende AkselsMad-filer overskrives ikke. `--stage` tilføjer kun pakkens filer til Git og fortæller, hvis andre filer allerede var staged.

## Database

Databasen er allerede oprettet i Supabase-projektet `tgqwyheqhquwncyloond` og integrationen er testet der. Migrationerne er inkluderet med samme versionsnumre som den eksterne migrationshistorik. Kør ikke `db push` for denne installation: projektet indeholder også andre produkter og har en større migrationshistorik end dette repository.

Din eksisterende konto, der ejer Familien A SLOT, er tildelt redaktøradgang. Andre konti får ikke adgang ved blot at logge ind. Redaktørlisten har ingen klientpolitik til indsættelse/opdatering.

Alle nye tabeller har RLS. API-funktionerne kører med brugerens rettigheder (`SECURITY INVOKER`). Den offentlige tabel indeholder alene et valideret opskriftsdokument, adresse og udgivelsesoplysninger; ingen kilde-id'er, husstands-id'er eller ejer-id'er. Kladdens revision kontrolleres ved gemning og udgivelse.

## Login

Denne etape bruger samme Supabase-brugeridentitet som Vores Kok og DEJ. Brug samme e-mail og adgangskode eller e-mailkode. Mailkoden kan indtastes i sin fulde længde.

Dette er fælles konto, ikke færdig central Funktion360-SSO. Domænerne har hver deres sessionscookie og kræver særskilt login. En konto, som kun findes i et andet Supabase-projekt, forbindes ikke automatisk. Central SSO kræver en separat etape; tokens deles ikke via URL eller brede domænecookies.

## Udgiv på Vercel

Opret et **nyt Vercel-projekt** fra det eksisterende GitHub-repository. Behold Vores Koks nuværende projekt og Root Directory.

- Framework: Next.js.
- Root Directory: `apps/akselsmad`.
- Install Command: `pnpm install --frozen-lockfile`.
- Build Command: `pnpm build` (køres fra Root Directory).
- Miljø: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, `NEXT_PUBLIC_SITE_URL`, `NEXT_PUBLIC_VORES_KOK_URL` og `AKSELSMAD_ADMIN_HOST` fra `.env.example`.
- Tilføj de domæner, du ejer: `akselsmad.dk`, eventuelt `www.akselsmad.dk`, og `adminakselsmad.voreskok.funktion360.dk` til samme nye Vercel-projekt.
- Admin-domænets forside sender til `/admin`. Adgangen kontrolleres i både webapp og database. Administrationen fungerer også på det offentlige domænes `/admin`.
- På **Vores Koks** eksisterende Vercel-projekt tilføjes `AKSELSMAD_ADMIN_URL=https://adminakselsmad.voreskok.funktion360.dk`. Det aktiverer redaktørlinket på den private opskriftsside. Indtil admin-domænet virker, kan den nye Vercel-projektadresse bruges.

Hvis domænet ikke er købt/forbundet endnu, brug Vercel-projektets adresse som `NEXT_PUBLIC_SITE_URL`. Domæner og deployment er ikke oprettet af installationspakken.

## Første udgivelse

1. Log ind med din eksisterende Vores Kok-konto på AkselsMad.
2. Åbn Administration og vælg en opskrift fra Vores Kok, eller brug redaktørlinket på opskriften i Vores Kok.
3. Opret kladden. Gennemgå især introduktion, ingredienser, trin og rettigheder til teksten.
4. Vælg kategori og en læsbar opskriftsadresse. Udfyld de ekstra forklaringer og upload dit eget billede.
5. Gem kladden og åbn den gemte forhåndsvisning.
6. Godkend teksten og billedet og tryk Udgiv.
7. Åbn den offentlige opskrift uden login. Test derefter Gem i Vores Kok med en familie, du har medlemsadgang til.

## Verifikation

- AkselsMads TypeScript, ESLint og Next.js-produktionsbuild består.
- Vores Koks TypeScript består med den nye integration.
- Tre modeltests dækker danske adresser, samlet tid og kombinerede søgefiltre.
- SQL-integrationstest dækker sikker import, gentagen import, ingen privat metadata, redaktøradgang, fremmede familier, obligatorisk godkendelse, revisionskonflikter, offentlig version adskilt fra kladde, kopi tilbage til Vores Kok, offentlig billedadgang og tilbagetrækning. Testdata rulles tilbage.
- Supabase security advisors har ingen nye AkselsMad-fund. Andre produkters eksisterende advisor-fund er ikke ændret.
- Visuel browserkontrol og login med en virkelig bruger er endnu ikke udført. Produktionsdeployment/domæner mangler fortsat.

## Efter første etape

Fem forskellige PDF-downloads samlet pr. bruger, gratis genhentning, favoritter/samlinger, modererede kommentarer/billeder, nyhedsbrev, annoncer uden for opskriftstrinnene, donationer, trykte kogebøger, yderligere allergenfiltre, central Funktion360-SSO og den dybe DEJ-integration er næste etaper. De vises ikke som aktive funktioner i denne version.
