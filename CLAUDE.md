# CLAUDE.md

Guidance for AI coding agents working in this repository. Read `README.md` and the relevant ticket in `tickets/` before changing code.

## Scope

- Frontend only. Never modify `backend/` or `frontend/public/openapi.json`; treat the OpenAPI document as the source of truth for requests, responses and error codes.
- Reusable UI belongs in `DS/` (React Aria based, with a Storybook story and test). Application screens, routes and API calls belong in `frontend/`.
- `DS/` must not import from `frontend/` (enforced by dependency-cruiser).
- Use the README glossary for names: Applicant, Application, Reviewer, Journey, Step, Presentation, Fixture.

## Architecture conventions

- Route modules (`frontend/src/routes/*.tsx`) handle navigation, data loading and page behavior; presentation components render UI and receive data and callbacks through props.
- Route-private modules use the `-` filename prefix (for example `-sign-in-form.tsx`).
- API calls use the JSON:API media type (`application/vnd.api+json`) and are validated at the boundary with `zod`. Map every documented error status to a typed error the UI can present.
- Server state goes through TanStack Query; avoid duplicating it in component state.
- Never persist form data or credentials in browser storage; the API is the only persisted state.

## Accessibility (WCAG 2.2 AA)

- Every input has a visible label; errors are linked to their field (`aria-describedby`) and announced once, not duplicated in several live regions.
- After a failed submit, move focus to the error summary or the first invalid field.
- Expose pending state (disabled or `aria-busy` submit) and prevent duplicate submissions.
- Keep layouts usable at 320px width and with keyboard only.

## Verification

Run before proposing a commit:

```sh
npm run quality                         # lint, typecheck, dependency rules, unit tests, build (DS + frontend)
npm run test:e2e --workspace frontend   # Playwright against the real API (needs JAVA_HOME for JDK 25)
```

- New behavior comes with tests: Vitest + Testing Library + MSW for API states (success and each documented error), `jest-axe` for accessibility.
- Do not weaken checks to get green: no `eslint-disable`, `@ts-ignore`, skipped tests or removed assertions without an explicit reason in the commit message.

## Workflow

- One branch and pull request per ticket or foundation change; small, separate commits using Conventional Commits.
- Propose a plan and wait for approval before implementing a ticket. The developer reviews every diff before it is committed.
- Record significant decisions in `docs/decisions/` and notable AI-assisted moments in `docs/ai-workflow.md`.
