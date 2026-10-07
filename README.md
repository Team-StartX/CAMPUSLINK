# CampusLink

CampusLink is a campus placement application with a Next.js frontend and an
Express backend. The frontend always uses authenticated API requests and persisted
records. Browser demo authentication, sample placement previews, simulated paid
plans, and synthetic outcome inference have been removed.

## Run locally

Use Node.js 24.x. Install dependencies and run:

```sh
npm install
npm run dev
```

This starts both the frontend and the API. Open http://localhost:3000 and register
real accounts. A campus team must register an institution before its students can
join. Institution and recruiter accounts require approval. See
[BACKEND-SETUP.md](BACKEND-SETUP.md) for configuration and operator commands.

## Placement workflows

Recruiters request campus drives. Campus teams review requests, reserve resources,
agree schedules with recruiters, and activate student applications. The backend
checks campus membership, course, branch, year, CGPA and backlog eligibility.
Applications, shortlist decisions, interviews, offers, private documents and
joining progress are stored with authorization checks.

Preparation feedback uses submitted answers and recorded evidence. Curated skill
question banks remain available; published campus assessments and contests are
managed by administrators. Rankings and participation counts use campus records.
Sample datasets remain only as isolated regression-test fixtures.

## Voice input and external services

Voice practice records microphone audio and sends it through the authenticated
backend to OpenAI's Audio Transcriptions API after explicit consent. CampusLink
does not save audio recordings. Students review the resulting transcript before
saving feedback. Voice input is unavailable until configured; typed practice works
independently.

Configure secrets in `server/.env` or the hosting service's environment settings:

- Voice input: `SPEECH_PROVIDER=openai`, `OPENAI_API_KEY`, optionally
  `OPENAI_TRANSCRIPTION_MODEL` (default `gpt-4o-mini-transcribe`).
- Email verification is not required for signup or access, including existing accounts. Staff organization approval still applies. Password recovery and notification emails remain available.
- Real email: `EMAIL_PROVIDER=resend`, `RESEND_API_KEY`, verified `EMAIL_FROM`.
- Database and files: PostgreSQL and private Supabase storage settings.
- Optional generative coaching: `AI_PROVIDER=openai`, `OPENAI_API_KEY`,
  `OPENAI_MODEL`, and student consent.
- Optional placement probabilities: an evaluated model trained on real historical
  outcomes. Synthetic artifacts cannot produce predictions.

Never put secret keys in browser variables or commit them. See
[DEPLOYMENT.md](DEPLOYMENT.md) for hosting and [server/API.md](server/API.md) for
existing API contracts. Provider presence does not establish live connectivity;
verify real email, microphone transcription, database and storage on deployment.

## Validation

```sh
npm run typecheck
npm run server:typecheck
npm run lint
npm test
npm run server:build
npm run build
```

The tests use isolated databases and provider mocks. Live service verification,
backup recovery, monitoring and workload checks remain deployment requirements.
