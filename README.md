# FacilityOps AI Frontend

React operations console for the FacilityOps AI backend.

The frontend and backend are separate Git repositories:

- Backend: https://github.com/PraveenN1/facilityOps-ai
- Frontend: https://github.com/PraveenN1/facilityOps-frontend

## Stack

- React
- TypeScript
- Vite
- Tailwind CSS
- React Router
- TanStack Query
- OpenAPI-generated API types
- Lucide icons

## Local Setup

Install dependencies:

```powershell
npm install
```

Export the backend OpenAPI contract from the backend repository when contracts change, then regenerate frontend types:


Run the frontend:

```powershell
npm run dev
```

The frontend runs at `http://localhost:5173`. The backend is expected at `http://localhost:8000`; Vite proxies `/api` to the backend.

## Authentication

The operations console uses the backend authentication contract:

- `POST /api/v1/auth/login` with email and password.
- `GET /api/v1/auth/me` to restore a session.
- `POST /api/v1/auth/logout` to clear the backend session.
- State-changing requests send `X-CSRF-Token` using the CSRF token returned by login.
- Browser requests use `credentials: "include"` so the backend-owned HttpOnly auth cookie is sent.


## Local Demo Accounts

Seed demo data from the backend before signing in locally:

```powershell
cd your-working-directory\facilityOps-ai
$env:APP_ENV = "local"
$env:DATABASE_URL = "postgresql+psycopg://facilityops:facilityops_dev_password@localhost:5432/facilityops"
python -m facilityops_ai.demo.seed
```

Use the seeded demo users documented by the backend README. The frontend displays role-specific workspaces based on the authenticated user returned by `/api/v1/auth/me`.

## Implemented Screens

- Single-column polished login, session restore, logout, protected routes, and persisted light/dark theme selection.
- Manager overview with operations and AI metrics.
- Manager incident queue with server-side building selection, pagination, status filtering, public ticket references, AI triage status, and incident details navigation.
- Maintenance request creation with stable idempotency key per retryable submission kept internal to the API client.
- Reporter request list and reporter-specific progress tracking navigation using backend-provided public ticket references.
- AI triage review with original complaint, recommendation, pending/completed/failed states, and manager confirmation.
- Technician assignment with skills, availability, technician profile/user identity distinction, expected version, and HTTP 409 conflict display.
- Technician assigned-work workspace with public ticket references, start, and resolve actions.
- Incident lifecycle actions with state refetching after mutations.

## Backend API Contracts Used

- `POST /api/v1/auth/login`
- `POST /api/v1/auth/logout`
- `GET /api/v1/auth/me`
- `GET /api/v1/buildings`
- `POST /api/v1/complaints`
- `GET /api/v1/complaints`
- `GET /api/v1/incidents`
- `GET /api/v1/incidents/my-work`
- `GET /api/v1/incidents/{incident_id}`
- `POST /api/v1/incidents/{incident_id}/manual-triage`
- `POST /api/v1/incidents/{incident_id}/assign`
- `POST /api/v1/incidents/{incident_id}/start`
- `POST /api/v1/incidents/{incident_id}/resolve`
- `POST /api/v1/incidents/{incident_id}/close`
- `GET /api/v1/technicians`
- `GET /api/v1/metrics/operations`
- `GET /api/v1/metrics/ai`

API types are generated from `openapi/facilityops-openapi.json` into `src/api/generated.ts`.
Backend Task 014 contracts expose `public_ticket_id` across complaint, incident, and technician work responses; `display_name`/`reporter_display_name` for human-readable identities; and terminal AI states such as `SKIPPED_OBSOLETE` and `PROCESSED_NO_RESULT`. The frontend displays those values but continues to use internal UUIDs for routes, mutations, and cache keys.
`GET /api/v1/incidents`, `GET /api/v1/technicians`, `GET /api/v1/metrics/operations`, and `GET /api/v1/metrics/ai` accept optional `building_id` filters. When no building is selected, the backend returns data for the authenticated manager's authorized buildings.

## Verification

```powershell
npm run generate:api
npm run typecheck
npm test
npm run build
npm run smoke:backend
```

The backend smoke check requires the backend to be running on `http://localhost:8000`.

## Known Backend Limitations

- The backend does not provide production SSO/OAuth; this frontend uses the current backend cookie login contract.
- SLA risk, latency trends, AI accuracy, assignment history, and resolution history are not exposed by the current backend contract, so the frontend does not fabricate them.
- Browser end-to-end verification requires a running backend, PostgreSQL database, seeded demo users, and an available browser automation surface.
