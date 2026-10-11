# Guides og blog: læseoplevelse

Denne opdatering gør artikler på `/guides/[slug]` og `/blog/[slug]` mere overskuelige på computer og iPad.

- Brødkrummer og tydelig angivelse af kategori og anslået læsetid.
- Indholdsfortegnelse fra underoverskrifter i tekstblokkene. Brug editorens **Underoverskrift** eller skriv `## Din overskrift`. Overskrifter vises som H2 under artiklens H1.
- På større skærme ligger indholdsfortegnelsen ved siden af teksten. På mindre skærme ligger den over teksten og kan lukkes. Links virker uden JavaScript. Gentagne overskrifter har hver deres anker.
- Roligere typografi, mere plads mellem afsnit og fremhævede citater.
- Deling via enhedens delingsmenu, med kopiering af link som alternativ. Kun offentlige artikler har delingsværktøjer. Links bruger den eksisterende `NEXT_PUBLIC_SITE_URL` og indeholder ikke adminadresser eller sessionsparametre.
- Udskriftsvisning med artikeltekst, billeder og forfatteroplysninger. Navigation, indholdsfortegnelse, delingsknapper og anbefalinger skjules. Browserens udskriftsdialog kan også gemme artiklen som PDF; dette er ikke opskriftssidernes begrænsede PDF-downloadfunktion.
- Op til tre andre udgivne artikler i samme kategori. Den aktuelle artikel, private kladder, skjulte og fremtidige udgivelser udelukkes. Hvis der ingen relevante artikler er, vises afsnittet ikke.
- Forfatterboks, tilbage til toppen og link til nyhedsbrevet.

Kladdens forhåndsvisning bruger samme læselayout og indholdsfortegnelse. Den viser hverken delingsknap, nyhedsbrevsboks eller anbefalinger. Forhåndsvisningsmarkeringen beholdes ved udskrivning.

## Installation og kontrol

Ingen nye pakker, miljøvariabler eller databasemigrationer. Den eksisterende siteadresse skal fortsat være korrekt. Kør installationsfilen i Vores-kok, commit og push, og åbn en guide eller et blogindlæg efter deployment.

```sh
pnpm --filter @funktion360/akselsmad typecheck
pnpm --filter @funktion360/akselsmad lint
pnpm --filter @funktion360/akselsmad test:articles
pnpm --filter @funktion360/akselsmad build
```

Kontrollen renderer det faktiske artikelindhold og sikrer, at alle indholdsfortegnelsens links har tilsvarende unikke overskrifter, at HTML-lignende tekst er sikker, og at private forhåndsvisninger ikke får delingslinks. Supabase-læsning sker med den eksisterende publishable-klient og RLS, uden service-role-nøgle.

Efter deployment: skriv to underoverskrifter i en artikel, forhåndsvis den og kontrollér begge links. Afprøv deling og udskrivning på den offentlige udgivelse. Browserens skrifttyper og udskriftsindstillinger kan påvirke det præcise udseende.
