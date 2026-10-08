# CampusLink

CampusLink is a campus placement application with a Next.js frontend, an Express API and persistent database records. It provides student preparation, recruiter drives, campus placement workflows and an administrator dashboard.

## Local setup

Use Node.js 24.x. From the repository root:

```sh
npm install
```

Copy `.env.example` to `.env` and `server/.env.example` to `server/.env` if they do not exist. Preserve existing credentials when updating configuration.

```sh
npm run dev
```

Open http://localhost:3000. This starts the API on port 8000 before the website, or reuses a healthy API already running there. To manage them separately, use `npm run server:dev` and `npm run dev:frontend` in separate terminals.

Without external database credentials, development uses SQLite, local private uploads and an email outbox. A configured `DATABASE_URL` selects PostgreSQL.

## Project structure

For access from devices on the same Wi-Fi, add this PC's exact frontend origin to
`DEV_FRONTEND_ORIGINS` in both `.env` and `server/.env`, for example
`http://192.168.1.10:3000`, then restart `npm run dev`. In Administrator PowerShell,
run `powershell -ExecutionPolicy Bypass -File .\scripts\enable-wifi-access.ps1`
from the repository root. This allows port 3000 only from the Wi-Fi subnet. Open
the printed address on other devices; VS Code port forwarding is unnecessary.
If the PC's Wi-Fi address changes, update the origins and rerun the script.

| Directory                                | Contents                                                                  |
| ---------------------------------------- | ------------------------------------------------------------------------- |
| `src/app`                                | Next.js routes and styles                                                 |
| `src/features`                           | Student, recruiter, campus and administrator screens                      |
| `src/components`                         | Shared interface components                                               |
| `src/services`, `src/store`, `src/hooks` | API clients, session state and interface behavior                         |
| `src/types`, `src/utils`, `src/config`   | Shared contracts, business rules and settings                             |
| `src/mocks`                              | Existing question banks, data and adapters referenced by application code |
| `server`                                 | Express API, authentication, database, workflows and integrations         |
| `scripts`                                | Local development startup                                                 |
| `public`                                 | Images, fonts, logos and other static assets                              |

API routes and payloads are documented in [server/API.md](server/API.md). Asset source notes and font licenses remain with their assets.

## Accounts and administration

Each role has its own dashboard component and layout:

| Role          | Dashboard              | Main responsibilities                                                            |
| ------------- | ---------------------- | -------------------------------------------------------------------------------- |
| Student       | `/student/dashboard`   | Career profile, readiness, skill gaps, opportunities and personal offer progress |
| Recruiter     | `/recruiter/dashboard` | Applicant matching, visit confirmation, selection rounds and offer release       |
| Campus team   | `/campus/dashboard`    | Student readiness support, recruiter approvals, scheduling and campus outcomes   |
| Administrator | `/admin/dashboard`     | Account access, campuses, assessment content and audit history                   |

The student, recruiter, campus and admin dashboards are implemented in separate
files under `src/features`. Shared cards and data hooks are reusable components;
the dashboards select their own layouts and actions. The backend enforces role
and campus permissions on placement operations.

A campus team must register its institution before students can join. Campus and recruiter accounts require approval; email verification is not required for access. Administrative access is granted to an existing account by the project operator.

Build the backend before using operator commands:

```sh
npm run server:build
npm run db:approve -- campus-account@example.edu
npm run admin:grant -- admin-account@example.edu
```

Complete the account's profile before granting administrator access. Sign out and back in, then open `/admin/dashboard`. Remove administrator access with `npm run admin:revoke -- admin-account@example.edu`.

For local password-reset messages, run `npm run email:preview` and inspect `server/data/outbox.json`. Its single-use links are private.

## Service configuration

Keep server credentials in `server/.env` or backend hosting settings. Never expose them through `NEXT_PUBLIC_*` variables or commit `.env` files.

| Service                      | Settings                                                                                      |
| ---------------------------- | --------------------------------------------------------------------------------------------- |
| PostgreSQL                   | `DATABASE_URL`; `DATABASE_CA_PATH` when a provider CA is required                             |
| Private Supabase storage     | `STORAGE_PROVIDER=supabase`, `SUPABASE_URL`, `SUPABASE_SECRET_KEY`, `SUPABASE_STORAGE_BUCKET` |
| Email delivery               | `EMAIL_PROVIDER=resend`, `RESEND_API_KEY`, a verified `EMAIL_FROM`                            |
| Optional generative coaching | `AI_PROVIDER=openai`, `OPENAI_API_KEY`, `OPENAI_MODEL`                                        |
| Optional voice transcription | `SPEECH_PROVIDER=openai`, `OPENAI_API_KEY`, `OPENAI_TRANSCRIPTION_MODEL`                      |
| Optional external ML         | `ML_API_URL`, `ML_API_TOKEN`                                                                  |

Use a private storage bucket; the default name is `campuslink-private`. PostgreSQL TLS must validate the certificate and hostname. The public CA certificate is at `server/certs/supabase-ca.crt`; confirm it matches your database provider.

Voice and external analysis require explicit student consent. Typed practice and local preparation analysis work without these providers. Placement probabilities require a validated model trained on real historical outcomes; synthetic models are rejected. Restart the backend after changing its settings.

For Google sign-in, enable Google in Supabase Auth using a Google OAuth client. Set Google's redirect URI to `https://YOUR_PROJECT.supabase.co/auth/v1/callback`. In Supabase, set the Site URL to the frontend origin and allow the exact frontend callback path `/api/v1/auth/google/callback**` on that host.

## Deployment

Deploy the frontend to Vercel and the backend to Render, both from the repository root. The repository includes `vercel.json` and `render.yaml`.

The Render backend builds with `npm ci --include=dev && npm run server:build` and starts with `npm run server:start`. Configure `FRONTEND_URL` as the frontend HTTPS origin without a trailing slash, plus PostgreSQL, Supabase storage and Resend credentials. Production requires these external services. Render supplies `PORT`; Express binds to `0.0.0.0`. Database tables are created at startup.

Set these frontend variables in Vercel:

```dotenv
NEXT_PUBLIC_APP_ENV=api
NEXT_PUBLIC_API_URL=/api/v1
API_INTERNAL_URL=https://your-api.onrender.com
```

Use the actual backend origin without `/api/v1`. Redeploy the frontend when it changes: the API proxy is configured at build time. Browser requests use the frontend's `/api/v1` path so session cookies stay on the frontend domain. Update `FRONTEND_URL` on the backend when the frontend origin changes.

Check `/api/v1/health`, sign-in, account approvals, private uploads and password recovery after deployment. The backend needs a persistent process for email and reminder workers; sleeping hosting services delay requests and pause those workers.

## Project checks and builds

The prototype covers all three core placement-management capabilities:

| Capability                                      | Implementation                                                                                                                     |
| ----------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| Readiness profiling and skill-gap analysis      | Student profile, evidence-weighted readiness, job-specific skill gaps and campus preparation support                               |
| Recruiter-student matching and drive scheduling | Eligibility gates, ranked applicant matches, campus approval, recruiter confirmation, resource conflict checks and interview slots |
| Analytics and offer tracking                    | Campus/recruiter placement outcomes, offer release, student responses, document verification and joining progress                  |

The role dashboards link the demonstration flow: **Profiling → Matching →
Scheduling → Notification → Offer Tracking → Analytics**. Placement decisions
create stored in-app notifications. Real email delivery requires configured
credentials. Historical-model predictions are optional and require a validated
model; analytics and readiness insights work without one.

```sh
npm run typecheck
npm run server:typecheck
npm run lint
npm run server:build
npm run build
```

Start a built backend with `npm run server:start` and a built frontend with `npm start`. Automated test files and their runner have been removed from this project.
