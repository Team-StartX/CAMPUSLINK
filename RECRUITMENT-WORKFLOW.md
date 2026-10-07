# CampusLink recruitment workflow

## Existing architecture retained

The Next.js catch-all route and `Platform` role router remain in place. The existing
AppShell, authentication, company profile, job request wizard, drive details,
opportunities, application cards, document upload/download, interviews, offers,
notifications, campus directory, analytics, and preparation features are reused.
The Express service dispatcher continues to enforce approved-account access and
derive roles from the authenticated account rather than browser arguments.

PostgreSQL and local SQLite continue using the existing `records` table with
`kind`, `campus_id`, and `owner_id` indexes. No existing account or placement data
is deleted. New entities are independently scoped records linked by drive,
application, round, assessment, and student IDs. Existing Drive and Workspace
projections stay compatible with historical records.

## New opportunities

1. Recruiter requests access through Explore campuses. Campus reviews the company
   request through Recruiters. Rejection requires a reason.
2. An accepted recruiter creates a complete job, explicitly adds its recruitment
   rounds, and submits it. New job defaults contain no recruitment rounds, tests,
   assignments, or invented campus-resource requirements.
3. Campus reviews the job, requests changes or rejects with a reason, or approves
   it for scheduling. Recruiters can edit and resubmit drafts and change requests.
4. Campus proposes date, reporting/start/end times, venue, building, rooms, online
   link, coordinator, instructions, and notes. Recruiter confirms or proposes an
   alternative slot. Campus finalizes and publishes the agreed schedule.
5. Only eligible students see published opportunities. Skills can be a hard
   requirement. Campus must explicitly verify any additional textual conditions.
   Eligible, interested, applied, shortlisted, and selected counts are separate.
6. Students review the real job and company details, show interest, choose their
   uploaded resume, review required documents, and agree before applying.
7. Campus starts the drive. Recruiters save individual or bulk decisions and publish
   results. Pending and Under Review decisions cannot be published. Only Qualified
   candidates advance; Rejected and Absent candidates cannot enter later rounds.
8. Assignment content exists only for Assignment rounds and is served only to a
   student who reached that round. Submission additionally requires the current
   round, a running drive, and an unexpired deadline. Text/link submissions and
   the existing private PDF/image upload mechanism are supported. Attached files
   must be owned by the student and match the assignment's allowed extensions.
9. Interview slots belong to the candidate's current interview round. Overlapping
   student, panel, or room reservations are rejected. Campus staff can override
   a conflict with an audited reason. Students see their slots in their interview
   hub and recruitment details.
10. Only final selections can receive an offer for the matching job. Offers link
    to an application and include location, joining date, acceptance deadline,
    and an HTTPS offer-letter link. Sent, Viewed, Accepted, Declined, Expired,
    and Joined are tracked. Campus retains existing document-verification checks
    for joining.

Schedule changes hide the opportunity until fresh agreement and publication.
Historical finalization cannot authorize a new proposal. Applications can be
closed explicitly; the campus cannot complete a new drive with unresolved
candidate outcomes.

## Stored relationships

| Record kind | Main references |
| --- | --- |
| campus-recruiter | campusId, recruiterId |
| drive | campusId, recruiterId; existing job projection |
| recruitment-round | driveId, roundId, order |
| drive-schedule | driveId; current schedule projection |
| interest | driveId, studentId |
| application | driveId, studentId, resumeId |
| candidate-round | driveId, applicationId, studentId, roundId |
| assignment | driveId, roundId |
| assignment-submission | assignmentId, applicationId, studentId, documentId |
| interview-slot | driveId, roundId, studentId |
| campus-assessment | campusId; batch/branch/student targeting |
| campus-assessment-session | assessment/student composite identifier |
| campus-assessment-attempt | assessmentId, studentId |
| audit / notification | campus scope and recipient/actor |

Assignments and campus assessments have different APIs and record kinds.
Campus assessments support the requested preparation categories, configurable
multiple-choice questions, availability windows, duration, targeting, marks,
instructions, and result visibility. They do not execute untrusted student code.
Attempts are graded on the server, cannot be replayed, and require a timed session.
Campus teams see their campus results; students see only their own permitted
results. Other campuses and recruiters cannot access these assessments.

The reminder worker delivers eligible application-deadline reminders, interview
reminders, and offer expiry updates. Drive operations, access decisions, eligibility
verification, results, submissions, and scheduling write notifications and scoped
audit records. Existing email configuration continues to control delivery.

## Compatibility and validation

New jobs have `workflowVersion: 2`. Historical jobs retain their existing lifecycle
and aggregate tracking; no synthetic progression is inferred for old applications.
Membership routes/promotions and recruiter preparation navigation were removed.
Student preparation tools remain separate from recruitment.

`server/recruitment.test.ts` exercises one sample company, campus A, several
students (eligible, ineligible, qualified, rejected, absent), and a second campus
for isolation checks. It covers approval, scheduling, publication, interest,
documents, applications, score thresholds, hidden future assignments, result
publication, interview conflicts and overrides, final selection, offers, schedule
changes, additional eligibility, and private campus assessments. The HTTP
regression suite also follows the new prerequisites.

Run `npm test`, frontend/backend type checks, lint, and both production builds.
Tests use isolated local databases and test files; they do not create sample
students, jobs, or offers in the configured production database.
