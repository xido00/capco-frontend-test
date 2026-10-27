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
