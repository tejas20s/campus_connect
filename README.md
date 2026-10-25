# CampusConnect

CampusConnect is a college placement and alumni portal built with React, Express, PostgreSQL, and Prisma.

## Implemented

- Responsive landing page, sign-in, registration, jobs, opportunity details, application tracking, and dashboard views.
- Recruiter company setup, job-draft creation, publishing, archiving, applicant review, and interview scheduling screens; placement-office recruiter approval screen.
- JWT-based API authentication and bcrypt password hashing.
- Public registration for students and alumni; recruiter accounts require placement-office approval. Placement Officer accounts cannot be created through public registration.
- Role-protected, validated job and application APIs.
- Searchable, filterable, paginated public job listings.
- Student-specific branch, graduation year, CGPA, and skill matching on job listings and details, with missing-requirement explanations and skill recommendations; API-side eligibility checks and database-backed duplicate-application prevention remain authoritative.
- Application status updates, interview scheduling data, and in-app application status notifications.
- Student profile editing, private JPEG/PNG profile-image and PDF resume uploads with MIME/signature/size checks, and short-lived private Cloudinary URLs.
- Public alumni directory with search/filter/pagination, profile privacy control, and student-to-alumni mentorship requests with accepted/declined transitions.
- Placement Officer analytics, filters, Recharts visualizations, selected-placement CSV export, announcements, placement drives, and recruiter approval.
- Placement Officer student registry with search, academic filters, pagination, and privacy-safe application totals.
- Per-user notifications and read status; optional Resend messages for registration, applications, and status/interview updates using a branded, escaped email template.
- API and authentication rate limits, production secret checks, and transactional recruiter-approval audit records.
- Prisma schema for users, student/recruiter/alumni profiles, companies, jobs, applications, interviews, drives, announcements, mentorship requests, notifications, and audit logs.
- Swagger UI at `/api-docs` and OpenAPI JSON at `/api-docs.json`.

## Requirements

- Node.js 20 or later
- npm
- PostgreSQL 14 or later

## Local setup (PowerShell)

From the project root:

```powershell
npm install
Copy-Item .env.example .env
```

Edit `.env` and set `DATABASE_URL` to your local PostgreSQL database. For a standard local PostgreSQL installation, it has this format:

```text
postgresql://postgres:YOUR_PASSWORD@localhost:5432/campusconnect?schema=public
```

Create a PostgreSQL database named `campusconnect` (for example, in pgAdmin), then run:

```powershell
npm run db:migrate
npm run db:generate
npm run db:seed
npm run dev
```

The Vite client runs at `http://localhost:5173`; the API runs at `http://localhost:5000`. Prisma scripts and the server load the root `.env` file. If PostgreSQL uses another port, update the URL accordingly.

`db:seed` creates fictional development accounts, a sample verified company, two openings, and a sample student application. It refuses to run unless `NODE_ENV=development`.

| Role | Email | Local demo password |
| --- | --- | --- |
| Student | `student@campusconnect.example` | `CampusConnectDemo2026!` |
| Recruiter | `recruiter@campusconnect.example` | `CampusConnectDemo2026!` |
| Placement Officer | `officer@campusconnect.example` | `CampusConnectDemo2026!` |
| Alumni | `alumni@campusconnect.example` | `CampusConnectDemo2026!` |

These are fictional local-only accounts. Do not use the demo password or seed records in production.

### Environment variables

| Variable | Purpose |
| --- | --- |
| `DATABASE_URL` | PostgreSQL connection string |
| `JWT_SECRET` | Secret used to sign access tokens; replace the example value |
| `JWT_EXPIRES_IN` | Access-token lifetime, for example `7d` |
| `PORT` | API port (default `5000`) |
| `CLIENT_URL` | Allowed browser origin for API CORS |
| `VITE_API_URL` | API base URL used by the client |
| `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET` | Server-only credentials for authenticated resume and profile-image uploads |
| `RESEND_API_KEY`, `RESEND_FROM_EMAIL` | Optional email sender; delivery remains disabled unless both are configured |
| `NODE_ENV` | Runtime mode |

Never commit `.env` or put production credentials in `.env.example`.

## Current API

All endpoints use the `/api/v1` prefix.

| Method | Endpoint | Access |
| --- | --- | --- |
| `GET` | `/health` | Public |
| `POST` | `/auth/register` | Public |
| `POST` | `/auth/login` | Public |
| `POST` | `/auth/refresh` | Authenticated |
| `POST` | `/auth/logout` | Authenticated |
| `GET` | `/auth/me` | Authenticated |
| `GET` | `/jobs` | Public, paginated and filterable |
| `GET` | `/jobs/:jobId` | Public |
| `POST` | `/jobs` | Approved recruiter or placement officer |
| `PATCH` | `/jobs/:jobId` | Approved recruiter for own company or placement officer |
| `DELETE` | `/jobs/:jobId` | Approved recruiter for own company or placement officer; archives the opening |
| `POST` | `/companies` | Approved recruiter |
| `GET` | `/companies` | Public, verified companies |
| `GET` | `/companies/mine` | Approved recruiter |
| `GET` | `/jobs/mine` | Approved recruiter |
| `POST` | `/jobs/:jobId/applications` | Student |
| `GET` | `/applications/my` | Student |
| `POST` | `/applications/:applicationId/withdraw` | Owning student |
| `GET` | `/jobs/:jobId/applications` | Owning recruiter or placement officer |
| `PATCH` | `/applications/:applicationId/status` | Owning recruiter or placement officer |
| `DELETE` | `/applications/:applicationId/interview` | Owning recruiter or placement officer |
| `GET` | `/students/me` | Student |
| `PATCH` | `/students/me` | Student |
| `POST` | `/students/me/resume` | Student; PDF only, 5 MB max |
| `GET` | `/students/me/resume` | Student; returns a short-lived private download URL |
| `POST`, `GET` | `/students/me/profile-image` | Student; upload image or get a short-lived private image URL |
| `GET` | `/students/:studentId/resume` | Recruiter for a company the student applied to, or Placement Officer |
| `GET` | `/alumni` | Public, public-safe fields with search and pagination |
| `GET` | `/alumni/:alumniId` | Public, public-safe fields |
| `GET`, `PATCH` | `/alumni/me` | Alumni |
| `POST` | `/mentorship-requests` | Student |
| `GET` | `/mentorship-requests` | Student or Alumni, user-scoped |
| `PATCH` | `/mentorship-requests/:requestId` | Target Alumni, pending requests only |
| `GET` | `/admin/recruiters/pending` | Placement officer |
| `PATCH` | `/admin/recruiters/:recruiterId/approval` | Placement officer |
| `GET` | `/admin/students` | Placement Officer; paginated student search and academic filters |
| `GET` | `/analytics/overview`, `/analytics/placements`, `/analytics/export.csv` | Placement officer |
| `GET`, `POST`, `PATCH`, `DELETE` | `/announcements` and `/announcements/:announcementId` | Public list; Placement Officer writes |
| `GET` | `/placement-drives` | Public list of upcoming drives |
| `GET` | `/placement-drives/manage` | Placement Officer; list drives for administration |
| `POST`, `PATCH`, `DELETE` | `/placement-drives` and `/placement-drives/:driveId` | Placement Officer writes |
| `GET` | `/notifications` | Authenticated, own notifications |
| `PATCH` | `/notifications/:notificationId/read` | Authenticated, own notification |

Protected API requests use the `Authorization: Bearer <token>` header. The client keeps its access token in `sessionStorage` and attaches it to API requests.

The current access-token flow remains compatible with the existing frontend. `sessionStorage` limits persistence to the browser tab, but the token is still accessible to JavaScript and therefore vulnerable to XSS; an HttpOnly-cookie/refresh-token migration remains a future hardening task. Configure `CLIENT_URL` to the exact production frontend origin and use HTTPS in production.

### Cloudinary uploads

Create a Cloudinary account and set `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, and `CLOUDINARY_API_SECRET` on the server only. Resume and profile-image uploads are sent through the server, limited to 5 MB, checked for extension, MIME type and file signature, and stored with authenticated access. Short-lived resume URLs are limited to the student and authorized recruiters/placement officers; profile-image URLs are available to the student. Without credentials, other features remain available and uploads respond with a setup error.

### Resend email setup

Set `RESEND_API_KEY` and a verified `RESEND_FROM_EMAIL` on the server. Email delivery is optional; absent credentials disable it without failing registration or placement operations. Provider failures are logged without undoing saved database changes. Do not place either credential in client environment variables.

## Deployment outline

- **PostgreSQL:** create a managed PostgreSQL database and provide its connection URL as `DATABASE_URL`.
- **Render API:** deploy the repository root as a Node web service using the included `render.yaml`. Set the server environment variables; the blueprint installs locked dependencies, generates Prisma Client, builds the client, applies production migrations, and starts the server workspace.
- **Vercel client:** deploy the `client` directory as a Vite app and set `VITE_API_URL` to the deployed API's `/api/v1` URL. The included `client/vercel.json` keeps React Router routes working on refresh.
- Keep `JWT_SECRET`, database credentials, Cloudinary secrets, and Resend credentials in deployment secret settings; never in source control.

## Tests and build

From the project root:

```powershell
npm test
npm run build
```

For the focused client checks, run `npm test --workspace client -- --pool=threads --maxWorkers=1`. The single-worker option avoids Vitest worker startup timeouts in some Windows environments.

## Planned next stages

The current milestone implements core student, recruiter, alumni, mentorship, and placement-office workflows. Remaining limitations include persistent refresh-token revocation, alumni profile-image upload, recruiter interview cancellation UI, broader student record editing/deletion, paginated admin datasets at very large scale, and live-provider tests/deployment verification. Supply external credentials and configure hosting before enabling those services in production.
#   c a m p u s _ c o n n e c t  
 