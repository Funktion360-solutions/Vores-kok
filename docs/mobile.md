# Mobil (iPhone + iPad)

Én universel Expo-app (`apps/mobile`, SDK 57, expo-router). `supportsTablet: true`, `requireFullScreen: false` (iPad multitasking), alle orienteringer.

## Skærme

Faner: Hjem · Opskrifter · Familie · Mere. Stack: opskrift, rediger (modal), ny opskrift (modal), invitation (deep link `voreskok://invite/<token>`), login/opret, onboarding.

**iPad**: I landskab viser Opskrifter en split-visning (liste til venstre, opskrift til højre). Opskriftssiden lægger ingredienser og fremgangsmåde side om side, og forsiden viser opskrifter i to kolonner.

## Sessions

Supabase-sessionen gemmes i iOS Keychain via `expo-secure-store` (opdelt i bidder pga. størrelsesgrænse). Token-fornyelse kører kun, mens appen er i forgrunden.

## Offline og synkronisering

`src/lib/recipe-cache.ts` — bevidst design, ikke tilfældig framework-caching:

| Emne | Adfærd |
|---|---|
| Hvad caches | Alle husstandens opskrifter som `get_recipe`-dokumenter (ingredienser, trin, tags, historier, medier, noter, favorit-status), kategorier og personer, husstandslisten og aktiv husstand |
| Hvor | AsyncStorage, nøgle pr. husstand (`vk:v1:recipes:<id>`). Billeder: expo-image disk-cache med `cacheKey = storage_path`, så de vises offline selv når den signerede URL er udløbet |
| Hvornår | Ved app-start, når husstanden skiftes, når forbindelsen kommer tilbage, når appen kommer i forgrunden, og ved "træk for at opdatere" |
| Hvordan | Inkrementelt: `get_recipes_since(sidste sync − 5 min)` i sider á 200, derefter id-listen for at fjerne slettede opskrifter |
| Læsning | Lister og søgning læser **altid** fra cachen (`filterRecipeDocuments` i `@vores-kok/database`), så appen opfører sig ens online og offline |
| Favoritter offline | Anvendes lokalt med det samme og lægges i en persisteret outbox, som afspilles i rækkefølge, når der er net. Idempotent (`set_favorite(id, bool)`) → sidste handling vinder |
| Redigering | Kræver forbindelse i fase 1. Formularen gemmer løbende en lokal kladde, så intet går tabt ved netfejl eller hvis appen lukkes |
| Konflikter | `save_recipe` tjekker `version`. Er opskriften ændret af en anden, afvises gemningen (VK409); kladden bevares, og brugeren kan hente den nye version |
| Log ud | Sletter alle `vk:`-nøgler (opskrifter, kladder, signerede URL'er) fra enheden |

Tests: `apps/mobile/test/recipe-cache.test.ts` (sync, genstart offline, sletninger, outbox-afspilning, paginering) og `pnpm e2e:mobile` (web-build: login, søgning, skalering, favorit, genstart uden backend, iPad-split).

## Build og distribution

```bash
cd apps/mobile
cp .env.example .env            # public URL + publishable key
pnpm start                      # Expo Go / dev client
npx eas build -p ios            # kræver Apple Developer-konto (EAS)
```

Bundle-id: `dk.voreskok.app` (kan ændres i `app.config.ts` før første App Store-build). Kamera- og fotobiblioteks-tilladelser har danske forklaringer.
