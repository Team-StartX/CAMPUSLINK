# Deploy CampusLink

Deploy the frontend to Vercel, the Express backend to Render, and keep PostgreSQL and private uploads in Supabase. Both hosting projects use the repository root, not the `server` directory.

## 1. Put the project on GitHub

Upload the source, `package-lock.json`, `render.yaml`, `vercel.json`, and `server/certs/supabase-ca.crt`. Keep `.env`, `server/.env`, `node_modules`, `.next`, and `server/data` out of Git. The CA certificate is public; passwords and service keys are secrets.

## 2. Reserve the frontend URL

Import the GitHub repository in Vercel. Keep the root directory at the repository root and select Node.js 24.x. Record the stable production URL, for example `https://your-app.vercel.app`. Configure the backend below before running the first frontend build.

## 3. Deploy the backend on Render

Create a **Blueprint** from the same repository. Render reads `render.yaml` and prompts for these settings:

| Setting               | Value to provide                                                            |
| --------------------- | --------------------------------------------------------------------------- |
| `FRONTEND_URL`        | The stable Vercel HTTPS origin, without a trailing slash                    |
| `DATABASE_URL`        | Your Supabase PostgreSQL connection string, including the database password |
| `SUPABASE_URL`        | Your Supabase project URL                                                   |
| `SUPABASE_SECRET_KEY` | A Supabase server secret key or legacy service-role key                     |
| `RESEND_API_KEY`      | Your Resend API key                                                         |
| `EMAIL_FROM`          | A sender on your verified Resend domain                                     |

Create a **private** Supabase Storage bucket named `campuslink-private` if it does not exist. Confirm the included CA certificate belongs to your Supabase database. If your database has network restrictions, allow the backend's outbound addresses.

The Blueprint sets production mode, Supabase storage, Resend email, and Node.js 24.18.0. Render supplies `PORT`; leave it unset yourself. Express binds to `0.0.0.0`. The commands are:

```sh
npm ci --include=dev && npm run server:build
npm run server:start
```

The server creates its database tables during startup. Do not run the local demo seed in production. Check `https://your-api.onrender.com/api/v1/health` after deployment.

The template selects Render's free plan for a first deployment. Free services sleep when idle, delaying the first request and pausing the email/reminder workers. Use an always-on service when reliable scheduled delivery is needed.

## 4. Connect and deploy the frontend

Add these Vercel environment variables for Production:

```dotenv
NEXT_PUBLIC_APP_NAME=CampusLink
NEXT_PUBLIC_APP_ENV=api
NEXT_PUBLIC_API_URL=/api/v1
API_INTERNAL_URL=https://your-api.onrender.com
```

Replace the example backend URL with the real Render URL. Do not append `/api/v1`. Deploy or redeploy Vercel after setting it: Next.js builds the API proxy configuration at build time. Browser requests go through the frontend's `/api/v1` route so login cookies remain on the frontend domain. Never put database passwords or server secret keys in `NEXT_PUBLIC_*` variables.

If the frontend domain changes, update `FRONTEND_URL` on Render. For a new backend domain, update `API_INTERNAL_URL` on Vercel and redeploy. Preview domains need their own matching backend origin configuration; production login is configured for one stable frontend origin.

## 5. Enable Google login

In Supabase Authentication, enable Google with your Google OAuth client ID and secret. In Google Cloud, set the authorized redirect URI to `https://YOUR_PROJECT.supabase.co/auth/v1/callback`. In Supabase URL Configuration, set the Site URL to your frontend origin and add `https://your-app.vercel.app/api/v1/auth/google/callback**` to the redirect allow list. The suffix allows the browser-bound state query parameter; keep the hostname exact.

Use your deployed home, privacy, and terms URLs in Google's application branding settings. Complete a real Google login and the dashboard onboarding form after deployment.

## 6. AI and trained models

### External ML API

The backend connects to `https://campuslink-ml-demo.onrender.com` through `ML_API_URL`. In the CampusLink Express service's Render Environment settings, set `ML_API_TOKEN` to the ML service's private `CAMPUSLINK_ML_DEV_TOKEN` value. Keep the token on the backend only. Redeploy the backend and frontend, then open Admin → Activity & services → Check ML connection. The check sends only generic sample data, validates authentication and the job-match response, and reports missing configuration, rejected tokens, incompatible responses, or unavailable service without exposing secrets.

The connection adapter uses `Authorization: Bearer <ML_API_TOKEN>`, fixed `/v1/models/...` paths and a seven-second timeout per request. Redirects are rejected and the origin must match the consent destination. Students enable separate ML consent from their dashboard; existing OpenAI consent does not authorize this service. They can withdraw it to stop future requests. Emails and phone numbers are removed from text, but other identifying details may remain. Student workflows retain local analysis if consent is off or the service fails. The admin check tests all four contracts using sample data. The adapter rejects placement predictions from an `unverified_demo` artifact; a historical model is required for probability estimates.

External resume extraction supplies suggestions for review without changing verified skills. Job keyword relevance supplements the existing eligibility and fit calculation. Interview rubric feedback is preparation guidance. Historical-model estimates use the six current readiness scores; the training rubrics must be checked against these scores before interpreting the probabilities. ML responses never approve accounts or make hiring decisions.

The template uses the existing local AI/NLP implementation. To enable the optional OpenAI provider, configure `AI_PROVIDER=openai`, `OPENAI_API_KEY`, and `OPENAI_MODEL` on Render. To use a real trained placement model, include its validated artifact in the deployment and set `ML_MODEL_PATH` to its path. The ignored local model files are not uploaded automatically; synthetic demo models are not production models.

## Check the deployment

### Activate the administrator dashboard

The admin console is available at `/admin/dashboard`. It manages account approvals and access revocation, contests, question banks, assessments, campuses, integration status and audit history. Administrative access is a server-controlled permission on an existing account, not a public registration role.

1. Register your account, complete its dashboard profile, and verify its email (Google accounts are already email verified).
2. From the repository root, with `server/.env` configured for the deployed Supabase database, run:

```sh
npm run server:build
npm run admin:grant -- your-admin-email@example.com
```

3. Sign out and sign back in. Open `/admin/dashboard` on the frontend domain. The homepage dashboard action and login redirect now open the admin console for an administrator.

Free Render services do not provide a Shell; run this command locally with the same production database configuration. The command grants access only to the specified existing account and records an audit event. To remove administrator access, use `npm run admin:revoke -- your-admin-email@example.com`.

Content starts as a draft. Add multiple-choice questions, select them when creating an assessment, choose all campuses or a specific campus, and set its visibility to **published**. For contests, enter a challenge and an expected short answer. Current contests support short-answer validation; they do not execute submitted code. Archive content to hide it while retaining student history. Correct answers are excluded from student APIs, and assessment scores use server-held question snapshots.

Redeploy both the frontend and Express backend after installing this update. No database schema migration is needed beyond the existing startup migration: management records use the existing PostgreSQL `records` table.

- Open the home page and sign in through the frontend domain.
- Test profile completion, a private upload/download, and a password-reset email.
- Confirm the backend health endpoint responds and Render logs have no startup errors.
- Keep the backend as a running Express service: its background delivery and reminder workers need a persistent process.

Local development stays unchanged: frontend port 3000, backend port 8000. Start each in its own terminal with `npm run dev` and `npm run server:dev`.

Official references: [Render Blueprint settings](https://render.com/docs/blueprint-spec), [Render port binding](https://render.com/docs/web-services#port-binding), [Vercel Node.js versions](https://vercel.com/docs/functions/runtimes/node-js/node-js-versions), [Supabase redirect URLs](https://supabase.com/docs/guides/auth/redirect-urls).
