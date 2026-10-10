# Vores Kok AI v1

## Implementeret

Web `/assistant` og Expo `/assistant` (iPhone/iPad) åbnes fra Mere. Assistenten
besvarer madlavningsspørgsmål og finder relevante familieopskrifter. Brugerfladerne
anvender samme `askAssistant`-klient og Zod-kontrakter. Ingen AI-kald foretages
fra klienterne direkte til udbyderen. AI kræver internet; fejl bevarer spørgsmålet.
Ny samtale rydder skærmens historik. Husstandsskift genstarter samtalen.

## Arkitektur og sikkerhed

`Supabase functions.invoke` → `ai-assistant` → verificeret Auth-bruger → faktisk
husstandsmedlemskab → atomisk forbrugsreservation → opskriftslæsning med brugerens
JWT/RLS og eksplicit household-filter → udskifteligt `AiProvider` → valideret svar.
Ingen service-role bruges. Funktionen og klienterne validerer med Zod. Input har
64 KB bytegrænse, spørgsmål 2.000 tegn, historik højst 8 beskeder. Udbyderkald har
30 sekunders timeout og højst 1.600 outputtokens. Brugerens oplyste systemroller
og ekstra inputfelter afvises. Svar vises som tekst, aldrig HTML.

`private.ai_usage` gemmer én række pr. bruger (dag, tæller, sidste kald), ingen
spørgsmål eller svar. RPC `reserve_ai_request` kræver `auth.uid()` og medlemskab;
privilegier er begrænset til authenticated. SECURITY DEFINER er nødvendig for at
opdatere den private tæller, har tom search_path og kan kun reservere for den
aktuelle bruger. UPSERT serialiserer samtidige reservationer: højst 50 om dagen
(UTC), mindst 5 sekunder mellem kald. Kvoten gælder på tværs af husstande og
enheder. Fejlede udbyderkald tæller med. Klienter kan reservere egen kvote men kan
ikke øge grænser eller nulstille tælleren. Sæt også udbyderens projektbudget.

Søgningen rangerer deterministisk titel/ingredienser blandt højst 200 senest
opdaterede, ikke-arkiverede opskrifter og sender højst 6 som reference. Links er
servervalgte ID'er, ikke modelopfundne. De er referenceopskrifter, ikke nødvendigvis
citeret i svaret. Store kogebøger kræver senere databasebaseret retrieval. Ingen
pantry-match eller portionsberegning foretages af denne version; deterministisk
portionslogik forbliver i domain. Beskrivelse, ingredienser og trin kan sendes til
udbyderen; profil, familiehistorie, source_text og medier udelades. En bruger kan
selv skrive private oplysninger i spørgsmålet. Samtaler gemmes kun i skærmens
hukommelse, historik genfremsendes i begrænset omfang. Serverlogs er generiske.
Promptinstruktioner mindsker manipulation, men modelsvar er ikke autoritative.

## Opsætning

1. Anvend migrationen `20261010160340_ai_usage.sql` med normal migrationsproces.
   Migrationen tilføjer kun tæller/RPC; eksisterende opskrifter ændres ikke.
2. Konfigurér Supabase Edge Function secrets (aldrig NEXT_PUBLIC/EXPO_PUBLIC):
   - `OPENAI_API_KEY`: projektets nøgle.
   - `AI_MODEL`: eksplicit valgt Chat Completions-kompatibel model. Ingen skjult default.
   - `OPENAI_BASE_URL`: default `https://eu.api.openai.com/v1`; alternativt
     `https://api.openai.com/v1`. Kun disse endpoints accepteres. EU-endpointet
     kræver passende OpenAI-projektopsætning; et endpoint alene garanterer ikke
     dataresidens eller særlig retention.
   - `AI_ALLOWED_ORIGINS`: kommaseparerede weborigins uden trailing slash, fx
     `https://voreskok.funktion360.dk,http://localhost:3000`. Native kald uden
     Origin accepteres, men kræver stadig verificeret JWT og medlemskab.
3. Regenerér Supabase TypeScript-typer efter migrationen (`pnpm db:types`).
   RPC-signaturen er tilføjet i denne PR. Deploy `supabase functions deploy ai-assistant`.
   Bevar `verify_jwt = true`.
4. Prøv owner/member/viewer fra to husstande, afvist outsider og rigtige AI-svar.
   Alle husstandsroller må stille spørgsmål; ingen AI-dataskrivning er tilladt.
5. Kør Supabase advisors, og kontrollér deployed logs og faktisk JWT-konfiguration.

Deaktivering: fjern AI_MODEL eller OPENAI_API_KEY for at stoppe providerkald.
UI viser opsætningsfejl. Migrationen kan blive liggende uden at påvirke kogebogen.

## Importfundament og senere arbejde

Udbyderen er isoleret bag `AiProvider`, og outputvalidering er fælles. Eksisterende
`recipeInputSchema` er kontrakten for et senere importudkast. V1 implementerer
ikke URL/OCR/PDF-import eller udkastgodkendelse. Udvid med separat extraction-
operation, draftkontrakt, proveniens og review før lagring. URL-import skal først
bruge Schema.org/JSON-LD, have SSRF/DNS/redirect-beskyttelse og begrænset download.
Billeder/medier må kun læses under husholdningens Storage-politikker. AI må aldrig
oprette opskrifter eller ændre madplan uden brugerens godkendelse.

## Verifikation

- Web/mobile TypeScript, lint, web production build og Expo iOS export.
- Shared validation/database/domain Vitest suites.
- Deno check og handler-tests med stubbet Auth/PostgREST/provider: manglende JWT,
  afvist Origin, ugyldigt input/systemrolle, medlemskab, kvote, household-filter,
  referenceopskrifter og anonymiserede providerfejl.
- SQL-test `supabase/tests/05_ai.sql` indgår i normal `pnpm db:test`.
- Migrationen og kvotescenarier verificeret isoleret i PostgreSQL via PGlite.

Lokale checks bruger placeholder public config og ingen rigtige AI-nøgler.
Deno-verifikation brugte de allerede installerede, versionsfastlåste npm-pakker,
fordi Deno-registry-resolveren ikke kunne hente dem her. Produktionsdeploy,
Supabase advisors, fuld lokal Supabase SQL-suite, native Xcode-build og test på
iPhone/iPad er ikke gennemført i denne Linux-session. En iOS export er ikke en
signeret native build. Rigtige AI-svar og husstandsisolering skal også verificeres
på staging efter secrets/deploy, før funktionen betegnes som driftsklar.
