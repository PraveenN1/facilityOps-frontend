# FacilityOps Frontend Progress

## Current Status

Task 012P.4 operations console redesign has been implemented in the frontend repository against the current backend OpenAPI contract.

## Completed

- Read frontend engineering instructions, README, progress documentation, and relevant backend README/architecture/decision context.
- Exported the current backend OpenAPI contract to `openapi/facilityops-openapi.json`.
- Regenerated TypeScript API types with `openapi-typescript`.
- Verified the generated contract includes authentication, building discovery, complaint, incident, technician, lifecycle, and metrics APIs used by the console.
- Replaced the old `X-Dev-*` identity header flow with backend cookie login, `/auth/me` session restore, logout, and CSRF headers for state-changing requests.
- Removed obsolete local-demo identity source files.
- Added protected routing and role-based workspaces for facility managers, technicians, and reporters.
- Added building discovery and selection. One authorized building is auto-selected; multiple buildings allow explicit selection or all-authorized scope.
- Implemented manager overview metrics using operations and AI metrics endpoints.
- Updated incident queue with pagination, status filtering, stable navigation, AI triage status, and empty/loading/error states.
- Updated incident detail with active assignment display, AI triage review, manager manual triage, technician assignment, and role-gated lifecycle controls.
- Added technician workspace for active assigned work.
- Added reporter workspace for submitted complaints and complaint creation with stable idempotency key handling.
- Updated the design system to an industrial operations-console style with light/dark theme support, compact radii, neutral statuses, priority edges, and AI violet accents.
- Updated tests for generated contract usage, cookie credentials, CSRF/idempotency behavior, active assignment display, null active assignment display, role navigation, and technician lifecycle identity handling.

## API Contract Notes

- Authenticated identity comes from backend-owned session cookies and `/api/v1/auth/me`.
- The frontend stores only the CSRF token returned by login.
- `TechnicianListItem.user_id` is displayed separately from `TechnicianListItem.id`.
- `IncidentDetailResponse.active_assignment` is displayed when present; `null` is treated only as no current active assignment.
- Metrics support optional `building_id`; incident and technician list contracts do not currently expose a building filter, so those views rely on backend authorization scoping.

## Verification Log

- `npm run generate:api` passed and regenerated `src/api/generated.ts` from `openapi/facilityops-openapi.json`.
- `npm run typecheck` passed after the auth/routing/page updates.
- `npm test` passed: 5 files, 11 tests. React Router emitted future-flag warnings from the test environment.
- `npm run build` passed after correcting the AI recommendation location field to match the generated schema.
- `npm run smoke:backend` passed: `Backend health check passed.`
- Real backend login/session restore passed for `manager.demo@facilityops.local`: login returned a CSRF token and `/api/v1/auth/me` returned role `FACILITY_MANAGER`.
- Real backend discovery/metrics read check against the currently running `localhost:8000` returned 404 for `/api/v1/buildings` and `/api/v1/metrics/operations`; the live process appears older than the OpenAPI contract exported from the backend source tree.
- `git diff --check` passed with Git CRLF conversion warnings only.

## Remaining

- Full browser-level workflow verification has not yet been completed in this task.
- Backend incident and technician list APIs do not expose explicit building filter query parameters.
- SLA risk, latency trend, AI accuracy, assignment history, and resolution history are not available from the current backend contract.
- Production authentication hardening such as SSO/OAuth remains outside the current backend contract.

