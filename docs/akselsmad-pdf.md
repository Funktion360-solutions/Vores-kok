# AkselsMad PDF-download

En konto kan hente fem forskellige offentlige opskrifter i alt. Samme opskrifts-ID kan hentes igen, inklusive senere udgaver, uden en ekstra plads. Tilbagetrukne eller slettede opskrifter tæller fortsat. Historikken findes på /konto/downloads.

PDF indeholder opskriftens oprindelige portionsantal, ingredienser, trin og detaljerede noter. Den indeholder ikke billeder. A4-layout med indlejrede DejaVu-skrifter, danske tegn og sidetal; skriftlicensen ligger i assets/pdf/LICENSE.txt. Kursiv vises som almindelig tekst. Tegn uden for skrifternes tegnsæt erstattes med et spørgsmålstegn.

POST /api/pdf kræver login og samme origin. PDF genereres før pladsen registreres. En afbrudt download kan efter registrering have brugt en plads; samme opskrift kan altid hentes igen. Filer og API-svar caches ikke. Ingen service-role bruges. Databasetriggeren serialiserer registrering pr. konto og håndhæver kvoten også ved direkte INSERT. RLS begrænser historik til egen konto. Brugere kan ikke slette historik for at nulstille kvoten. Ved kontosletning slettes historikken.

Migration 20261010223311 er allerede anvendt på det fælles projekt. Kør ikke generel db push. SQL-regressionstesten supabase/tests/10_akselsmad_pdf.sql kører i en transaktion og ruller tilbage. Installer nye dependencies med pnpm install. Next outputFileTracingIncludes medtager PDF-skrifterne i serverdeployment.

Valideret: TypeScript, ESLint, produktionsbuild, faktisk PDF-generering og layoutkontrol samt SQL-tests for fem pladser, gentagelser, direkte INSERT, rettigheder, tilbagetrækning og udgaver. Test efter deployment med en logget ind bruger: download, åbn PDF, gen-download og kontrollér historik.
