# CampusConnect

CampusConnect is a college placement and alumni portal built with React, Vite, Express, PostgreSQL, and Prisma.

## Features

- Responsive React application for students, recruiters, alumni, and Placement Officers.
- Student registration, dashboard, profile and academic editing, skills, certifications, projects, portfolio links, private PDF resume uploads, and profile images.
- Job search, filters, pagination, and transparent eligibility/skill matching based on branch, graduation year, CGPA, and skills. Eligible-only and minimum-skill-match filters run against the complete matching result set.
- Job applications with duplicate prevention, application history, recruiter feedback, interviews, and in-app notifications.
- Recruiter company setup/editing, job creation/editing with eligibility requirements, publishing, archiving, applicant review, status updates, interview scheduling, and scoped resume access.
- Placement Officer recruiter approvals, student registry, database-backed placement analytics, department/year/company breakdowns, CSV export, placement drives, and announcements.
- Alumni directory and profiles, searchable skills/company/role, mentorship requests and decisions, accepted mentorship conversations, reviewed career resources and opportunity recommendations, and event volunteering.
- User-scoped notification center with read/unread state. Optional Resend email notifications use a branded HTML layout.
- Authenticated Cloudinary-backed private resume and image storage with file type, signature, and size checks.
- Role and ownership checks, request validation, rate limiting, hashed JWT logout revocation, Prisma persistence, Swagger UI at `/api-docs`, and OpenAPI JSON at `/api-docs.json`.

Integrations require valid credentials and a reachable database; code presence alone does not verify live delivery or storage.

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

Set `DATABASE_URL` in `.env` to a PostgreSQL database you control, create the database, then run:

```powershell
npm run db:deploy
npm run db:generate
npm run db:seed
npm run dev
```

For a standard local PostgreSQL installation, the URL has this format:

```text
postgresql://USERNAME:PASSWORD@localhost:5432/campusconnect?schema=public
```

For local development when creating a new migration, use `npm run db:migrate`. For a database that already has migrations, apply updates with `npm run db:deploy` and regenerate Prisma Client with `npm run db:generate` before starting the API.

The Vite client runs at `http://localhost:5173`; the API runs at `http://localhost:5000`. The server and Prisma scripts load the root `.env`. Set the database port in `DATABASE_URL` to match your PostgreSQL service.

`db:seed` creates fictional development accounts, a sample verified company, two openings, and a sample student application. It refuses to run unless `NODE_ENV=development`.

| Role | Email | Local demo password |
| --- | --- | --- |
| Student | `student@campusconnect.example` | `CampusConnectDemo2026!` |
| Recruiter | `recruiter@campusconnect.example` | `CampusConnectDemo2026!` |
| Placement Officer | `officer@campusconnect.example` | `CampusConnectDemo2026!` |
| Alumni | `alumni@campusconnect.example` | `CampusConnectDemo2026!` |

These are fictional local-only accounts. Do not use the demo password or seed records in production.

Alumni can use `/alumni/dashboard`. Alumni resources, job recommendations, and event volunteer requests remain pending until a Placement Officer reviews them. Approved career guidance and opportunities appear on `/career-resources`.

## Environment variables

| Variable | Purpose |
| --- | --- |
| `DATABASE_URL` | PostgreSQL connection string |
| `JWT_SECRET` | Secret used to sign access tokens; use a strong production value of at least 32 characters |
| `JWT_EXPIRES_IN` | Access-token lifetime (default `7d`) |
| `PORT` | API port (default `5000`) |
| `CLIENT_URL` | Allowed browser origin for API CORS |
| `VITE_API_URL` | Client API base URL, including `/api/v1` |
| `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET` | Server-only credentials for authenticated resume and image uploads |
| `RESEND_API_KEY`, `RESEND_FROM_EMAIL` | Optional email sender; use a verified sender address |
| `NODE_ENV` | Runtime mode |

Never commit `.env` or place production credentials in client environment variables.

## API overview

All endpoints use the `/api/v1` prefix. Authenticated requests use `Authorization: Bearer <token>`.

| Method | Endpoint | Access |
| --- | --- | --- |
| `GET` | `/health` | Public |
| `POST` | `/auth/register`, `/auth/login` | Public |
| `POST` | `/auth/refresh`, `/auth/logout` | Authenticated; logout revokes the current token |
| `GET` | `/auth/me` | Authenticated |
| `GET` | `/jobs` | Public search/pagination; personalized matching filters require a student |
| `GET` | `/jobs/:jobId` | Public |
| `POST`, `PATCH`, `DELETE` | `/jobs`, `/jobs/:jobId` | Approved recruiter for own company or Placement Officer |
| `GET` | `/jobs/mine` | Approved recruiter |
| `POST` | `/jobs/:jobId/applications` | Student |
| `GET` | `/applications/my` | Student; own applications and timeline |
| `POST` | `/applications/:applicationId/withdraw` | Owning student |
| `GET` | `/jobs/:jobId/applications` | Owning recruiter or Placement Officer |
| `PATCH` | `/applications/:applicationId/status` | Owning recruiter or Placement Officer |
| `DELETE` | `/applications/:applicationId/interview` | Owning recruiter or Placement Officer |
| `GET` | `/companies` | Public, verified companies |
| `POST` | `/companies` | Approved recruiter |
| `GET`, `PATCH` | `/companies/mine` | Approved recruiter; connected company only |
| `GET`, `PATCH` | `/students/me` | Student |
| `POST`, `GET` | `/students/me/resume` | Student; PDF upload and private download |
| `POST`, `GET` | `/students/me/profile-image` | Student; profile image upload and private URL |
| `GET` | `/students/:studentId/resume` | Recruiter for a company the student applied to, or Placement Officer |
| `GET` | `/alumni`, `/alumni/:alumniId` | Public-safe profile fields |
| `GET`, `PATCH` | `/alumni/me` | Alumni |
| `POST`, `GET`, `PATCH` | `/mentorship-requests` | Student/alumni; scoped to authorized participants |
| `GET`, `POST` | `/mentorship-requests/:requestId/messages` | Student/alumni participating in an accepted mentorship |
| `GET`, `POST` | `/career-resources`, `/opportunity-recommendations` | Public approved listings; alumni submissions |
| `POST` | `/placement-drives/:driveId/volunteer` | Alumni |
| `GET` | `/admin/alumni/review` | Placement Officer |
| `PATCH` | `/admin/alumni/:alumniId/verify` and alumni resource/opportunity/volunteer review routes | Placement Officer |
| `GET` | `/notifications` | Authenticated user; own notifications |
| `PATCH` | `/notifications/:notificationId/read` | Owner of the notification |
| `GET` | `/announcements` | Public, published announcements |
| `GET` | `/announcements/manage` | Placement Officer; published and unpublished items |
| `POST`, `PATCH`, `DELETE` | `/announcements` and `/announcements/:announcementId` | Placement Officer |
| `GET` | `/placement-drives` | Public upcoming drives |
| `GET` | `/placement-drives/manage` | Placement Officer |
| `POST`, `PATCH`, `DELETE` | `/placement-drives` and `/placement-drives/:driveId` | Placement Officer |
| `GET` | `/analytics/overview`, `/analytics/placements`, `/analytics/export.csv` | Placement Officer |
| `GET` | `/admin/students`, `/admin/recruiters/pending` | Placement Officer |
| `PATCH` | `/admin/recruiters/:recruiterId/approval` | Placement Officer |
| `GET` | `/api-docs`, `/api-docs.json` | Swagger UI and OpenAPI specification |

## Cloudinary uploads

Set `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, and `CLOUDINARY_API_SECRET` on the server only. Resume and profile-image uploads are sent through the server, limited to 5 MB, checked for extension, MIME type, and file signature, and stored with authenticated access. Short-lived resume URLs are limited to the student and authorized recruiters/Placement Officers. Uploads require valid credentials.

## Resend email

Set `RESEND_API_KEY` and a verified `RESEND_FROM_EMAIL` on the server. Email delivery is optional. Provider credentials and actual delivery must be verified in the Resend account; they must never be exposed to the client.

## Render deployment

The included `render.yaml` defines an API web service and a static React client. Create a managed PostgreSQL database and configure `DATABASE_URL` on the API service. Set `CLIENT_URL` to the deployed static client origin. Set `VITE_API_URL` on the client service to the API URL ending in `/api/v1` (for example, `https://your-api.onrender.com/api/v1`). The client API URL is embedded at build time. The API pre-deploy command applies committed Prisma migrations; deployment requires a reachable database. Configure Cloudinary and Resend values on the API service if those integrations are needed.

Keep JWT, database, Cloudinary, and Resend credentials in deployment secret settings, never in source control.

## Tests and build

From the project root:

```powershell
npm test
npm run build
npm run test --workspace client -- --pool=forks --maxWorkers=1 --no-file-parallelism --testTimeout=15000 --hookTimeout=30000
```

## Operational notes

- Application status transitions from before timeline tracking was introduced cannot be reconstructed from current application records; the interface identifies those records as having unavailable earlier history.
- Logout revokes the current access token, but bearer tokens are stored in `sessionStorage` and remain accessible to JavaScript. An HttpOnly refresh-token/session migration is a separate security improvement.
- The database migrations, Cloudinary uploads, Resend delivery, and production hosting must be verified with the target services and credentials before claiming a live deployment is operational.
