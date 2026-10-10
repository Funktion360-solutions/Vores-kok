# AkselsMad og familiens kogebog

Når en opskrift gemmes fra AkselsMad, registrerer `am_kitchen_links` originalens id og udgave sammen med den private kopis familie, version og indholdsfingeraftryk. Gentagne gemninger i samme familie genbruger den nyeste aktive kopi. En arkiveret kopi blokerer ikke en ny import. To samtidige RPC-kald serialiseres med en transaktionslås for original og familie.

Den private opskriftsside i Vores Kok viser, når en nyere offentlig udgave er udgivet. Et familiemedlem med redigeringsadgang skal godkende opdateringen. Er kopien uændret, kan den opdateres på stedet eller gemmes som en ekstra opskrift. Er indhold, ingredienser, trin, billeder eller familiehistorier ændret, kræves en ekstra kopi. Ingen egen tilpasning overskrives af opdateringsflowet. Personlige noter og medier skrives ikke af synkroniseringen.

Fingeraftrykket dækker også direkte ændringer i ingredienser og trin, som ikke nødvendigvis ændrer opskriftens versionsnummer. Godkendelsen kontrollerer både den viste offentlige udgave og den aktuelle private version. En forældet side giver konflikt. Gentagen godkendelse af en allerede hentet udgave genbruger den eksisterende kopi.

En tilbagetrukket original giver en besked uden offentlig titel eller adresse; den private opskrift bevares. Familiens læsere kan se status, men kan ikke godkende opdateringer. Private forbindelser udleveres aldrig til anonyme besøgende eller andre familier.

Registreringen gælder importer fra denne opdatering og frem. Ældre kopier har ikke et original-id og får ingen automatisk forbindelse. Der foretages ingen usikker matchning ud fra titel.

`AKSELSMAD_PUBLIC_URL` kan sættes på Vores Koks webprojekt, hvis AkselsMad bruger en anden adresse end standarden `https://akselsmad.dk`. Ingen nye API-nøgler eller pakker kræves. Funktionen tilføjer kun oplysninger på private opskriftssider, ikke på Vores Koks offentlige hjemmeside.

Migrationen er allerede anvendt på det fælles Supabase-projekt. Kør ikke et samlet `db push` for denne opdatering. Migrationen leveres med korrekt remote-version til Git-historikken.

Verifikation: SQL-tests med fuld rollback for gentagne importer, udgivelse uden automatisk overførsel, godkendelse, versionkonflikt, direkte ingrediensændringer, bevaring af privat kopi, genbrug af nyere udgave, fremmed familie, læserrolle og tilbagetrækning. TypeScript og ESLint i begge hjemmesider samt produktionsbuild af AkselsMad. Gennemgang med rigtigt login efter udgivelse mangler.
