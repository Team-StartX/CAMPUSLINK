# PlacedIn database

The authoritative schema is defined in `schema.ts`. `db.ts` applies migration
`002-relational-entities`, the legacy write guard `003-legacy-write-guard`, and
`004-stable-account-key-and-campus-checks` on startup or through `npm run db:migrate`. PostgreSQL
and the SQLite development fallback use the same relationships and constraints.

## Tables and connections

| Tables                                                                                 | Relationships                                                                                                                                                               |
| -------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `campuses`, `accounts`                                                                 | Accounts reference their campus. Recruiters and accounts awaiting onboarding can have no campus. `accounts.id` is the stable primary key; normalized email is unique.       |
| `organizations`                                                                        | Recruiter account owns its company details.                                                                                                                                 |
| `campus_recruiters`                                                                    | One partnership per campus/recruiter pair.                                                                                                                                  |
| `drives`                                                                               | References campus and recruiter; opportunity identifier is unique.                                                                                                          |
| `recruitment_rounds`, `drive_schedules`                                                | Reference their drive. Round identifiers are unique within a drive; each drive has at most one schedule.                                                                    |
| `workspace_settings`, `student_profiles`                                               | One row per account; retain the existing dashboard contract.                                                                                                                |
| `student_skills`, `student_projects`                                                   | Reference account; skill names are unique within a profile.                                                                                                                 |
| `documents`                                                                            | Reference account; document identifiers are scoped to the student. Private files remain in the storage service.                                                             |
| `applications`                                                                         | Reference student, drive, optional current round and optional resume. One application per student/drive.                                                                    |
| `drive_interests`                                                                      | One interest response per student/drive.                                                                                                                                    |
| `candidate_results`                                                                    | Reference application, student, drive and round. One result per application/round.                                                                                          |
| `assignments`, `assignment_submissions`                                                | Assignment references drive/round; submission references assignment, student application and optional document. One submission per assignment/student.                      |
| `interview_slots`                                                                      | Reference drive, round, recruiter and optional student. Shared round slots have no individual student reference.                                                            |
| `student_interviews`                                                                   | Preserves older student interview entries and optional recruiter ownership. These entries may predate explicit drive/round links.                                           |
| `offers`                                                                               | Reference student, optional application and optional recruiter. Older offers without an application ID remain unlinked; the migration does not guess a relationship.        |
| `questions`, `assessments`, `assessment_questions`                                     | Managed assessment/question definitions with ordered foreign-key connections.                                                                                               |
| `contests`                                                                             | Managed contest definitions.                                                                                                                                                |
| `campus_assessments`, `campus_assessment_sessions`, `campus_assessment_attempts`       | Attempts and sessions reference assessment/student in the same campus; each student can submit once per campus assessment.                                                  |
| `student_activities`, `assessment_sessions`, `assessment_attempts`                     | Practice definitions and historical snapshots scoped to the account, connected to practice sessions/history. Deleted catalog items retain their actual historical snapshot. |
| `interview_templates`, `template_campuses`                                             | Templates reference recruiter and permitted campuses.                                                                                                                       |
| `sessions`, `password_reset_tokens`                                                    | Reference account, with indexed expiry and user identifiers.                                                                                                                |
| `notifications`                                                                        | Reference recipient account, with read/unread state.                                                                                                                        |
| `audit_logs`                                                                           | Optional actor account reference; system actors and historical details remain in the event payload.                                                                         |
| `mail_jobs`, `storage_cleanup_jobs`, `oauth_flows`                                     | Delivery queue, private-file cleanup and OAuth flow storage.                                                                                                                |
| `account_photos`, `interview_practice`, `interview_feedback`, `communication_practice` | Account-scoped flexible data connected through the owner foreign key.                                                                                                       |
| `locks`, `migrations`                                                                  | Transaction coordination and applied migration history.                                                                                                                     |
| `records`                                                                              | Preserved legacy snapshot. The application stops reading or writing it after migration.                                                                                     |

Every entity table has a `record_id`, nullable campus/owner references, and a
JSON-validated `value` column for flexible attributes. Important identifiers,
statuses, scores, dates and other query fields are SQL columns. The persistence
adapter writes these columns together with their payload in a transaction.

Applications, offers, documents, profile skills/projects, assessment history,
interviews, drive rounds and schedules have independent rows. The adapter
reconstructs the existing `WorkspaceData` and `Drive` responses from those rows,
so frontend workflows do not need a new response format. Independently stored
applications and workspace applications now use the same canonical rows.

Aggregate reads use a consistent transaction snapshot. Workspace and drive lists
load their related rows in batches rather than issuing a query per student or
drive. PostgreSQL read snapshots do not acquire the placement write lock.

Composite foreign keys enforce matching student, application, drive and campus
relationships. Resume references cannot point at another student's document.
Checks protect CGPA, nonnegative marks/points, durations, booleans and supported
workflow statuses. Request validation remains responsible for detailed business
rules such as eligibility, assessment windows, maximum round marks and schedule
conflicts. Existing scheduling transactions retain the shared placement lock.

## Migration and operation

1. Stop old backend instances before deploying this storage change. Old versions
   still write `records`; this is a one-way cutover, not a dual-write deployment.
2. Build with `npm run server:build`, then run `npm run db:migrate`, or start the
   updated backend and let startup apply the migration.
3. Migration copies existing records and decomposes workspace/drive aggregates
   inside one transaction. Parent tables are populated before their dependents.
   PostgreSQL instances serialize this operation using the placement lock.
4. Existing SQLite databases receive a consistent backup under
   `server/data/backups/` before their first conversion. Hosted PostgreSQL retains
   the original `records` table; use the provider's backup facilities as well.
5. Unknown entity kinds, invalid data or missing references abort the conversion.
   DDL and copied data roll back, the completion marker is absent, and legacy
   records remain intact. Resolve the data issue and rerun; no placeholder users,
   campuses or drives are created to hide errors.
6. Rerunning a completed migration does not recopy legacy data or reset progress.
   The retained legacy table is a cutover snapshot, not an ongoing backup.
   Restoring that snapshot after new activity would lose subsequent changes.

The migration locks the legacy table during the copy and installs write guards.
Older backend instances cannot silently write to the obsolete table after the
cutover; their writes fail with a message to restart the backend. Legacy reads
remain available for verification. The guard also applies on already migrated
databases through migration `003-legacy-write-guard`.

Migration `004-stable-account-key-and-campus-checks` aligns databases that already
received earlier relational definitions. It switches the account primary key to
the stable account ID while retaining the unique lookup key and existing foreign
keys. It also enforces required campuses on core placement tables. Earlier SQLite
account definitions are rebuilt inside a transaction, with all child references
checked before commit and foreign-key enforcement restored afterward. SQLite
uses write triggers where an existing table lacks the campus check.

Foreign keys are enabled on each SQLite connection. PostgreSQL tables retain the
server-only row-level-security posture: RLS is enabled and direct client access
has no policies. The backend must use the table owner or an appropriate service
role; tenant and role authorization continues in the API. Adding client policies
or replacing the shared lock requires a separate reviewed change.

## Verification

Run `npm run test:database` for database relationships, uniqueness, tenant
isolation, invalid-update rollback, migration backups, legacy conversion and
repeat-run coverage. Add `-- --local-copy` to check a consistent copy of the local
database without modifying the source. Tests use isolated databases and remove
only their generated temporary directory.

Run `npm run db:verify` to check the configured database's migration markers,
table counts, account primary key, application relationships and hydrated reads.
It outputs aggregate counts, not private account payloads. Add `-- --local` to
verify the SQLite fallback.

Also run the placement demonstration, resume workflow and round scheduling tests
to verify the public service contracts. SQLite execution is covered by these
tests. Run `npm run test:database -- --postgres` to verify the same constraints and
legacy backfill against the configured PostgreSQL connection. That option creates
an isolated schema with synthetic fixtures and drops only that generated schema;
it does not modify application tables. The database role needs schema creation
permission. Run it before deploying to a hosted environment.
