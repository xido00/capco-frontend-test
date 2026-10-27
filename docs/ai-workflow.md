# AI-assisted workflow

This project was built with Claude Code as a pair programmer. This log records how the work was split, which suggestions were accepted or changed, and how AI output was verified.

## Working agreement

- I own decisions: architecture, UX, scope and what gets committed. The agent proposes options with trade-offs and a recommendation.
- Each ticket starts with a plan that I review before implementation.
- I review every diff before it is committed. Quality checks run locally before every commit and in CI on every push.
- Repository rules for the agent live in [`CLAUDE.md`](../CLAUDE.md).

## Log

### CI and quality gate

- **Request:** I proposed adding Node and JDK Docker images so tests could run in CI.
- **AI suggestion:** keep CI and drop the custom images. GitHub Actions `setup-node` and `setup-java` give the same toolchain with caching and less to maintain, while local development stays as documented in the README.
- **Decision:** CI on GitHub Actions without Docker. Local toolchain via asdf (already in use), kept out of the repository: `.tool-versions` is excluded locally, not committed.
- **Found while verifying:**
  - Root `test`, `typecheck` and `build` scripts only covered `DS/`, so frontend tests and typecheck never ran in `npm run quality`.
  - `npm run lint` already failed on `main` (`set-state-in-effect` in the reviewer list). Fixed in a separate commit.
- **Verification:** `npm run quality` and the Playwright e2e suite passed locally on Node 26.12.1 and Temurin 25.0.5 before pushing.
- **AI mistake caught:** the agent assumed the repository had no remote without checking. Corrected before pushing; pushes go to `origin` (GitHub) only, never to `upstream`.

### API client (PR #3)

- **AI first draft:** a hand-written `fetch` wrapper with zod schemas for requests and responses.
- **My review comment:** the backend publishes an OpenAPI contract, so types should come from it. I asked for `openapi-fetch` and to keep only error mapping on our side.
- **Result:** types are generated with `openapi-typescript`, and CI fails if they drift from `openapi.json`. Only `unwrap()` and the `ApiError` failure kinds are hand-written.
- **Trade-off I accepted:** success bodies are no longer validated at runtime. Compile-time types cover the contract, and e2e tests cover the real API.
- **Bug found while switching:** `openapi-fetch` captures `fetch` at import time, before MSW installs, so the first test run hit my running dev server and created a real account in the local database. Fixed by resolving `fetch` per call. Lesson: an unexpected status in every test (all `409`) meant real network traffic, not a mapping bug.

### Registration (TICKET-001)

- **Decisions I made:** TanStack Query for mutations, so TICKET-003 uses the same model; validation on submit, then live inline updates; GOV.UK error summary pattern.
- **AI found in existing code:** the DS `TextField` showed a hint or an error, never both, so the password rules disappeared exactly when needed. Native `required` also bypassed the app's messages. Both fixed in DS.
- **AI mistakes caught by checks:**
  - axe and ARIA 1.2 rules: an accessible name on the error summary container is prohibited without a role. Removed.
  - zod object-level `refine` skips when any field fails, which would hide "Passwords do not match". Rewritten to validate fields independently, with a test.
  - Two failing tests were test bugs, not form bugs: email inputs strip whitespace by spec, and React Aria's live announcer leaves nodes in `<body>` between tests, so axe now scans the form container.
- **Verification:** unit tests for validation and every API outcome (MSW), axe checks, and an e2e test that registers twice against the real backend.

### Sign-in (TICKET-002)

- **AI proposal I accepted:** after sign-in, always continue at the journey URL from the API, not `returnTo`. The API knows the Applicant's current step, which also covers returning after an expired session in TICKET-003. The URL is still checked as a local journey path.
- **Refactor before the second form:** registration and sign-in share error handling, so it moved into `useFormFeedback` first, in its own commit, with registration tests unchanged.
- **Verification:** unit tests for every API outcome and the pending state, axe checks, and e2e tests that check the stored session cookies and the invalid-credentials path against the real backend.
