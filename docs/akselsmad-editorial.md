# AkselsMad: guides, blog og administration

## Brug

Åbn /admin. Dashboardet viser opskriftskladder, offentlige opskrifter, guides/blog og planlagte artikler. Opskrifter og artikler kan søges og filtreres separat. Vælg Guides og blog → Ny guide eller blogindlæg. Redaktøradgang kræver den eksisterende am_publishers-tilladelse.

Blokeditoren bruger den eksisterende sikre tekstformatering: fed, kursiv, overskrifter, lister og citater, med formateret tekstvisning. Tekst indtastes som tekst med formateringsmarkører, ikke som vilkårlig HTML. Tilføj egne JPG/PNG/WebP-billeder (maks. 10 MB) med billedbeskrivelser og billedtekster. Tilføj bokse med allerede offentlige AkselsMad-opskrifter. Flyt eller fjern blokke. Editorens billeder ses i den gemte forhåndsvisning; editoren er ikke et frit Word-lignende layoutværktøj.

Gem kladden før forhåndsvisning eller publicering. En offentlig udgave er en separat kopi; senere kladdeændringer ændrer ikke læsernes udgave. Versionskontrol afviser gem og publicering fra et forældet vindue. Markér godkendelse for at udgive. Tag af hjemmesiden bevarer kladden. Kontrol af adgang gælder også API og database.

Et tomt udgivelsestidspunkt betyder udgiv nu. Et fremtidigt tidspunkt skjuler artiklen og billederne indtil tidspunktet. Der kræves ingen cron: databasepolitikker og offentlige forespørgsler kontrollerer tidspunktet ved hver læsning. Tidspunkt indtastes i computerens lokale tidszone; redaktionslisten viser dansk tid. Planlægning af en ny udgave af en eksisterende artikel erstatter dens snapshot med den planlagte udgave og skjuler dermed den nuværende artikel frem til tidspunktet. Denne begrænsning fremgår ved publicering.

## Offentlige sider

/guides og /blog har kategori- og tekstfiltre. /guides/[slug] og /blog/[slug] viser kun synlige udgaver, hvis udgivelsestidspunktet er nået. Navigation, forsidesektion og sitemap medtager artikler. Forside og artikler viser ingen fiktive udgivelser. Opskriftsbokse viser kun stadig offentlige opskrifter. Guides og blog er alene tilføjet AkselsMad; Vores Koks offentlige hjemmeside er ikke ændret.

## Database og billeder

am_article_drafts har ejer- og redaktørbegrænset RLS. am_articles indeholder kun snapshots beregnet til offentlighed. Alle funktioner er SECURITY INVOKER; ingen service-role eller hemmelig nøgle benyttes. Artikelskemaet afviser ekstra private felter, ukendte bloktyper, for store tekster, manglende billedbeskrivelser og fremmede billeder. am_editorial_photo_public åbner kun filer refereret af synlige og aktuelle snapshots. Bucket akselsmad-editorial er privat. Udstedte billedlinks udløber efter fem minutter og kan stadig fungere i denne periode efter tilbagetrækning. Uploadede filer uden en gemt reference beholdes i denne etape; billedbibliotek og oprydning kommer senere.

Migration 20261011090655_akselsmad_editorial er allerede anvendt på det fælles projekt. Kør IKKE generel db push. Installationsfilen ændrer kun denne etapes filer, bevarer brugerens øvrige CSS og stopper ved konflikter eller andre staged filer. Ingen nye pakker eller miljøvariabler.

## Kontrol

TypeScript, ESLint og AkselsMads produktionsbuild. SQL-testen 11_akselsmad_editorial.sql kører syntetiske fixtures i en transaktion med rollback: godkendelse, versionskonflikter, snapshot-isolation, ejeradgang, læser/anon-afvisning, skjulte planlagte udgaver og deres billeder, publicering og tilbagetrækning. Domænetest dækker tidspunktets præcise grænse, udgivelsesstatus, offentlige adresser og læsetid.

Browserforløbet skal også prøves efter deployment: opret, gem, forhåndsvis, udgiv og læs anonymt. Nyhedsbrev/AI, kommentarer/bedømmelser, statistik over besøgende, fuldt billedbibliotek og DEJ-integration er ikke bygget i denne etape.
