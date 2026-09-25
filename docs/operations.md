# Drift: backup, gendannelse og overvågning

## Backup

| Data | Mekanisme |
|---|---|
| Database | Supabase laver daglige backups (7 dage på Pro). Slå **Point-in-Time Recovery** til for familiens data (Project Settings → Add-ons), når I har flyttet alt over. |
| Ekstra logisk backup | Ugentligt `pg_dump` af `public` + `legacy_import` til et sted uden for Supabase: `pg_dump "$DATABASE_URL" -n public -n legacy_import -Fc -f voreskok-$(date +%F).dump` |
| Billeder (Storage) | Storage er **ikke** med i database-backups. Synkronisér bucket `household-media` jævnligt, fx med `supabase storage` CLI eller S3-kompatibel adgang (`rclone sync`). |
| Legacy | Behold `morsopskrifter.db` + `App_files` og den gamle Docker-installation som arkiv, indtil migreringen er verificeret og I har brugt Vores Kok i en periode. |

## Gendannelse

1. Database: gendan fra Supabase-backup/PITR i Dashboard, eller `pg_restore --no-owner -d "$DATABASE_URL" voreskok-<dato>.dump` på et nyt projekt efter `supabase db push`.
2. Storage: kopiér filerne tilbage til `household-media` med samme stier (stierne er refereret fra `recipe_media.storage_path`).
3. Kør `pnpm --filter @vores-kok/migration verify` hvis legacy-data skal kontrolleres igen.
4. Mobil-klienter synkroniserer automatisk; ved total gendannelse kan brugere logge ud/ind for at tømme cachen.

## Overvågning

- Supabase Dashboard → Advisors (security + performance) efter hver skemaændring.
- Supabase Logs (API, Auth, Postgres) ved fejlsøgning. Web-appen logger ikke personlige data og viser aldrig tekniske fejl til brugeren.
- Fase 3 tilføjer fejlrapportering (fx Sentry) til web og mobil.

## Planlagt oprydning (fase 2/3)

- Forældreløse filer i Storage (upload lykkedes, men metadata-insert fejlede): planlagt job der sammenligner `storage.objects` med `recipe_media`.
- Udløbne invitationer kan slettes efter 90 dage.
