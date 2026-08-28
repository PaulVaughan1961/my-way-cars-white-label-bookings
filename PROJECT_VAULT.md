# My Way Cars Software Project Vault

**Status date:** 28 August 2026  
**Project owner:** Paul Vaughan  
**Current phase:** Security foundation  
**Release status:** No outside operator access until the Security Release Gate is passed

This is the project's authoritative status and decision record. Update it at the end of every development session, then commit and push the project to GitHub. New ideas must be recorded under **Later modules** and must not interrupt the current security phase.

## 1. Product direction

The original product remains the priority:

> A simple, affordable booking diary for independent rural taxi drivers and operators that keeps bookings organised and helps prevent missed or conflicting jobs.

Version 1 is deliberately small. Operators should be able to begin with an inexpensive booking diary and enable paid modules only when their business needs them.

## 2. Frozen Version 1 scope

### Operator-facing features

- Secure operator login
- Add a booking
- Edit a booking
- Cancel or restore a booking
- Upcoming bookings list
- Calendar view
- Search bookings
- Booking-clash warnings
- Simple backup/export

### Essential booking information

- Customer name
- Telephone number
- Pickup date and time
- Pickup address
- Destination
- Fare
- Notes
- Optional return journey

### Infrastructure required for V1

These are not extra selling features. They are mandatory foundations:

- Each business can access only its own data.
- Each booking belongs to one business.
- Supabase Row Level Security enforces that separation.
- Backup and recovery are tested.
- The production build and security checks pass.

## 3. Existing work that must be preserved

The following features already exist. Their code must not be deleted. They will be disabled for Basic V1 accounts and offered later as optional paid modules:

- Driver dashboard and dispatch
- Driver job acceptance and rejection
- Customer self-service booking requests
- Customer text messaging
- Accounts, invoices and receipts
- Customer and driver directories
- Multi-booking invoicing
- Driver status controls

My Way Cars may retain access to existing modules while a new Basic operator sees only the V1 booking diary.

Hiding navigation buttons is not sufficient. Every protected page, server operation and database action must verify the business and its feature entitlement.

## 4. Later modules — do not develop during the security phase

- Customer booking-request module
- Driver dispatch module
- Messaging module
- Accounts and invoicing module
- Additional-driver subscriptions
- Unassigned-job holding area
- Driver job claiming
- Driver points and priority
- Anonymous driver-to-driver transfer requests
- Advanced reminders and automation
- Business branding and advanced white-labelling
- Customer multi-operator request network
- Route matching and optimisation
- Automated subscription billing

Requests from real operators and drivers will determine the order in which these modules are refined and released.

## 5. Current security decision

Security is the number-one priority. No new feature development and no outside operator rollout will take place until the Security Release Gate is passed.

The present application was originally built for My Way Cars. The supplied security policies identify authorised operators but do not separate data belonging to different businesses. Creating a second operator under the current model could expose My Way Cars records to that operator.

## 6. Security Release Gate

Every item below must be completed and tested before inviting the first outside operator.

### A. Recovery and change control

- [ ] Tag and preserve the last known working live version.
- [ ] Confirm that the live database has a current recoverable backup.
- [ ] Test database restoration in a safe environment.
- [ ] Prepare every database change as a reviewed migration.
- [ ] Never test an unreviewed migration directly on the live database.

### B. Business separation

- [ ] Create a `businesses` table.
- [ ] Create business membership records linking authenticated users to a business and role.
- [ ] Add `business_id` to bookings and every business-owned table.
- [ ] Assign all existing records safely to My Way Cars.
- [ ] Make `business_id` mandatory after migration validation.
- [ ] Add appropriate indexes and foreign-key constraints.

### C. Database access protection

- [ ] Replace global operator policies with business-scoped Row Level Security policies.
- [ ] Prove Operator A cannot read, insert, update or delete Operator B data.
- [ ] Prove My Way Cars data remains accessible only to authorised My Way Cars members.
- [ ] Restrict driver reads to the driver's own record and assigned jobs.
- [ ] Prevent drivers from changing customer details, addresses, fares, ownership or driver allocation.
- [ ] Allow driver actions only through narrowly controlled operations.
- [ ] Verify the intended policies are actually active in the live Supabase project.

### D. Paid-module protection

- [ ] Store enabled modules against each business subscription or entitlement record.
- [ ] Basic V1 accounts receive only booking diary and calendar access.
- [ ] Hide disabled navigation and controls.
- [ ] Block disabled pages when their address is entered manually.
- [ ] Block disabled server and database operations even if someone bypasses the interface.
- [ ] Keep existing My Way Cars modules enabled during the transition.

### E. Public and account security

- [ ] Move public booking-request submission behind a validated server endpoint before that module is offered.
- [ ] Add request rate limiting and spam protection.
- [ ] Validate and limit all public input on the server.
- [ ] Complete driver account invitation, linking and password-recovery procedures before dispatch is sold.
- [ ] Ensure secrets remain in deployment environment variables and never in browser code or Git.

### F. Dependency and application checks

- [ ] Upgrade Next.js from the audited vulnerable version to a patched supported version.
- [ ] Review or replace the old PWA dependency chain.
- [ ] Clear application lint errors.
- [ ] Add automated tests for tenant separation and driver restrictions.
- [ ] Run TypeScript, lint and production-build checks successfully.
- [ ] Add basic error monitoring and a security-event record.

### G. Data protection and commercial basics

- [ ] Move My Way Cars branding, contact and payment information out of shared source code.
- [ ] Add a configurable business profile.
- [ ] Provide operator data export.
- [ ] Define privacy, retention and deletion procedures.
- [ ] Document incident response and account-access recovery.

## 7. Core reliability work after the security foundation

These are V1 stabilisation tasks, not new features:

- [ ] Correct manual return-journey linking.
- [ ] Save outward and return legs atomically so a partial booking cannot be created.
- [ ] Make the edit flow use one consistent return-journey model.
- [ ] Confirm date, time-zone and daylight-saving behaviour.
- [ ] Verify calendar counts, exclusions and day navigation.
- [ ] Add reliable booking reminders appropriate to the V1 promise.
- [ ] Verify backup/export and recovery.
- [ ] Replace empty PWA icons and default Create Next App metadata.

## 8. Audit checkpoint — 28 August 2026

### Verified strengths

- The project is a substantial working application already used by My Way Cars.
- Booking entry, dashboard, calendar, customer records, accounts, dispatch, customer requests and document generation are present.
- TypeScript completed without errors.
- A production build completed successfully when safe test environment values were supplied.
- No deployment secrets were found in the uploaded project snapshot.

### Material findings

- Current operator policies grant authorised operators access to all business rows; there is no tenant separation.
- Current driver update policy is too broad and can permit changes beyond approved driver actions.
- Public booking requests insert directly from the browser without rate limiting or spam protection.
- Manual return bookings use inconsistent linking and edit structures and can be partially saved.
- “On My Way” records the status when the text composer opens, not when sending is confirmed.
- Some invoice numbers are generated at display time rather than stored permanently.
- Business branding and payment information are hard-coded.
- The project has no complete reproducible base database schema or migration history.
- The application lint check reported 17 application errors and 5 warnings.
- The dependency audit reported 13 production advisories, including high-severity Next.js issues relevant to access protection.
- There are no automated tests.
- The supplied PWA icon files are empty and the application metadata is still the framework default.

### Audit limitation

The source snapshot shows the intended database policies but cannot prove which policies and settings are currently active in the live Supabase project. Live verification is required before release.

## 9. Approved security work order

Work must proceed in this order:

1. Preserve and identify the current live version and database backup.
2. Document the current live database schema and active policies.
3. Design the business, membership and feature-entitlement model.
4. Prepare a reversible migration without applying it live.
5. Test the migration using My Way Cars plus a separate test business.
6. Replace operator and driver policies with least-privilege policies.
7. Test cross-business access, direct URL access and direct database requests.
8. Upgrade vulnerable dependencies and repeat all tests.
9. Apply the reviewed migration to production with a rollback plan.
10. Pass every Security Release Gate item before outside rollout.

Estimated duration: **4–7 focused working days**, normally **1–2 weeks at the project's working pace**.

Use **High** reasoning for the security architecture, migrations and testing. Return to Light only after the security foundation is complete and work has been divided into small routine changes.

## 10. Session close and backup procedure

Every development session must end with the following checklist:

- [ ] Record the date and purpose of the session below.
- [ ] Record files and database objects changed.
- [ ] Record tests performed and their results.
- [ ] Record any live deployment or database action.
- [ ] Record the exact next task.
- [ ] Update the Security Release Gate checkboxes only when evidence exists.
- [ ] Run the appropriate TypeScript, lint and build checks.
- [ ] Commit with a clear message.
- [ ] Push the commit to GitHub.
- [ ] Confirm the remote commit identifier.
- [ ] Confirm whether a database backup or migration snapshot was created.

Do not store passwords, API keys, tokens, customer data or unredacted database exports in this file or in GitHub.

## 11. Session history

### 28 August 2026 — Scope freeze and security audit

**Decisions**

- Froze V1 as booking entry, upcoming list, calendar, search, clash warnings and backup/export.
- Preserved all existing advanced work for later optional paid modules.
- Made security the only development priority.
- Prohibited outside rollout until the Security Release Gate is passed.

**Work performed**

- Inventoried and reviewed the complete uploaded project snapshot.
- Reviewed core booking, calendar, customer request, dispatch, invoice and authentication code.
- Reviewed the supplied Supabase security policies.
- Ran installation, TypeScript, lint, dependency and production-build checks.
- Made no application or live database changes.

**Tests and results**

- Dependency installation: passed.
- TypeScript: passed.
- Production build with safe test configuration: passed.
- Application lint: failed with 17 errors and 5 warnings.
- Dependency audit: 13 production advisories, including 12 high severity and 1 low severity.

**Live actions**

- None.

**Next exact task**

> Preserve the current live application/database checkpoint, then document the actual live Supabase schema and active Row Level Security policies. Do not modify the live database yet.

### 28 August 2026 — Live database security inventory

**Decisions**

- Kept the session strictly read-only; no database objects, policies or records were changed.
- Confirmed that no database migration will be attempted until a recoverable data backup exists.
- Kept High reasoning mode active for the security phase.

**Live findings**

- The Supabase project is on the Free plan and has no scheduled database backups.
- Eight public tables are present: accounts, bookings, clash_reviews, customers, drivers, licensing_authorities, operator_users and vehicles.
- All eight public tables have Row Level Security enabled.
- Twelve active policies were recorded.
- The live policies match the supplied source security file.
- The current policies separate operators from drivers but do not separate one operator business from another.
- The driver update policy applies to an assigned booking as a whole and is broader than the permitted driver actions required for commercial use.
- The public pending-request insert policy is active for anonymous users.
- The live public schema contains 82 columns.
- The database contains 29 recorded constraints and indexes.
- No custom functions or triggers exist in the public schema.
- `pickup_datetime` and the legacy `return_datetime` are stored as timestamps without a time zone.
- Both the legacy return fields and the newer `return_group_id` model exist in the live bookings table.

**Evidence stored in `security-audit/`**

- `security-policies-2026-08-28.csv`
- `database-schema-2026-08-28.csv`
- `database-constraints-indexes-2026-08-28.csv`
- `database-row-counts-2026-08-28.csv`

These evidence files contain structure, policy definitions and counts only. They do not contain passenger records.

**Tests and results**

- Active-policy query: passed; 12 rows returned.
- Schema-column query: passed; 82 rows returned.
- Constraint and index query: passed; 29 rows returned.
- Function and trigger query: passed; 0 rows returned.
- Exact table-count query: passed; results exported for pre/post-migration comparison.

**Live actions**

- Read-only SQL queries only.
- No schema, policy, configuration or data changes.

**Unresolved release blocker**

> The live database does not currently have a managed or independently tested recoverable backup.

**Next exact task**

> Establish and test a secure database backup method. Then design the business, membership and feature-entitlement model on paper and in migration files without applying it to production.

### 28 August 2026 — Independent database backup created

**Decisions**

- Kept the live production database unchanged.
- Stored the sensitive backup outside the Git repository.
- Created two identical copies: one local copy and one private OneDrive copy.
- Did not store or record the database password in the project, terminal history or audit evidence.

**Backup details**

- Format: PostgreSQL custom archive.
- Tool: `pg_dump` 18.4 supplied with pgAdmin 4 version 9.17.
- Filename: `my-way-cars-database-2026-08-28.backup`.
- Local location: `Documents\My Way Cars Secure Backups\`.
- Private cloud location: `OneDrive\My Way Cars Secure Backups\`.
- Size: 308,533 bytes.
- SHA-256: `32D42EFFB1C5E946AA23A96F705A4AC13E1B421B1F7BC3DA260D3EE204AEC899`.

**Tests and results**

- Connected successfully to the Supabase session pooler over port 5432.
- Archive created without an error on the successful attempt.
- `pg_restore --list` read the archive successfully.
- Data sections were confirmed for all eight public application tables: accounts, bookings, clash_reviews, customers, drivers, licensing_authorities, operator_users and vehicles.
- The local and OneDrive copies produced the same SHA-256 fingerprint.
- A full restore into an isolated test database has not yet been performed.

**Live actions**

- Read access was used to create the dump.
- No schema, policy, configuration or record was changed.

**Remaining backup release blocker**

> The independent backup exists and has passed archive-integrity checks, but recovery is not yet proven until it has been restored into an isolated test database and the restored row counts have been verified.

**Next exact task**

> Restore this archive into an isolated temporary database, compare the eight public-table row counts with the recorded live counts, and document the result. Do not restore into production.
