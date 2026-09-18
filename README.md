# FacilityOps AI Frontend

React operations console for the FacilityOps AI backend.

The frontend and backend are separate Git repositories:

- Backend: `D:\Praveen\Development\facilityOps-ai`
- Frontend: `D:\Praveen\Development\facilityOps-frontend`

## Stack

- React
- TypeScript
- Vite
- Tailwind CSS
- React Router
- TanStack Query
- OpenAPI-generated API types

## Local Setup

Install dependencies:

```powershell
npm install
```

Export the backend OpenAPI contract from the backend repository when contracts change, then regenerate frontend types:

```powershell
cd D:\Praveen\Development\facilityOps-ai
python -c "import json; from pathlib import Path; from facilityops_ai.main import create_app; Path(r'D:\Praveen\Development\facilityOps-frontend\openapi\facilityops-openapi.json').write_text(json.dumps(create_app().openapi(), indent=2), encoding='utf-8')"

cd D:\Praveen\Development\facilityOps-frontend
npm run generate:api
```

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

The frontend does not read JWTs, store bearer tokens, or send development identity headers.

## Local Demo Accounts

Seed demo data from the backend before signing in locally:

```powershell
cd D:\Praveen\Development\facilityOps-ai
$env:APP_ENV = "local"
$env:DATABASE_URL = "postgresql+psycopg://facilityops:facilityops_dev_password@localhost:5432/facilityops"
python -m facilityops_ai.demo.seed
```

Use the seeded demo users documented by the backend README. The frontend displays role-specific workspaces based on the authenticated user returned by `/api/v1/auth/me`.

## Implemented Screens

- Login, session restore, logout, and protected routes.
- Manager overview with operations and AI metrics.
- Manager incident queue with pagination, status filtering, AI triage status, and incident details navigation.
- Complaint creation with stable idempotency key per retryable submission.
- Reporter complaint list and tracking navigation.
- AI triage review with original complaint, recommendation, pending/completed/failed states, and manager confirmation.
- Technician assignment with skills, availability, technician profile/user identity distinction, expected version, and HTTP 409 conflict display.
- Technician assigned-work workspace with start and resolve actions.
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
- Incident and technician list endpoints are scoped by authenticated backend authorization, but do not currently expose a `building_id` query filter. Building selection is used where the OpenAPI contract supports it, including metrics and complaint creation.
- SLA risk, latency trends, AI accuracy, assignment history, and resolution history are not exposed by the current backend contract, so the frontend does not fabricate them.
- Browser end-to-end verification requires a running backend, PostgreSQL database, seeded demo users, and an available browser automation surface.
