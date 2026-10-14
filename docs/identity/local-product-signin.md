# Produktlogin med Funktion360 ID – én lokal pilotkonto

Provideren custom:funktion360-id skal være konfigureret, og den lokale konto skal være manuelt koblet. Tilføj http://localhost:3001/auth/funktion360/signin/callback til Vores Koks Supabase Auth redirect allow-list. Dette er en appcallback, ikke OAuth-appens Supabase callback; den eksisterende https://tgqwyheqhquwncyloond.supabase.co/auth/v1/callback i Identity-projektet bevares.

F360_SSO_PILOT_LOCAL_USER_ID skal være din eksisterende Vores Kok-UUID. Python-installationen indsætter den UUID, der blev bekræftet i denne pilot, i apps/web/.env.local. Produktion er lukket. Udvid ikke pilotkontoen uden en gennemgået migrationspolitik.

ID-login starter Supabases signInWithOAuth og returnerer en lokal Supabase-session gennem PKCE. Engangsproof binder browseren til en fem-minutters logintransaktion. Callback bruger getUser, kræver samme lokale bruger-ID og den tilknyttede custom-provider-identitet og sender først derefter videre til opskrifter. RLS og brugerreferencer ændres ikke.

Supabase kan automatisk oprette eller linke OAuth-identiteter efter verificeret email, før appcallbacken kører. Pilotkonto-filteret er en kontrol af adgang til denne lokale test, ikke en global deaktivering af Supabases auto-linking. Brug kun den allerede manuelt koblede testkonto. Inden en bred udrulning skal politik for nye konti og automatisk linking godkendes, testes og håndhæves hos identitetsudbyder/Auth.

Test: log lokalt ud af Vores Kok; behold ID-appens session; vælg Log ind med Funktion360 ID på /login; godkend om nødvendigt; kontrollér samme lokale UUID, opskrifter og familie. Gentag med central session udlogget, afvisning, udløbet proof og replay. Intet globalt logout tilbydes i denne pakke.
