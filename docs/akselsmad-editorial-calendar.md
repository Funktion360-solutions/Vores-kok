# Redaktionskalender

Åbn `/admin/kalender` som redaktør. Skift måned, filtrér mellem guides og blog, og åbn indlæg direkte i redigeringen. På mindre skærme erstattes månedsgitteret af listen med præcise tidspunkter. Alle datoer vises i Europe/Copenhagen.

Kalenderdatoen er den godkendte udgivelses dato. Nye kladdeændringer er markeret og ændrer ikke det planlagte indhold. Kladder uden en synlig godkendt udgivelse ligger separat. En fremtidig udgivelse planlægges i den eksisterende editor under Udgivelsestidspunkt og Planlæg udgivelse.

Ingen nye miljøvariabler eller migrationer. Kalenderen læser med redaktørens session, filtrerer kladder på owner_id og henter kun godkendte versioner for egne kladder. Paginering undgår databasens standardgrænse for antal rækker. Kalenderen foretager ingen skrivninger eller udsendelser.

Kontrol: `pnpm --filter @funktion360/akselsmad run test:calendar`, `run typecheck`, `run lint`, `run build`.
