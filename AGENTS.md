# FacilityOps Frontend Engineering Instructions

## Scope

- This repository is the React frontend for FacilityOps AI.
- The backend repository is separate at `D:\Praveen\Development\facilityOps-ai`.
- Do not modify backend files from this repository.
- Use the backend OpenAPI contract as the source for API types.

## Stack

- React
- TypeScript
- Vite
- Tailwind CSS
- React Router
- TanStack Query

## API and Auth

- Backend base path is proxied through `/api` during local development.
- The Vite dev server runs at `http://localhost:5173`.
- The backend runs at `http://localhost:8000`.
- Authentication is backend-owned cookie authentication.
- `POST /api/v1/auth/login` returns the authenticated user and CSRF token while the backend sets HttpOnly auth cookies.
- The frontend stores only the CSRF token needed for state-changing requests and sends it as `X-CSRF-Token`.
- Do not read JWTs in the browser, store access tokens in localStorage/sessionStorage, or send `Authorization` headers unless the backend contract changes.
- Do not use the retired `X-Dev-*` identity headers.
- Do not expose local development authentication or seeded demo credentials publicly.

## Code Quality

- Keep API access centralized.
- Prefer generated OpenAPI types over hand-written backend schema copies.
- Do not manually edit `src/api/generated.ts`; regenerate it with `npm run generate:api`.
- Use accessible forms and explicit loading, empty, and error states.
- Keep dependencies minimal.
- Run type checking, tests, and production build before completion.
