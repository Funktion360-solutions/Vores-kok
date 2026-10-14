# Produktlogin – forberedelse til hosting

Produktets signin/start og callback bruger nu konfigureret NEXT_PUBLIC_SITE_URL frem for localhost. Kun HTTPS i produktion. SQLite bruges ikke længere til normalt ID-produktlogin. De gamle proof- og kontokoblingspiloter er stadig udviklingsflows og forbliver lukket i produktion.

Loginforsøgets destination og udløb er HMAC-signeret i en host-only HttpOnly-cookie med fem minutters levetid. Cookie er Secure ved HTTPS og SameSite=Lax. Den indeholder ingen tokens eller adgangskoder. Replaybeskyttelsen er Supabases single-use auth code med PKCE; den signerede cookie er ikke i sig selv et centralt engangslager. Der bruges ingen service-role.

Alle instanser i samme miljø skal have samme F360_SSO_COOKIE_SECRET (64 hextegn/32 tilfældige bytes). Separat nøgle pr. miljø. Rotation gør igangværende loginforsøg ugyldige. Python-scriptet opretter nøglen lokalt uden at udskrive den og bevarer eksisterende nøgler.

Miljøvariabler ved staging:
- F360_SSO_ENABLED=true (må ikke aktiveres på produktion endnu).
- F360_SSO_COOKIE_SECRET=<egen miljønøgle>.
- F360_SSO_ALLOWED_USER_IDS=<manuelt koblede lokale UUID'er, kommaadskilt>.
- NEXT_PUBLIC_SITE_URL=https://<staging-domæne>.
- Eksisterende Vores Kok Supabase URL/publishable key bevares.

Identity-appens Site URL skal være offentligt tilgængelig, og central app skal hostes før ekstern stagingtest. Lokal Site URL på Identity vil sende brugere på deres egen localhost. Registrér eksakte staging callbacks i Vores Koks redirect allowlist. Den særskilte Identity OAuth-apps redirect forbliver Vores Koks Supabase callback. Brug separate klienter pr. miljø, hvor muligt.

Kontroller staging-login, same UUID og ressourceadgang, afvisning, udløb, kode-replay, cookie-tampering og deployment-restart. Supabases native session refresh og RLS skal verificeres efter logout/login. Allowlist-kontrollen begrænser appens ID-logincallback; den er ikke en global Supabase-databaserettighed og ændrer ikke Supabases mulige automatic linking. Ingen bred brugerudrulning eller automatisk kontomigrering er aktiveret.

Rollback: F360_SSO_ENABLED=false skjuler knappen og lukker nye SSO-ruter. Eksisterende produktlogin og lokale data bevares. Allerede udstedte lokale Supabase-sessioner skal revokeres særskilt, hvis det ønskes.
