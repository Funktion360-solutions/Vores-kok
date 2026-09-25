# Sikkerhed: RLS, storage og husstandsrettigheder

## Principper

1. RLS er slået til på **alle** tabeller i `public` (og i `legacy_import`). `anon` har ingen rettigheder i `public` (tabeller, sekvenser og funktioner er revoked, også som default privileges).
2. Ingen policy nøjes med `TO authenticated`. Undtagelse: `units` (referencedata uden husstandsdata) — dokumenteret i migreringen.
3. Medlemskab tjekkes af `private.has_household_role(household_id, min_role)` — SECURITY DEFINER med `search_path = ''`, kun ja/nej for den kaldende bruger (`auth.uid()`), i et skema der ikke er eksponeret.
4. UPDATE-policies har både `USING` og `WITH CHECK`. Triggere forhindrer, at `household_id` eller `user_id` ændres på eksisterende rækker.
5. `created_by` stemples af en trigger ud fra `auth.uid()`; klienter kan ikke forfalske forfatter.
6. Versionshistorik (`recipe_versions`) er append-only: ingen klient-INSERT/UPDATE/DELETE; skrives kun af `private.snapshot_recipe` efter eget rolle-tjek.

## Husstandsroller

| Handling | Læser | Medlem | Admin | Ejer |
|---|:-:|:-:|:-:|:-:|
| Se opskrifter, personer, historier, billeder, fælles noter | ✓ | ✓ | ✓ | ✓ |
| Favoritter og private noter | ✓ | ✓ | ✓ | ✓ |
| Oprette/redigere/arkivere opskrifter, ingredienser, trin, historier, billeder, personer, kategorier | | ✓ | ✓ | ✓ |
| Dele noter med husstanden | | ✓ | ✓ | ✓ |
| Slette opskrifter, personer, kategorier, tags; slette andres noter | | | ✓ | ✓ |
| Omdøbe husstand, se/lave/tilbagekalde invitationer (medlem/læser) | | | ✓ | ✓ |
| Ændre roller og fjerne medlemmer/læsere | | | ✓ | ✓ |
| Invitere/ændre/fjerne admins og ejere, slette husstand | | | | ✓ |

Regler håndhævet i RPC'erne: en husstand har altid mindst én ejer; admins kan ikke give roller over deres egen; invitationer kan ikke give ejer-rollen.

UI'et skjuler handlinger ud fra `packages/domain/src/permissions.ts`, men databasen er autoriteten.

## SECURITY DEFINER — fuld liste og begrundelse

| Funktion | Hvorfor |
|---|---|
| `private.has_household_role`, `private.shares_household_with` | Policies skal kunne læse medlemskab uden at udløse RLS på `household_members` (rekursion) |
| `private.handle_new_user` (trigger på `auth.users`) | Kører som `supabase_auth_admin`, der ikke har rettigheder på `public.profiles` |
| `public.create_household` | Første ejer-medlemskab kan ikke indsættes via nogen klient-policy |
| `public.create_household_invite`, `revoke_household_invite` | Token genereres og hashes server-side; invitationer har ingen klient-INSERT |
| `public.accept_household_invite` | Den inviterede er endnu ikke medlem; validering sker på SHA-256 af token (+ e-mail hvis bundet) |
| `public.set_household_member_role`, `remove_household_member` | Rolle-regler (sidste ejer, admin-grænser) kræver tjek på tværs af rækker |
| `private.snapshot_recipe` | Append-only historik uden klient-INSERT-policy |
| `private.refresh_recipe_search` (+ triggere) | Opdaterer kun den afledte `search_vector` for rækker kalderen lige har fået lov at skrive |

Alle har `set search_path = ''`, eksplicitte rolle-tjek og `revoke ... from public, anon`. Supabase-rådgiveren markerer de 5 offentlige som "authenticated kan kalde SECURITY DEFINER" — det er tilsigtet.

## Storage

- Én privat bucket: `household-media` (25 MB, MIME-whitelist: jpeg, png, webp, heic, heif, pdf).
- Sti: `<husstand>/(recipes|people)/<uuid>/<uuid>.<ext>` — valideret med regex i INSERT/UPDATE-policies (ingen `..`, ingen vilkårlige navne).
- Læs: læser+ i husstanden fra første sti-segment. Skriv/slet: medlem+.
- `recipe_media.storage_path` har CHECK-constraint på husstands-præfiks og MIME-whitelist.
- Filer vises via signerede URL'er (1 time på web, 24 timer på mobil med disk-cache).
- EXIF/GPS fjernes ved klient-genkodning; migreringen fjerner APP1/APP13/COM (JPEG) og tekst/eXIf-chunks (PNG).
- Forældreløse filer (fx upload OK men DB-insert fejler) ryddes op af klienten; en planlagt oprydning er beskrevet i [operations.md](../operations.md).

## Test

`pnpm db:test` kører alle migreringer på en frisk Postgres og SQL-testene i `supabase/tests/` (husstande/invitationer/roller, opskrifts-RLS inkl. IDOR-forsøg, søgning, storage-policies). Den samme type test er kørt direkte mod produktionsprojektet i en transaktion, der blev rullet tilbage.

## Web

- CSP med nonce pr. request (`src/proxy.ts`), `frame-ancestors 'none'`, `X-Content-Type-Options`, `Referrer-Policy`, HSTS, `Permissions-Policy`.
- Redirect-parametre valideres (`safeNext`) mod open redirects.
- Auth-cookies håndteres af `@supabase/ssr`; `getUser()` (verificeret mod Auth) bruges på serveren, ikke `getSession()`.
- Service role-nøglen bruges **aldrig** i web eller mobil — kun i migreringsscriptet på din egen maskine.

## Anbefalede indstillinger i Supabase Dashboard

- Auth → Policies: minimum kodeordslængde 10, lækkede kodeord blokeres (HaveIBeenPwned).
- Auth → URL configuration: Site URL = web-adressen; Redirect URLs: `https://<web>/auth/callback`, `voreskok://**`.
- Auth → Rate limits: standard er fornuftige; slå CAPTCHA til, hvis tilmelding misbruges.
