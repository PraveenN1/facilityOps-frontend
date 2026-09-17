# FacilityOps AI Frontend

React operations dashboard for the FacilityOps AI backend.

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

Generate API types from the exported backend OpenAPI contract:

```powershell
npm run generate:api
```

Run the frontend:

```powershell
npm run dev
```

The frontend runs at `http://localhost:5173`.

The backend is expected at `http://localhost:8000`. Vite proxies `/api` to the backend.

## Development Identity

This app uses the backend's development-only identity headers:

- `X-Dev-User-Id`
- `X-Dev-Role`
- `X-Dev-Building-Id`

These headers are not production authentication. Do not expose this app publicly while they are enabled.

The local-demo identity switcher provides presets for the synthetic identities seeded by the backend local demo command:

```text
building_id: 10000000-0000-0000-0000-000000000001
manager_user_id: 10000000-0000-0000-0000-000000000010
reporter_user_id: 10000000-0000-0000-0000-000000000011
technician_user_id: 10000000-0000-0000-0000-000000000012
technician_id: 10000000-0000-0000-0000-000000000020
```

Run the backend demo seed before using the presets:

```powershell
cd D:\Praveen\Development\facilityOps-ai
$env:APP_ENV = "local"
$env:DATABASE_URL = "postgresql+psycopg://facilityops:facilityops_dev_password@localhost:5432/facilityops"
python -m facilityops_ai.demo.seed
```

The identity switcher is rendered only in local development builds. These IDs are not credentials and are not production authentication.

## Implemented Screens

- Incident dashboard with pagination, status filtering, AI triage status, and incident detail navigation.
- Complaint creation with stable idempotency key per retryable submission.
- AI triage review with original complaint, recommendation, pending/completed/failed states, and manager confirmation.
- Technician assignment with skills, availability, technician profile/user identity distinction, expected version, and HTTP 409 conflict display.
- Incident lifecycle actions for start, resolve, and close with state refetching and local-demo assigned-technician identity switching.

## Backend API Contracts Used

- `POST /api/v1/complaints`
- `GET /api/v1/incidents`
- `GET /api/v1/incidents/{incident_id}`
- `POST /api/v1/incidents/{incident_id}/manual-triage`
- `POST /api/v1/incidents/{incident_id}/assign`
- `POST /api/v1/incidents/{incident_id}/start`
- `POST /api/v1/incidents/{incident_id}/resolve`
- `POST /api/v1/incidents/{incident_id}/close`
- `GET /api/v1/technicians`

API types are generated from `openapi/facilityops-openapi.json` into `src/api/generated.ts`.

## Verification

```powershell
npm run typecheck
npm test
npm run build
npm run smoke:backend
```

The backend smoke check requires the backend to be running on `http://localhost:8000`.

## Known Backend Limitations

- No production authentication contract exists yet.
- No building or user listing endpoint exists; local-demo identities come from the documented seeded demo IDs.
- No endpoint exists to trigger or inspect the AI worker directly; AI state is visible through incident responses only.

## Task 012A.2 Contract Synchronization

The frontend now consumes the Task 012A backend fields generated from OpenAPI:

- `TechnicianListItem.user_id` is used for local-demo technician lifecycle identity switching.
- `IncidentDetailResponse.active_assignment` is displayed in incident details when active, and rendered as an explicit empty state when null.

After assignment, use the incident detail page's local-demo button to switch to the assigned technician's backend `user_id` before starting or resolving work. Switch back to the facility manager preset before closing a resolved incident.
