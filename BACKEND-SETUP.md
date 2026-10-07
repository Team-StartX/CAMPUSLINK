# CampusLink backend setup

CampusLink now has a Node.js / Express / TypeScript API. The existing Next.js interface calls it through a same-origin `/api/v1` proxy. The local development configuration runs without external credentials using a persistent SQLite database, private local file storage, an email outbox, local NLP and real authenticated placement workflows.

## Run locally

Use Node.js 24 or newer. From `C:\CampusLink`:

For day-to-day development, run `npm run dev`. It starts the local API, waits for its
database health check, and then opens the Next.js development server. A healthy API
already running on the configured address is reused. Use `npm run dev:frontend` only
when you intentionally manage the API in a separate terminal or use a remote API.

For initial local database setup or to run the built backend separately:

```powershell
npm install
npm run server:build
npm run db:migrate
npm run server:start
```

In a second terminal:

```powershell
npm run dev:frontend
```

Copy `.env.example` to `.env` and `server/.env.example` to `server/.env` if those files do not exist. Do not overwrite existing secrets. The frontend always uses the authenticated API. Demo authentication and browser workspace fallbacks have been removed. Use `npm run server:dev` for backend editing.

Register students against a campus already registered by a campus team. Recruiters and campus staff start pending approval. The project operator approves the first verified institution with `npm run db:approve -- campus-account@example.edu`. An approved campus team can review recruiter accounts in its workspace. Email verification remains required before business operations in production.

For local verification/reset emails, run `npm run email:preview` and inspect `server/data/outbox.json`. It contains private, single-use links and must not be shared. Use the link in your browser to verify or reset; passwords are hashed and all previous sessions are revoked on reset.

## What to provide for hosted services

Google sign-in uses Supabase Auth with a server-side PKCE exchange and short-lived, browser-bound, single-use OAuth state. Tokens stay on the server and are exchanged for the existing CampusLink HTTP-only session. Existing users retain their role and approval state. New users complete their details inside the dashboard. Placement operations are blocked until setup is complete; campus and recruiter accounts still require approval.

### Enable Google sign-in

1. In Google Cloud Console, configure the OAuth consent screen and create a **Web application** OAuth client. Add `http://localhost:3000` as an authorized JavaScript origin for local development, and your HTTPS origin for deployment.
2. Add `https://tynkhqpricyihhcfcfxz.supabase.co/auth/v1/callback` as an **authorized redirect URI** in Google Cloud. This is the Supabase callback, different from the app callback below.
3. In Supabase Dashboard → Authentication → Sign In / Providers → Google, enable Google and enter the client ID and client secret. Keep the secret in Supabase; do not put it in frontend environment variables.
4. In Supabase Authentication → URL Configuration, set Site URL to `http://localhost:3000` and allow `http://localhost:3000/api/v1/auth/google/callback**`. The suffix permits the browser-bound `state` query parameter. Add the equivalent exact HTTPS host/path for deployment; avoid wildcard hosts.
5. If the Google consent app is in testing mode, add the intended testers. Then use **Continue with Google**. The login page checks whether the provider is enabled.

The existing Supabase project URL and server secret key are sufficient for this app integration. A new campus must register before students can choose it. After reviewing the first campus account, approve it with `npm run db:approve -- account@example.edu`.

PostgreSQL application tables have row-level security enabled with no browser-facing policies. The Express server applies role/campus checks through its PostgreSQL connection; publishable-key and Google clients cannot directly read private account/session/workspace records.

Official configuration reference: https://supabase.com/docs/guides/auth/social-login/auth-google

### Hosted credentials

For verified PostgreSQL TLS, use `sslmode=verify-full` in `DATABASE_URL`. If the runtime reports `SELF_SIGNED_CERT_IN_CHAIN`, download the database CA certificate from Supabase Dashboard → Database Settings and set `DATABASE_CA_PATH` to its local file path in `server/.env`. The backend validates the certificate and hostname. A Supabase publishable key cannot replace the server secret key for private document storage.

Put these values in **server/.env**, not in chat and not in variables prefixed with `NEXT_PUBLIC_`:

| Service                      | Required values                                                                                                  | Where to get them                                                                                                                                          |
| ---------------------------- | ---------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| PostgreSQL                   | `DATABASE_URL`                                                                                                   | Supabase dashboard → Connect → Session pooler; replace the password placeholder with your database password and use the provider's TLS connection settings |
| Private file storage         | `STORAGE_PROVIDER=supabase`, `SUPABASE_URL`, `SUPABASE_SECRET_KEY`, `SUPABASE_STORAGE_BUCKET=campuslink-private` | Supabase → Settings → API Keys; create the **private** `campuslink-private` bucket in Storage                                                              |
| Email                        | `EMAIL_PROVIDER=resend`, `RESEND_API_KEY`, `EMAIL_FROM`                                                          | Resend API key and a verified sending domain, for example `CampusLink <placements@your-domain>`                                                            |
| Optional generative coaching | `AI_PROVIDER=openai`, `OPENAI_API_KEY`, `OPENAI_MODEL`                                                           | A project-scoped OpenAI API key and a model available to your account; default integration uses `gpt-4.1-mini`                                             |
| Deployment                   | `FRONTEND_URL`, frontend `API_INTERNAL_URL`, HTTPS hosting/domain                                                | The exact frontend origin and private backend address                                                                                                      |
| Historical ML training       | Consented, anonymized outcome rows in the documented JSON format                                                 | Institution-owned historical placement records, with cohort labels and observed outcomes                                                                   |

No Supabase account password, organization owner access or management API token is required. The database connection and storage key grant the server access. Restrict them to this development project; create separate production credentials. API authorization protects private storage access; no public bucket is used.

The PostgreSQL driver is `pg`, with explicit SQL migrations and transactions, rather than Prisma. Both database implementations share the same repository contract. Migrations initialize campus-indexed records for accounts, sessions, profiles, drives, applications, documents, notifications, jobs and audit data. Switching to PostgreSQL does not automatically copy SQLite demo records; create real accounts or perform a reviewed data migration.

The API defaults to port `8000` and binds to `0.0.0.0`; `PORT` and `HOST` can override these values. For Render and Vercel deployment, follow [DEPLOYMENT.md](DEPLOYMENT.md). Next.js proxies the API under the frontend's `/api/v1` path. The production configuration refuses SQLite, local upload storage and the email outbox, and checks required external-service credentials before starting.

## AI, NLP and ML

1. **Readiness:** shared, tested weighted evidence scoring for skills, academics, projects, aptitude, communication and interview records. No external model is needed.
2. **NLP extraction:** a boundary-aware technology alias dictionary extracts skills and explicit job criteria. Academic criteria remain human-reviewable. Resume analysis parses text-based PDF files; scanned PDFs require an OCR service that is not connected.
3. **Hybrid matching:** eligibility gates the result. Eligible pairs combine rule evidence (85%) and TF-IDF cosine text relevance (15%). Candidate rankings include individual factors, gaps, eligibility checks, readiness and NLP relevance. Recruiters see applicants to their own drives; campus teams see students from their institution.
4. **Interview feedback:** submitted answers are analyzed for detail, topic relevance, structure and specific evidence. Feedback is stored with the completed practice session. These heuristics are preparation guidance, not validated communication assessments.
5. **Generative coaching:** optional OpenAI Responses API with structured output, a bounded response budget, server-only keys, timeout and local fallback. Each student must opt in before resume text or answers are sent externally. Email/phone patterns are redacted, but the user should still avoid entering unnecessary personal details. No names or demographic profile fields are used for coaching, and the provider cannot change placement records.
6. **Outcome ML:** regularized logistic regression learns six evidence weights from labelled rows. The latest sorted cohort is held out for evaluation; accuracy, precision, recall and Brier score are reported. Synthetic models are blocked for inference in every environment. Historical model estimates support preparation and do not automatically reject candidates, award jobs or determine eligibility.
7. **Assistant:** a local, record-grounded FAQ/eligibility assistant answers from the authenticated student's drives, offers, documents and interviews.

### Train with historical records

Create an anonymized JSON array, with scores from 0 to 100 and `placed` as an observed 0/1 outcome. Use chronological ISO-style cohort labels and evidence measured **before** the outcome to avoid label leakage. Each person must appear in only one cohort/split.

```json
[
  {
    "cohort": "2024",
    "verifiedSkills": 70,
    "academics": 82,
    "projects": 65,
    "aptitude": 74,
    "communication": 68,
    "interview": 72,
    "placed": 1
  }
]
```

Use at least 60 rows across at least three cohorts. Both training and held-out sets need placed and unplaced outcomes. Run:

```powershell
npm run ml:train -- C:\path\historical-outcomes.json
```

Keep the generated artifact and its evaluation with a versioned training dataset in private storage. Assess ranking quality, calibration and subgroup errors using the institution's consented evaluation process before treating predictions as reliable. Synthetic artifacts are rejected for inference in every environment.

## Verification

```powershell
npm run typecheck
npm run server:typecheck
npm run lint
npm test
npm run server:build
npm run build
```

Backend tests exercise real Express requests against an isolated SQLite database: passwords, CSRF, role/campus isolation, protected profile fields, empty registration profiles, drive lifecycle, schedule race rejection, grading/replay protection, private files, submitted-answer feedback, offer verification/joining, and reset-token consumption. External PostgreSQL, Supabase, Resend and OpenAI calls require your credentials and are not claimed as verified until configured.

The API uses indexed campus/owner records and transactional workflows. A conservative global transaction lock currently serializes placement mutations across PostgreSQL API instances to prevent reservation races. Before large multi-campus rollout, partition locking by campus/resource, move AI/email workers outside placement transactions, add retention/cleanup policies and benchmark real workload sizes. This is a working local full-stack product implementation, not a claim of production certification.

## Recorded voice transcription

Voice practice uses microphone recording (`MediaRecorder`) and the authenticated
`POST /api/v1/voice/transcriptions` endpoint. It no longer depends on the browser's
speech recognition service. The backend calls OpenAI's Audio Transcriptions API;
the default model is `gpt-4o-mini-transcribe`. Recordings are limited to three minutes
in the UI and 12 MB on the server. The app requires explicit consent per recording,
server authentication and CSRF protection. Audio is held in request memory and is
not saved to CampusLink storage. Transcripts are saved only when students submit
practice for feedback.

Set in `server/.env` (or your hosting environment):

```dotenv
SPEECH_PROVIDER=openai
OPENAI_API_KEY=your-project-key
OPENAI_TRANSCRIPTION_MODEL=gpt-4o-mini-transcribe
```

Keep the key out of browser variables and chat. Without these settings, voice is
unavailable and typed practice still works. Restart the backend after configuring.
Live transcription must be tested with a real microphone and provider credentials.
Official reference: https://developers.openai.com/api/docs/guides/speech-to-text

## Remaining external setup

- Real verification/reset email: `EMAIL_PROVIDER=resend`, `RESEND_API_KEY`, and a
  verified `EMAIL_FROM` address.
- Live database and storage: existing PostgreSQL/Supabase settings must be verified
  against the deployment; having values present does not prove connectivity.
- Google login: enable the Google provider and configure its OAuth credentials
  and redirect URLs in Supabase.
- Optional external ML: a private HTTPS service implementing the documented
  contracts plus `ML_API_URL` and `ML_API_TOKEN`. No demonstration service is used
  by default; the retired demonstration host is rejected.
- Placement probabilities: consented historical outcome records and an evaluated
  model. Rule-based preparation and matching work without a trained model.
- Paid plans are removed. Adding subscriptions later requires a payment provider,
  server-side entitlement storage, and verified webhook handling.
