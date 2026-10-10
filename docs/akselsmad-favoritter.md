# Favoritter og samlinger

På en offentlig AkselsMad-opskrift kan en bruger gemme en favorit og tilføje eller fjerne opskriften fra en privat samling. `/konto/kogebog` viser favoritter og samlinger, og giver mulighed for at oprette, omdøbe og slette samlinger. Sletning af en samling sletter hverken opskrifter eller favoritter. Samme opskrift kan være i flere samlinger.

Tre nye RLS-tabeller: `am_favorites`, `am_collections`, `am_collection_items`. Kun ejeren har adgang; almindelige brugere behøver ikke redaktøradgang. En samling og dens elementer har en fælles ejer, håndhævet af en sammensat fremmednøgle og RLS. Bruger-id kommer fra verificeret login i API'et. Mutationsruten kræver samme origin. Ingen nye service keys eller pakker.

Kun offentlige, synlige opskrifter kan gemmes. En tilbagetrukket opskrift viser en besked uden indhold i den private oversigt. Referencen kan fjernes eller vises igen ved genudgivelse. Kontosletning sletter personlige favoritter og samlinger.

Vores Koks private opskriftsside viser nu fed tekst, kursiv, lister, underoverskrifter og citater i beskrivelse, fremgangsmåde og noter. HTML bliver almindelig tekst, aldrig kørt. Redigering i Vores Kok bruger fortsat de eksisterende tekstfelter; denne etape tilføjer visning, ikke en ny værktøjslinje.

Migrationen er allerede lagt på det fælles Supabase-projekt og er medtaget for versionshistorikken. Kør ikke et samlet `db push` på dette projekt, hvor andre produkter også har migrationer.

Valideret: TypeScript og ESLint i begge webapps; produktionsbuild af AkselsMad; SQL-test med rollback af favorit, samling, gentagne indsættelser, adgang mellem brugere, ejerskifte, sletning og tilbagetrækning. Tekstformatet er testet på tværs af begge hjemmesider. Browsergennemgang med et rigtigt login mangler efter udgivelse.

Opskriftsopdateringer til private kopier, genkendelse af eksisterende kopier og PDF-kvoten følger i næste integrationstrin. Denne etape ændrer ikke private kopier automatisk.
