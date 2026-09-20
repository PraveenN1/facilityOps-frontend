# FacilityOps Frontend Progress

## Current Status

Task 012C-MANAGER final manager workflow correctness and UX fixes are implemented and verified with generated API types, TypeScript checking, unit/component tests, production build, and diff check. Full browser visual verification was not performed in this pass.

## Completed

- Task 012C-UI corrected manager-console metric tiles so labels and values render as separate elements instead of visually joining.
- Reworked the incident queue presentation without changing the API contract: compact status filtering, server-side building/status pagination, stable short incident references, long complaint summaries, separate workflow and AI state columns, and building names when available from authenticated building context.
- Removed routine profile, user, and building UUIDs from primary manager screens while preserving full IDs in API calls and route targets.
- Reworked incident detail into state-driven panels: original complaint, AI assessment, human-confirmed decision, and exactly one current workflow action area.
- Kept AI assessment advisory and separate from human approval; no confidence score, reviewer identity, or reviewer timestamp is fabricated.
- Added safety presentation from backend-visible signals only. The frontend does not implement hazard clearance logic and continues to rely on backend authorization and safety restrictions.
- Limited technician dispatch UI to `AWAITING_ASSIGNMENT`; candidates are grouped into available qualified, unavailable, and not qualified where the contract supports it.
- Assignment conflicts now clear the selected technician, refetch incident and technician data, and require the manager to choose again before retrying.
- Building context now falls back to authenticated `/auth/me` building memberships while `/buildings` is loading, preventing stale anonymous building labels during scoped fetches.
- Task 012C-D corrected the AI assessment panel so a `PROCESSED` outbox status without a persisted `latest_triage_result.validated_result` shows an accurate empty state instead of a blank advisory recommendation.
- Persisted validated AI recommendations continue to render from `latest_triage_result.validated_result`; the UI does not fabricate AI output or confidence.
- Task 012C-T reworked the technician workspace into state-driven work-order cards without changing backend lifecycle or RBAC rules.
- `ASSIGNED` work orders now show Start work as the sole primary action; resolution notes and Resolve work are not rendered.
- `IN_PROGRESS` work orders hide Start work and show resolution notes plus Resolve work as the sole primary action.
- Successful resolution now shows a server-confirmed local success message, explains that the job leaves the active queue, invalidates/refetches technician work, incident, incident list, and metrics caches, and preserves the confirmation above the empty state.
- Failed resolution does not show success. HTTP 409 conflicts show a review message and refetch the active queue without automatically retrying.
- Technician work cards now use the complaint summary as the headline, short incident references, authenticated building display names, category, priority, status, and created time without exposing routine UUIDs as primary labels.
- Technician work cards use mobile-first single-column spacing, full-width primary actions, larger resolution textareas, and constrained desktop width.
- Confirmed backend Task 012P.5A final verification recorded a full PostgreSQL suite result of 159 passed, 1 skipped, and 1 warning.
- Confirmed the local backend on `http://localhost:8000` responds to `/ready` and exposes the latest OpenAPI contract.
- Exported the running backend OpenAPI contract to `openapi/facilityops-openapi.json`.
- Regenerated TypeScript API types with `openapi-typescript`.
- Verified the generated contract includes optional `building_id` filters on `GET /api/v1/incidents` and `GET /api/v1/technicians`.
- Wired selected building scope into incident listing, technician listing, operations metrics, and AI metrics requests.
- Included selected building IDs in TanStack Query keys for scoped data.
- Added query cancellation/invalidation when the building selection changes.
- Reset incident pagination when the selected building changes.
- Preserved backend cookie authentication, `/auth/me` session restoration, logout, CSRF headers for mutations, and role-based route behavior.
- Preserved the distinction between `technician.id` and `technician.user_id` for assignment and technician lifecycle handoff.
- Preserved active assignment display and null active-assignment handling in incident details.
- Added regression coverage for generated building filter contracts, API client building parameters, dashboard building-scoped incident listing, and technician building-scoped listing.
- UI refinement pass added a polished SaaS-style login screen with clearer hierarchy, show/hide password control, safer demo wording, and theme access before authentication.
- Added persisted light/dark theme support using `facilityops.theme`, system preference on first load, `data-theme` on the document root, and a theme toggle in the authenticated shell.
- Refined shared visual primitives for dark theme support: panels, form fields, buttons, status badges, async states, notes, login surfaces, request cards, and focus states.
- Reporter navigation and screens now use reporter-facing request language: "My requests", "New request", maintenance request copy, plain-language status labels, and next-step messaging.
- Reporter request creation no longer exposes idempotency keys, outbox wording, or primary incident internals in the UI; retry safety remains internal to the API client.
- Incident detail now renders a reporter-specific request tracking view for reporters, while preserving manager and technician workflow panels for their roles.
- Fixed contradictory AI/manual status copy: AI processing is presented separately from manager-confirmed manual triage, and the UI no longer says manual review is missing after triage is confirmed.
- Preserved recent technician workspace behavior while aligning shared styles with the refined light/dark design system.
- Task 012C-VISUAL replaced the previous two-column login treatment with a centered single-column card and removed visible technical badges for cookie session, CSRF protection, and role routing.
- Added `lucide-react` and applied restrained icons to sidebar navigation, metric headings, request actions, technician actions, AI/human review headings, theme toggle, logout, empty states, loading states, and success feedback.
- Added a compact reporter request progress indicator derived only from the current incident status. It does not claim timestamps, ETAs, or a full history.
- Refined status badge categories for workflow, AI processing, technician availability, success, and error states while keeping AI advisory state visually distinct from human approval.
- Task 012C-QUEUE upgraded the shared incident queue used by the manager overview and incident dashboard into compact, full-row navigable work items without changing backend contracts.
- Incident rows now show complaint summary as the primary text, short incident reference, building name from authenticated building context, category, priority, created timestamp, workflow status, AI status, and a navigation indicator.
- Queue rows use semantic list markup with a single keyboard-accessible link per incident and avoid nesting interactive controls inside the row.
- The status toolbar remains server-backed and compact, preserves API totals, and does not add fake client-side search or approximate quick filters.
- Workflow indicators map approved incident states to readable labels with restrained Lucide icons. AI status remains independent from workflow state; `PROCESSED` without a persisted validated result is shown as processed without a recommendation.
- Queue styling preserves the operations-console light/dark palette, uses stable grid columns on desktop, and stacks summary/status content on narrower screens without exposing routine UUIDs as primary labels.
- Task 012C-MANAGER aligned frontend technician grouping with backend canonical category-to-skill matching so a `Plumbing` incident category matches a technician skill of `PLUMBING`.
- Manager overview now labels the embedded section as `Incident queue` and removes developer-facing copy about server pagination and global metric calculation.
- Manager incident detail hides routine assignment IDs, shows compact no-assignment states for pending/pre-dispatch incidents, and avoids implying that no historical assignment existed after resolution or closure.
- Safety presentation now uses backend-visible AI assessment hazard/escalation signals only. The frontend no longer classifies danger from complaint keywords and still does not clear hazards client-side.
- AI advisory information and human-confirmed triage remain visually separate, and the AI model name is displayed only when the backend provides it.

## API Contract Notes

- Authenticated identity comes from backend-owned session cookies and `/api/v1/auth/me`.
- The frontend stores only the CSRF token returned by login.
- `TechnicianListItem.user_id` is displayed separately from `TechnicianListItem.id`.
- `IncidentDetailResponse.active_assignment` is displayed when present; `null` is treated only as no current active assignment.
- Incident listing, technician listing, operations metrics, and AI metrics support optional `building_id`.
- When `building_id` is omitted, the backend uses all buildings authorized for the authenticated manager.

## Verification Log

- Task 012C-UI focused tests passed: `npx vitest run src/pages/IncidentDashboardPage.test.tsx src/pages/IncidentDetailPage.test.tsx` reported 2 test files and 15 tests passed.
- `npm run generate:api` passed and regenerated `src/api/generated.ts` from `openapi/facilityops-openapi.json`.
- `npm run typecheck` passed.
- `npm test` initially failed one dashboard assertion because the test read the AI status during an intermediate building-selection loading state; the test was tightened to wait for the complete rendered row.
- `npm test` passed after the Task 012C-UI fixes: 6 test files and 25 tests passed. React Router emitted future-flag warnings from the test environment.
- `npm run build` initially caught a stricter TypeScript narrowing issue in technician skill matching; the helper was corrected and the build passed.
- `npm run smoke:backend` passed: `Backend health check passed.`
- Live auth/proxy check through `http://localhost:5173/api` passed without logging cookies or tokens: login returned 200, `/api/v1/auth/me` returned 200 with role `FACILITY_MANAGER`, logout returned 204, and `/api/v1/auth/me` returned 401 after logout.
- `git diff --check` passed with Git LF-to-CRLF conversion warnings only.
- Browser automation check for Task 012C-UI: `cua.getState()` returned no apps and no browsers. Browser-level workflow success was not claimed.
- Task 012C-D focused AI assessment tests passed: `npx vitest run src/pages/IncidentDetailPage.test.tsx` reported 1 test file and 14 tests passed.
- `npm run typecheck` passed for Task 012C-D.
- `npm test` passed for Task 012C-D: 6 test files and 27 tests passed. React Router emitted future-flag warnings from the test environment.
- `npm run build` passed for Task 012C-D.
- `git diff --check` passed for Task 012C-D frontend changes with Git LF-to-CRLF conversion warnings only.
- Task 012C-T focused technician workspace tests passed: `npx vitest run src/pages/TechnicianWorkspacePage.test.tsx` reported 1 test file and 8 tests passed.
- `npm run generate:api` passed for Task 012C-T.
- `npm run typecheck` passed for Task 012C-T.
- `npm test` passed for Task 012C-T: 7 test files and 35 tests passed. React Router emitted future-flag warnings from the test environment.
- `npm run build` passed for Task 012C-T.
- `npm run smoke:backend` passed for Task 012C-T: `Backend health check passed.`
- Live backend technician spot-check passed: technician login returned HTTP 200, `GET /api/v1/incidents/my-work` returned HTTP 200, and the response contained 1 active item.
- UI refinement `npm run generate:api` passed: `openapi/facilityops-openapi.json` regenerated `src/api/generated.ts`.
- UI refinement `npm run typecheck` passed.
- UI refinement focused tests initially caught reporter async timing and a duplicate reporter status label assertion; tests were corrected to wait for loaded data and assert intentional duplicate status labels.
- UI refinement `npm test` passed: 8 test files and 41 tests passed. React Router future-flag warnings were emitted by the test environment.
- UI refinement `npm run build` passed: TypeScript project build and Vite production build completed successfully.
- UI refinement `git diff --check` passed with Git LF-to-CRLF conversion warnings only.
- Task 012C-VISUAL `npm install lucide-react` completed and added one dependency. npm reported 7 audit findings after install: 5 moderate, 1 high, and 1 critical. No broad dependency upgrades were made in this visual-only task.
- Task 012C-VISUAL `npm run generate:api` passed.
- Task 012C-VISUAL `npm run typecheck` passed.
- Task 012C-VISUAL `npm test` passed: 8 test files and 42 tests passed. React Router future-flag warnings were emitted by the test environment.
- Task 012C-VISUAL `npm run build` passed.
- Task 012C-QUEUE focused regression tests passed: `npx vitest run src/pages/IncidentDashboardPage.test.tsx` reported 1 test file and 9 tests passed. React Router future-flag warnings were emitted by the test environment.
- Task 012C-QUEUE `npm run generate:api` passed and regenerated `src/api/generated.ts` from `openapi/facilityops-openapi.json`.
- Task 012C-QUEUE `npm run typecheck` passed.
- Task 012C-QUEUE full `npm test` initially failed 1 dashboard assertion during parallel execution because multiple test files mock process-global `fetch`; focused dashboard tests passed. Vitest file parallelism was disabled in test configuration to match the suite's shared mock pattern.
- Task 012C-QUEUE full `npm test` passed after the test isolation fix: 8 test files and 48 tests passed. React Router future-flag warnings were emitted by the test environment.
- Task 012C-QUEUE `npm run build` passed: TypeScript project build and Vite production build completed successfully.
- Task 012C-QUEUE `git diff --check` passed with Git LF-to-CRLF conversion warnings only.
- Task 012C-MANAGER focused frontend tests passed: `npx vitest run src/pages/IncidentDetailPage.test.tsx src/pages/ManagerWorkspacePage.test.tsx` reported 2 test files and 27 tests passed. React Router future-flag warnings were emitted by the test environment.
- Task 012C-MANAGER `npm run generate:api` passed and regenerated `src/api/generated.ts` from `openapi/facilityops-openapi.json`.
- Task 012C-MANAGER `npm run typecheck` passed.
- Task 012C-MANAGER `npm test` passed: 8 test files and 57 tests passed. React Router future-flag warnings were emitted by the test environment.
- Task 012C-MANAGER `npm run build` passed: TypeScript project build and Vite production build completed successfully.
- Task 012C-MANAGER frontend `git diff --check` passed with Git LF-to-CRLF conversion warnings only.

## Remaining

- Full browser-level workflow verification still requires an available browser automation surface.
- Real Groq triage behavior depends on the backend worker and configured Groq credentials. Task 012C-D backend verification confirmed one isolated demo triage event was processed successfully with the real Groq provider.
- SLA risk, latency trend, AI accuracy, assignment history, and resolution history are not available from the current backend contract.
- Durable backend hazard-clearance state and complete assignment/resolution history remain unavailable from the current API contract.
- Production authentication hardening such as SSO/OAuth remains outside the current backend contract.
