# AkselsMad: nyhedsbreve

Denne etape tilføjer `/nyhedsbrev`, en modtageroversigt og `/admin/nyhedsbrev` med kladder, formatering, forhåndsvisning, test og udtrykkelig godkendelse af udsendelse. Vores Kok og DEJ får ingen nye sider eller nyhedsbrevsnavigation.

## Opsætning

1. Opret et **nyt segment kun til AkselsMad** i Resend under Audience/Segments. Kopiér segmentets UUID. Brug ikke en eksisterende liste med alle Funktion360-kunder. Ingen læsere importeres automatisk.
2. Opret en servernøgle i Resend med adgang til Contacts, Segments, Broadcasts og afsendelse. En nøgle, der kun må sende transaktionsmails, er utilstrækkelig til administration af modtagere.
3. Tilføj følgende i **AkselsMads Vercel-projekt**. Funktion360-administrationens miljøvariabler deles ikke automatisk med AkselsMad.

| Variabel | Værdi |
| --- | --- |
| `RESEND_API_KEY` | Din hemmelige Resend-nøgle |
| `AKSELSMAD_NEWSLETTER_SEGMENT_ID` | UUID for det nye AkselsMad-segment |
| `AKSELSMAD_NEWSLETTER_FROM` | Fx `AkselsMad <nyhedsbrev@funktion360.dk>`; domænet skal være verificeret til afsendelse i Resend |
| `AKSELSMAD_NEWSLETTER_REPLY_TO` | Valgfri. Standard: `aksel@funktion360.dk` |
| `NEXT_PUBLIC_SITE_URL` | Den faktiske offentlige HTTPS-adresse til AkselsMad; bruges i alle mailens links |

4. Redeploy AkselsMad. De tre Resend-variabler er serverhemmeligheder og må aldrig få `NEXT_PUBLIC_` foran navnet. Ingen ekstra pakker eller webhooks er nødvendige.
5. Den afgrænsede SQL-migration i denne opdatering er allerede lagt på det fælles projekt, `tgqwyheqhquwncyloond`. Installer migrationens fil i Git, men kør ikke et generelt `db push` mod den fælles database.

## Første brev

- Åbn `/nyhedsbrev` med en bekræftet Funktion360-konto, markér samtykket og tilmeld din egen adresse. Login alene tilmelder ingen.
- Åbn `/admin/nyhedsbrev`. Modtagerlisten hentes fra det dedikerede segment. Den viser 100 adresser ad gangen; næste side kan hentes. Afmeldte adresser vises tydeligt og udelukkes af Resend.
- Opret en kladde. Skriv emne, forhåndstekst og overskrift. Indledning og afslutning har fed, kursiv, lister, citater og underoverskrifter. Vælg op til seks offentlige opskrifter, guides eller blogindlæg.
- Gem og forhåndsvis brevet. Send en test til din egen bekræftede redaktørmail. Testadressen kan ikke ændres til en kunde. Der kan højst sendes én test pr. brev pr. minut.
- Vælg **Gør klar til udsendelse**. Det fryser mailens indhold og opretter en **kladde** i Resend; det sender ikke til listen.
- Kontrollér testen og det færdige brev. Markér den særskilte godkendelse og vælg **Godkend og send nyhedsbrevet**. Status “Accepteret til udsendelse” betyder, at Resend har accepteret brevet. Det er ikke en kvittering for levering. Følg leveringsresultater i Resend.

Den beige og himmelblå mailskabelon bruger tabelstruktur og inline styles samt en ren tekstversion. Mailprogrammer kan vise skrifttyper og afrundinger forskelligt. Opskriftskort har stabile links; tidsbegrænsede billedlinks og private familiedata bruges ikke.

## Hvis forbindelsen bliver afbrudt

Der sker ingen automatisk genafsendelse ved et ukendt resultat.

- **Kontrollér Resend-kladde:** Genindlæs siden først. Find brevet i Resend ved navnet `AkselsMad:<lokalt brev-ID>`. Kopiér Resends Broadcast-ID til feltet i AkselsMad. Forbindelsen accepteres kun, hvis navn, segment, afsender, emne, forhåndstekst og begge mailversioner matcher det frosne brev. Opret ikke en ekstra kopi for at prøve igen.
- **Afsendelse skal kontrolleres:** Brug **Opdatér status fra Resend** og kontrollér det eksisterende brev i Resend. Hvis Resend stadig viser en kladde, afslut afsendelsen af netop dette brev i Resend. AkselsMad tilbyder ingen automatisk gentagelse af en usikker afsendelse.
- En klargjort mail kan ikke redigeres. Et nyt, anderledes brev skal oprettes som en ny kladde og godkendes særskilt.

## Samtykke og afmelding

En serverkontrolleret, bekræftet loginmail bruges til tilmelding. Der er intet offentligt felt til tilmelding af andres adresser. Samtykkets ordlyd og tidspunkt lagres på kontoen; udbyderens aktuelle status er afgørende for udsendelse. Databaseadgang følger ejerens RLS-rettigheder. Administration kræver eksisterende `am_publishers`-adgang. Ingen service-role-nøgle bruges.

Afmelding på hjemmesiden fjerner kun adressen fra AkselsMad-segmentet. Resends indbyggede afmeldingslink kan stoppe marketing fra hele samme Resend-konto. En eksisterende global afmelding overskrives aldrig automatisk. Tilmelding på ny i det tilfælde kræver, at læseren kontakter Aksel. Nødvendige supportmails bruger det eksisterende transaktionsflow.

Kontoens samtykkehistorik slettes ved kontosletning. Resend-kontakten skal også fjernes efter en anmodning om sletning; denne etape tilføjer ikke en ny samlet kontosletningsfunktion. Privatlivssiden beskriver dette.

## Kontrol

```sh
pnpm --filter @funktion360/akselsmad typecheck
pnpm --filter @funktion360/akselsmad lint
pnpm --filter @funktion360/akselsmad test:newsletter
pnpm --filter @funktion360/akselsmad build
```

`tests/newsletter.test.mjs` bruger mock af Resend og databasegrænser. Ingen rigtige mails sendes under disse tests. SQL-kontrollen i `supabase/tests/akselsmad_newsletter.sql` anvender syntetiske brugere i en transaktion, der rulles tilbage. Den verificerer samtykke, ejeradgang, versionskonflikter, frysning og afsendelseslås.

Officielle referencer: [Resend Broadcasts](https://resend.com/docs/api-reference/broadcasts/create-broadcast), [Resend Segments](https://resend.com/docs/api-reference/segments/list-segment-contacts), [Supabase RLS](https://supabase.com/docs/guides/database/postgres/row-level-security).

## Redaktion: skabeloner, genbrug og rækkefølge

Administrationen indeholder fire udgangspunkter: **Nyt fra køkkenet**, **En bid af Italien**, **Tid til at bage** og **Lær noget nyt**. De er tekstforslag, som du tilpasser til dit konkrete brev. De vælger ingen opskrifter automatisk og sender intet.

Under Dine breve kan du søge efter emne eller overskrift, vælge status og sortere efter ændringstid eller emne. Oversigten viser antal kladder, breve klar til godkendelse, udsendelser der skal følges op og udsendte breve. Antallene kommer fra de breve, din redaktørkonto har adgang til.

**Genbrug som ny kladde** er tilgængeligt for kladder og færdigt udsendte breve. Der kopieres kun indhold. Resend-ID, afsender-snapshot, testhistorik, revision og udsendelsesstatus følger ikke med. Den nye kladde gemmes først, når du trykker Gem kladde. Et indslag, der ikke længere er offentligt, udelades med en besked. Breve under klargøring eller afsendelse kan ikke kopieres, før deres status er afklaret.

Valgte opskrifter og artikler vises i en særskilt, nummereret liste i editoren. Flyt dem op eller ned, eller fjern dem. Den samme rækkefølge bruges i forhåndsvisning og den færdige mail. Typefilteret kan afgrænse valget til opskrifter, guides eller blogindlæg. Højst seks indslag kan medtages.

Denne opdatering kræver ingen nye miljøvariabler, pakker eller databasemigrationer.
