# Opskriftsimport v1 (web)

Web `/import`, tilgængelig under Mere, understøtter tekst/TXT, URL, PDF,
JPG/PNG/WebP, screenshots og kamerafotos. HEIC/HEIF forsøges konverteret i
browseren; hvis det ikke lykkes, skal brugeren konvertere til JPG.

Kilden giver op til 10 separate redigerbare udkast. Brugeren godkender hvert
udkast via eksisterende RecipeEditor/saveRecipe/RLS. AI udtrækker indhold og
usikkerhed; forbedrer ikke opskriften. Udkast gemmes kun i skærmens hukommelse.
For PDF/billeder vedhæftes originalen efter gemning med eksisterende private
household-media-politikker. Billeder gemmes som læsbare kopier uden EXIF/GPS;
PDF er uændret. Tekst/URL og transskription bevares i source_text og source_url.
Original-uploadfejl vises og kan genprøves uden at oprette opskriften igen.

## Opsætning

Deploy `recipe-import` med `verify_jwt = true`. Brug eksisterende secrets:
OPENAI_API_KEY, AI_MODEL, OPENAI_BASE_URL, AI_ALLOWED_ORIGINS.
Valgfri AI_IMPORT_MODEL erstatter AI_MODEL for import. Modellen skal understøtte
vision, PDF-input og strikte JSON-skemaer (den aktuelle gpt-4.1-mini-opsætning
skal testes live). Ingen nye migrationsfiler eller offentlige buckets.

## Grænser og sikkerhed

5 MB pr. fil, 60.000 tegn pr. tekst, op til 10 opskrifter. Større PDF'er skal
deles. Kildens instruktioner betragtes som ubetroet data. Filtyper kontrolleres
med MIME og signatur. JWT verificeres via Auth; kun owner/admin/member må
importere. Atomisk reserve_ai_request giver samme 50/dag og 5 sekunder som chat.
URL-hentning og evt. AI-fallback tæller hver som en reservation; UI venter 5,1
sekunder mellem dem. URL-parser anvender JSON-LD deterministisk hvis komplet.
Fallback fjerner scripts/navigation og sender tekst til AI. Kun HTTPS port443,
ingen IP-literals/credentials, valideret og pinned offentlig IPv4, højst tre
redirects, maks. 2 MB HTML og 12 sekunder pr. hop. IPv6-only-sider afvises.
Ingen robots-, cookie- eller loginomgåelse; beskyttede sider kan indsættes som tekst.

## Verifikation og begrænsninger

Web/Edge-typekontrol, lint, production build, tests af husholdningsfilter,
roller, kvoter, struktureret udtræk, private IP'er og kildebevaring.
Live OpenAI-filinput, Storage-upload og browserflow skal testes efter deployment.
En model kan overse en opskrift eller håndskrift; gennemgå altid mod originalen.
Ingen DOCX/XLSX-import, batches af flere filer eller Expo-importskærm i v1.
