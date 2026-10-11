# Temaforløb og digitale kogebøger

## Redaktion

Åbn `/admin/udgivelser` fra administrationen. Opret et temaforløb eller en kogebog. Der er tomme skabeloner til en italiensk gæstemiddag, pasta fra bunden og salater med karakter. Skabelonerne er ikke udgivet og indeholder ingen opfundne opskrifter.

Skriv titel, adresse, tema og introduktion. Tilføj og flyt trin eller kapitler. Hvert kapitel kan indeholde en formateret introduktion samt opskrifter, guides og blogindlæg. Der kan være højst 30 kapitler, 20 elementer pr. kapitel og 100 elementer samlet. Et kapitel skal have tekst eller offentligt indhold før udgivelse.

Gem kladden, åbn forhåndsvisningen, markér godkendelsen og vælg Udgiv godkendt kladde. Godkendelsen bruger kun den gemte version. Nyere kladdeændringer ændrer ikke den offentlige udgave. Samtidige ændringer opdages med revisionskontrol. Skjul udgivelse bevarer kladden.

## Offentlig læsning

`/forloeb` og `/kogeboeger` har søgning, temafilter og indholdsfortegnelse. Bøger læses på hjemmesiden. Ingen samlet PDF-download eller købsflow i denne etape; den eksisterende fem-opskrifters downloadgrænse ændres ikke. Nyhedsbrevet kan bruges til at følge nyheder om kommende trykte bøger; dette er ikke en særskilt interesseregistrering eller forudbestilling.

En redaktionel udgave fryser kapitlernes tekster og rækkefølge. Tilknyttede opskrifter og artikler åbnes i deres aktuelle offentlige version. Hvis de senere skjules, viser læseren en neutral besked og ingen privat titel eller adresse. Fremtidige artikler kan ikke vælges eller godkendes, før de er offentlige.

## Læserens fremgang

Loggede brugere kan markere hvert forløbstrin som gennemført og fjerne markeringen igen. Fremgangen findes under `/konto/forloeb`, gemmes på deres egen konto og kan hentes på en anden enhed. Stabile kapitel-ID'er bevarer markeringerne, når kapitler flyttes eller omdøbes. Et helt nyt kapitel-ID betragtes som et nyt trin. Fjernede kapitlers markeringer tælles ikke. Forløb, hvor alle markeringer er fjernet, forsvinder fra Mine temaforløb.

## Vores Kok

Kun allerede godkendte offentlige `am_recipes` kan indgå. Brug den eksisterende import fra Vores Kok i opskriftsredaktionen, gennemgå og udgiv opskriften, og vælg den derefter i udgivelsen. Private familiehistorier og familiens billeder hentes ikke af forløbs- eller bogfunktionen. Der tilføjes ingen AkselsMad-links til Vores Koks hjemmeside.

## Drift og sikkerhed

Migration `20261011211544_akselsmad_editions.sql` er allerede anvendt på det fælles Supabase-projekt tgqwyheqhquwncyloond. Der er ingen nye miljøvariabler. Installationsfilen inkluderer migrationen for at holde repository og databasehistorik ens. Brug ikke en samlet db push til at reparere historiske forskelle i projektet.

Alle tre tabeller har RLS og eksplicitte grants. Redaktionelle skrivninger kræver redaktørrolle og ejerskab; fremgang kan kun læses og skrives af kontoejeren. Der bruges brugerens Supabase-session, ingen service-role-nøgle. API'er kræver samme Origin og har størrelsesgrænser. Offentligheden kan kun læse synlige godkendte udgaver. Forhåndsvisning kræver redaktørens ejerskab og gemmer ikke fremgang.

## Verifikation

`node --test tests/editions.test.mjs` fra apps/akselsmad kontrollerer validering, rækkefølge, API-adgang, revisionskonflikter, ejeridentitet, læserens HTML, utilgængelige referencer og privat forhåndsvisning. `supabase/tests/akselsmad_editions.sql` kontrollerer de virkelige RLS-regler, godkendelse, snapshots, konfliktkontrol og fremgang med midlertidige testbrugere i en transaktion, der rulles tilbage. Typecheck, lint og production build køres på hele AkselsMad-appen.
