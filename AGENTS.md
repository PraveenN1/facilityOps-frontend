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
- Use development-only identity headers:
  - `X-Dev-User-Id`
  - `X-Dev-Role`
  - `X-Dev-Building-Id`
- Never describe these headers as production authentication.
- Do not expose this frontend publicly while development identity headers are enabled.

## Code Quality

- Keep API access centralized.
- Prefer generated OpenAPI types over hand-written backend schema copies.
- Use accessible forms and explicit loading, empty, and error states.
- Keep dependencies minimal.
- Run type checking, tests, and production build before completion.
