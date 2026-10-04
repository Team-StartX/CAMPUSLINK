# CampusLink deployment readiness review

Reviewed 4 October 2026. This review covers the repository and local validation; it does not verify the running hosted services.

## Fixes completed

- Reject unknown storage, email, and AI providers at startup. A typo in the storage provider previously bypassed the production guard and fell back to local files.
- Require exact HTTPS frontend and Supabase origins, a PostgreSQL connection URL, and a key when the optional external AI provider is enabled.
- Set API responses to `Cache-Control: no-store`, including authentication and error responses. Private document downloads retain `private, no-store`; portraits explicitly permit only a short private browser cache.
- Default browser API requests to `/api/v1`, using the existing frontend proxy instead of a localhost address.
- Distinguish deliberate business-rule errors from unexpected failures. Known workflow rejections keep useful messages and HTTP 422; unexpected failures return HTTP 500 with a generic message, without infrastructure details.
- Add regression coverage for production configuration, cache policy, and error disclosure.

## Local evidence

- 134 tests passed across 16 files, including authentication, CSRF, role/campus isolation, drive workflows, files, and the action center.
- Frontend and backend TypeScript checks passed.
- Frontend lint and whitespace checks passed.
- Backend bundle built successfully.
- Frontend production build passed after the review fixes.

## Checks required on the hosted deployment

Follow [DEPLOYMENT.md](DEPLOYMENT.md) using the actual frontend and backend origins. Provider keys belong in hosting environment settings, never in browser variables or source control.

1. Confirm the frontend is built with `NEXT_PUBLIC_APP_ENV=api`, `NEXT_PUBLIC_API_URL=/api/v1`, and the actual backend `API_INTERNAL_URL`. Confirm the backend has `NODE_ENV=production` and the matching HTTPS `FRONTEND_URL`.
2. Verify the deployed health endpoint and PostgreSQL TLS connection. Exercise a student, recruiter, and campus account through the frontend proxy, including verification, approval, and a cross-role access denial.
3. Upload and download a private document and confirm a different account cannot fetch it. Confirm the storage bucket is private.
4. Receive a real verification and password-reset email. Exercise Google login if enabled. These require provider configuration and cannot be established by local mocks.
5. Complete a request → campus review → scheduling → recruiter confirmation → activation → application → offer workflow with test accounts.

## Operational work before a wider rollout

- The current deployment template selects a free backend service. Choose hosting that keeps the process running if scheduled email and reminders must be dependable.
- Email delivery currently runs inside the global placement transaction. Slow provider calls can hold the lock; isolate delivery jobs before scaling and load-test concurrent placements.
- Rate limits currently use process memory. Multiple API instances need a shared rate-limit store and reviewed proxy configuration.
- Establish database/storage backup and restore verification, retention rules for sessions and personal records, and error/worker monitoring.

The local changes improve deployment safeguards. Live integration, recovery, and workload checks remain required before describing the deployment as production-ready.
