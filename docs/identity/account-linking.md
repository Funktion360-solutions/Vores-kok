# Manuel kontokobling – lokal test

Forudsætning: custom:funktion360-id er aktiveret i Vores Koks Supabase-projekt. Provideren bruger Identity-projektets særskilte OAuth-app, hvis redirect er Vores Koks Supabase callback. Token exchange er client_secret_post. Behold PKCE og nonce-kontrol. Tilføj http://localhost:3001/auth/funktion360/link/callback til Vores Koks tilladte redirects.

Aktivér Manual Linking i Vores Koks Authentication-konfiguration. Kontroller optionens placering i dashboardet. Uden den returnerer linkIdentity en fejl, og ingen kobling startes.

Åbn /auth/funktion360/link. Log ind på den eksisterende lokale konto, og bekræft adgangskoden. Serveren henter bruger-ID og e-mail fra getUser, verificerer password mod samme konto og starter Supabases linkIdentity. Der indsendes intet bruger-ID i formularen. Callback kræver engangsproof med fem minutters levetid, PKCE code exchange og efterfølgende getUser. Bruger-ID skal matche det tidligere lokale ID, og custom-provider-identiteten skal være registreret. Ved mismatch lukkes den lokale session.

Supabase opbevarer den autoritative kobling i auth.identities. Ingen egen email-baseret mapping eller udskiftning af auth.users.id. RLS, Storage og forretningsdata forbliver lokalt autoriseret. Kontokoblingen foretages af Supabase før appcallback; appens kontrol bekræfter resultatet, men en afbrudt appcallback kan betyde, at en kobling allerede er gennemført. Ved tvivl kontrolleres Authentication → Users → identities.

Kun lokal udvikling: multi-instance sessions, audit-overblik, MFA step-up, passwordless kontokobling og rollback/unlink skal færdiggøres før produktion. Konti med verificeret MFA kan ikke bruge dette password-only flow. Eksisterende passwordlogin bevares. Almindeligt signInWithOAuth tilbydes endnu ikke, da Supabases automatisk email-kobling skal afklares i rolloutpolitikken.

Test med egen testkonto først: noter lokal UUID før/efter; kontrollér opskrifter og husstande; afvis ID-login; forkert adgangskode; udløbet proof; callback fra anden browser; gentaget callback. Auth har egne audit logs. Bekræft en anden lokal bruger ikke kan få adgang til dine data.
