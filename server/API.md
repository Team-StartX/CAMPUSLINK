# Express API reference

Google auth: `GET /auth/google/status` reports provider availability; `GET /auth/google?role=student|recruiter|campus` starts server PKCE sign-in; `GET /auth/google/callback` consumes the browser-bound state and verifies the Supabase Google identity. `PUT /account/onboarding` accepts `{name, institution, campusId?, course?, branch?, year?, cgpa?, bio?}` with session/CSRF protection. Student academic fields are required. Roles, email, verified skills and approval cannot be assigned through onboarding. Existing accounts retain their role; newly created staff stay pending approval.

Base: `/api/v1`. Responses are JSON unless downloading a private file. Authentication uses a random, HTTP-only cookie, a hashed persistent session record, secure cookies in production, explicit origin checking and a session-specific `X-CSRF-Token` for authenticated writes. Obtain the token through login/register or `GET /auth/me`. No browser-supplied role or user ID is trusted as authentication.

For authorized team operations on one student, set `X-Student-ID`. The server checks the student against the campus or recruiter applicant pool. Leaving it empty selects the first authorized student; the interface exposes a selector. Recruiters cannot browse unrelated registered students.

| Endpoint                                                                                                | Purpose                                                                                                    |
| ------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| `GET /health`, `/capabilities`, `/campuses`                                                             | Health and public setup information                                                                        |
| `POST /auth/register`, `/auth/login`                                                                    | Validated accounts and cookie sessions                                                                     |
| `GET /auth/me`                                                                                          | Current server identity and CSRF token                                                                     |
| `POST /auth/logout`                                                                                     | Revoke the current session                                                                                 |
| `POST /auth/forgot-password`, `/auth/reset-password`, `/auth/verify-email`, `/auth/resend-verification` | Single-use recovery and verification                                                                       |
| `GET /approvals`, `POST /approvals/:id`                                                                 | Approved campus teams review recruiter organizations                                                       |
| `GET /account/ai-consent`, `PUT /account/ai-consent`                                                    | Optional external coaching consent                                                                         |
| `POST /services/:service/:method`                                                                       | Typed service adapter calls, body `{ "args": [...] }`; server role allowlist in `services.ts`              |
| `POST /documents`                                                                                       | Student multipart upload; `file` and `type`, max 10 MB; PDF/PNG/JPEG/WebP signature validation             |
| `GET /documents/:id/download`, `/photos/:id`                                                            | Authorized private document/portrait bytes                                                                 |
| `GET /drives/:id/matches`                                                                               | Authorized hybrid ranking with eligibility explanations                                                    |
| `POST /drives/:id/schedule-suggestions`                                                                 | Campus requests three conflict-free date suggestions from a valid schedule; reservations rechecked on save |
| `GET /analytics`                                                                                        | Campus-wide or recruiter-owned pipeline, conversions, CTC, documents and preparation support               |
| `GET /organization`, `PUT /organization`                                                                | Persistent recruiter company profile                                                                       |
| `POST /assistant`                                                                                       | Student-owned record answers, body `{ "question": "..." }`                                                 |
| `GET /audit`, `/integration-status`                                                                     | Approved campus operational information                                                                    |

Service groups cover student profiles/skills, eligibility/matching, applications, assessments, contests, readiness/NLP, interviews/templates, recruiter/campus views, notifications, offers, documents, learning, and drives. Each exposed operation is explicitly listed in the server policy. Demo reset and conflict bypass endpoints are deliberately not exposed.

Assessment responses omit answer keys; the server records the attempt and grades submitted options. Practice feedback uses submitted text, and completing the same session twice is rejected. Verified skills and XP cannot be set through profile patches.

Drive states: DRAFT → SUBMITTED → UNDER_REVIEW → SCHEDULING → AWAITING_RECRUITER_CONFIRMATION → CONFIRMED → campus finalization → ACTIVE → IN_PROGRESS → COMPLETED. Review changes, rejection, cancellation and recruiter resubmission have role/state guards. Drafts and inactive requests are not student opportunities.

Post-selection: recruiter records an offer after the application reaches Offer; student accepts/declines/defers/withdraws; campus verifies documents and records joining. A verified resume and no outstanding unverified documents are required before joining is recorded. Offers support Full-time, PPO and Internship conversion.

Notifications are stored per recipient and queue targeted email jobs atomically with record changes. Workers retry email with deduplication/idempotency keys; local outbox delivery sends nothing externally. Interview and joining/document reminders run periodically with daily deduplication. Removed file objects are queued for cleanup, not deleted before record transactions commit.

Storage uses a private Supabase bucket when configured, or an access-controlled local folder in development. Database records never contain storage-provider secret keys. The files are not served from `public/`.
