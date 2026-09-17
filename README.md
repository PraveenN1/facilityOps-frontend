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

Because the backend does not provide user/building lookup APIs yet, the local-demo identity switcher accepts UUIDs manually.

## Implemented Screens

- Incident dashboard with pagination, status filtering, AI triage status, and incident detail navigation.
- Complaint creation with stable idempotency key per retryable submission.
- AI triage review with original complaint, recommendation, pending/completed/failed states, and manager confirmation.
- Technician assignment with skills, availability, expected version, and HTTP 409 conflict display.
- Incident lifecycle actions for start, resolve, and close with state refetching.

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
- No building or user listing endpoint exists; local-demo UUIDs must be entered manually.
- Technician listing does not expose `user_id`; technician start/resolve requires manually switching to the assigned technician user ID.
- Incident detail does not expose active assignment or assigned technician.
- No endpoint exists to trigger or inspect the AI worker directly; AI state is visible through incident responses only.
