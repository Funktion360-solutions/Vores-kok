# AI (plan for fase 3)

Principper fra specifikationen, som arkitekturen allerede er forberedt til:

- **Deterministisk først.** Portionsomregning, enhedsomregning, søgning, filtrering og (i fase 2) indkøbsaggregering er ren kode i `packages/domain`. AI bruges ikke til matematik.
- **Import**: Schema.org/JSON-LD udtrækkes deterministisk (som i legacy `TryExtractJsonLdRecipe`); AI er fallback. Resultatet bliver altid en *RecipeDraft*, som brugeren godkender — aldrig en færdig opskrift direkte.
- **Server-side**: Alle AI-kald sker i Supabase Edge Functions med nøgler som secrets. Klienter kalder funktionen med deres JWT; funktionen tjekker husstandsmedlemskab.
- **Udskiftelig udbyder**: Et lille `AiProvider`-interface (`extractRecipe`, `chat`, `embed`) med én implementering pr. udbyder. Domænemodellen kender ikke udbyderen.
- **Validering**: Alt AI-output parses med Zod (`recipeInputSchema`) før det vises.
- **SSRF-beskyttelse** i URL-import: kun http(s), DNS-opslag afviser private/link-local adresser, max 2 MB, 10 s timeout, maks. 3 redirects.
- **“Hvad kan vi lave?”** filtrerer først deterministisk på husstandens egne opskrifter (ingrediens-match mod `recipe_ingredients.name_normalized` / pantry), og bruger kun AI til fortolkning og forslag.
