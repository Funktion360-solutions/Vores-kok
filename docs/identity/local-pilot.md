# Vores Kok – lokal Funktion360 ID-pilot

Kun udvikling med Node.js 24. De nye ruter er /auth/funktion360/start, callback og status. Produktionsmiljøet afviser start/callback. Lokalt SQLite-lager er atomisk og holder loginforsøg i fem minutter og identitetsbevis i 15 minutter. Det er ikke egnet til Vercel eller flere instanser. ID-tokenets signatur, issuer, audience, nonce og PKCE valideres med openid-client. Den centrale identitet kan endnu ikke bruges som lokal Supabase-session.

## Miljø

Behold Vores Koks eksisterende Supabase-oplysninger. Tilføj disse felter i apps/web/.env.local:

```dotenv
F360_SSO_PILOT=true
F360_ID_ISSUER=https://fthalqavjmsydmqszvkk.supabase.co/auth/v1
F360_ID_CLIENT_ID=c12fe98d-6fba-4eda-bef7-22c4e9bb5fea
F360_ID_CLIENT_SECRET=INDSÆT_KLIENTHEMMELIGHED_LOKALT
```

Klientens registrerede callback: http://localhost:3001/auth/funktion360/callback. Kontrollér issuer mod Identity-projektets OIDC discovery.

Kør Identity-appen på localhost:3000 og Vores Kok med `pnpm --filter @vores-kok/web dev:sso`. Åbn http://localhost:3001/auth/funktion360/status og vælg testlogin.

Cookies er host-only men porte isolerer ikke cookies: pilotcookies har egne navne og path. Identitetsbeviset giver ikke adgang til Vores Koks data. Lokal Supabase-session forbliver autoritativ. Ingen brugere oprettes, migreres eller sammenkobles i Vores Kok.

Test: godkendelse → verificeret identitet, afvisning → fejlstatus, gentaget callback → afvisning, callback i anden browser → afvisning. Callback bygger sin URL fra fast konfiguration, ikke Host/forwarded headers. Tokens gemmes ikke. Lokale pilotdata kan slettes ved at stoppe appen og slette .funktion360-sso-pilot.

Senere: delt SDK som versioneret release fra Funktion360-ID, kontokobling med bevis på begge konti, godkendt Supabase-sessionfederation, persistent sessionlager til hosting og rollback. Denne pakke aktiverer ikke automatisk SSO i det normale produktlogin.
