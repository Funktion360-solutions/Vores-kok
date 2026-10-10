# Indkøb, kvitteringer og tilbud — hjemmeside

## Indhold

- Priser og butik pr. indkøbslinje; sum for åbne varer med kendt pris samt manglende priser. Prisen gælder hele mængden. Ændring af navn, mængde eller enhed gør den gamle pris uaktuel.
- Kvitterings-/tilbudsavisimport fra PDF, JPG, PNG, WebP eller tekst. Maks. 5 MB / 60.000 tegn, højst 100 linjer. AI-import bruger eksisterende husstandskvote og OPENAI_API_KEY/AI_IMPORT_MODEL (ellers AI_MODEL).
- Ret butik, valuta, mængder, enheder, priser, pant, rabatter og tilbudsdatoer. Godkend samlet. Ukendt aflæsning markeres; pant/rabat tæller aldrig som mad.
- Valgfri tilføjelse af godkendte kvitteringsvarer til eksisterende opbevaringssteder i Mit køkken. Hele godkendelsen gemmes i én transaktion. Sessionslager bevarer samme godkendelse ved mistet svar; genforsøg er idempotent.
- Købshistorik med linjepriser, søgning og kvitteringstotal. Seneste 200 dokumenter vises. Det er betalte linjepriser, ikke standardiserede kilopriser.
- Importerede tilbud med datogyldighed og medlemskrav. Udløbne tilbud skjules dagligt; ukendt gyldighed mærkes. Aktive tilbud kan tilføjes som én tilbudspakke til en eksisterende liste.
- Prej-API: Netto, Føtex, Bilka og REMA 1000 som prisudvalg; Coop (365discount, Brugsen, Kvickly, SuperBrugsen) som avislinks. Priser fra Coop kan importeres manuelt.

## Aktivering

Databaseændringen `20261010205102_shopping_receipts_offers.sql` og Edge Functions `shopping-import` og `offers-sync` er allerede lagt på projekt `tgqwyheqhquwncyloond` den 10. oktober 2026. Hjemmesidefilerne installeres med Python-pakken og udgives gennem projektets normale Git/Vercel-flow.

Tilføj `PREJ_API_KEY` som Supabase Edge Function-secret for live-tilbud. Opret nøgle på https://prej.dk/api. Nøglen må ikke ligge i NEXT_PUBLIC-variabler. Eksisterende `AI_ALLOWED_ORIGINS` skal indeholde hjemmesidens præcise origin. Der skal ikke køres en samlet `supabase db push`: projektet deles med andre systemer og har anden migrationshistorik.

Prej Gratis har aktuelt 25 kald/dag og er kun til ikke-kommerciel brug. Den private indkøbsfunktion skal vurderes særskilt fra den planlagte offentlige hjemmeside med annoncer. Kommerciel API-brug kræver en plan/aftale, der tillader det. Kilder: https://prej.dk/api/dokumentation og https://prej.dk/vilkaar-api.

## Cache og dækning

En fælles servercache afgrænses af onsdage i Europe/Copenhagen. Det første besøg efter en ny onsdag henter data; der er ikke oprettet et selvstændigt onsdagsjob. Fire kæder, højst to sider á 100 tilbud hver, samt ét avis-kald: højst 9 udbyderkald pr. uge, uafhængigt af antal brugere. Samtidige besøgende kan ikke starte flere hentninger. Cachefejl nulstilles kun administrativt eller i næste uge, så fejl ikke spiser kvoten. Kildernes dato, afbrudte svar og forkortede kataloger vises. Nye tilbud midt i ugen bliver synlige ved næste ugentlige hentning eller manuel import.

Området er 9000 Aalborg + 45 km. Prejs kædedata har ikke dokumenteret lokal butiksdækning; siden oplyser derfor, at lokale priser og lager skal bekræftes. Radiusfilter og direkte Salling-butik/madspildsintegration er ikke aktive i denne pakke. Salling Groups gratis API er ikke i sig selv en fuld erstatning for alle kæders almindelige tilbud.

Prissammenligning viser kun andre tilbud i det hentede udvalg med samme kædepublicerede stregkode og samme pakningsstørrelse. Matchede/gættede stregkoder og flerstykskøb bruges ikke til denne sammenligning. Der loves ikke billigste samlede indkøbskurv.

## Databeskyttelse og rettigheder

Tabellerne vk_shopping_prices og vk_commerce_documents bruger husstandsbaseret RLS; medlem kræves for skrivning og seer kan læse. Ingen browser bruger service-role-nøgler. Servercachen vk_offer_cache er kun tilgængelig for service role. Udbyderen får ingen indkøbslister eller husstandsidentifikatorer. Dokumentets input sendes til AI med store:false; prompten fravælger kortnumre, medlemsnumre og betalingsreferencer. Kontrollér selv følsomme oplysninger før godkendelse. Originale kvitteringsfiler gemmes ikke.

## Kontroller

Web-typecheck, ESLint, Next production-build, seks nye unit-/handler-tests. Database-test 06_commerce.sql kontrollerer husstandsisolering, seerens rettigheder, servercache, atomisk rollback og dubletsikkert genforsøg i en fuldt tilbagerullet transaktion. Edge Functions er ACTIVE, og unauthenticated requests afvises. Live-Prej-kald og en rigtig AI-kvittering er ikke testet med ejerens nøgler/session.

## Administrativ genhentning efter afbrudt API-hentning

Kun ved behov: slet rækken med id='prej' i vk_offer_cache gennem et privilegeret administrationsværktøj. Næste autoriserede besøg laver en ny hentning på op til 9 kald. Kontrollér dagens resterende Prej-kvote først. Dette ændrer ingen husstandsdata.
