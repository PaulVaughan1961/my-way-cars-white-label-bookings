# Security Audit Evidence

This folder contains non-passenger evidence collected from the live My Way Cars Supabase project during read-only security inspection.

## 28 August 2026 checkpoint

Expected evidence files:

- `security-policies-2026-08-28.csv` — active Row Level Security policy definitions
- `database-schema-2026-08-28.csv` — public table columns, types, nullability and defaults
- `database-constraints-indexes-2026-08-28.csv` — primary keys, uniqueness rules, checks and indexes
- `database-row-counts-2026-08-28.csv` — exact row counts before security migration

The inspection also confirmed that the public schema has no custom functions or triggers.

## Handling rules

- This folder may contain database structure, policy definitions and record counts.
- Do not place passenger names, telephone numbers, addresses, booking notes, credentials, tokens, secrets or raw table exports in this Git repository.
- Store sensitive database backups separately in an encrypted and access-controlled location.
- Before a migration, record new pre-migration row counts and create a recoverable backup.
- After a migration, compare row counts and test business separation before production use resumes.

## Current blocker

The Supabase project was on the Free plan at this checkpoint and had no scheduled backups. No database migration is authorised until a secure backup method has been established and tested.
