# Offentlig kontotilknytning for udvalgte konti

Aktivér F360_ACCOUNT_LINKING_ENABLED=true i Vercel Production og tilføj de eksisterende lokale bruger-ID'er til F360_SSO_ALLOWED_USER_IDS. Eksisterende SSO-konfiguration og signeringsnøgle genbruges. Tilføj https://voreskok.funktion360.dk/auth/funktion360/link/callback til Vores Kok Supabase Auth Redirect URLs. Deploy de nye filer.

Brugeren logger ind med sin eksisterende Vores Kok-konto og åbner /auth/funktion360/link. Adgangskode og samtykke kræves. Konti med verificeret MFA kræver en frisk sekscifret TOTP-kode efter adgangskodebekræftelsen. Kun en verificeret faktor fra den aktuelle konto accepteres, og AAL2 kontrolleres før linkIdentity. Andre MFA-metoder blokeres. OAuth-callback kan udstede AAL1-session; almindelig MFA-login/step-up og RLS-krav gælder fortsat. Denne pakke implementerer kun MFA for kontotilknytningen. Ingen databaseændringer og ingen flytning af opskrifter.

Proof bruger særskilt HMAC-formål og HttpOnly Secure SameSite=Lax cookie, udløber efter fem minutter og indeholder lokalt UUID. Callback kontrollerer den oprindelige session før kodeudveksling samt samme UUID og provider bagefter. Supabases engangskode/PKCE håndterer replay; cookien er ikke et engangslager. Manual Linking skal være aktiveret.

Supabase kan have udført tilknytningen før appcallback; en afvist callback ruller ikke automatisk identiteten tilbage. Normal OAuth-signin kan også automatisk tilknytte verificerede emails eller oprette konti. Appens allowlist er ikke en global Auth-politik. Bred offentlig registrering er ikke åbnet i denne pakke.

Kontrollér med en ekstra testkonto: adgangskodefejl, afslået samtykke, succes med samme UUID og samme opskrifter, gentaget callback, ikke-godkendt konto. Rollback: F360_ACCOUNT_LINKING_ENABLED=false og redeploy. Eksisterende tilknytninger bevares.
