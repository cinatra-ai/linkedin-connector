# Testing Patterns

**Analysis Date:** 2026-06-09

## Test Framework

**Runner:** Not applicable — no test files or test runner configuration detected in this repository.

**Assertion Library:** Not applicable.

**Run Commands:**
```bash
# No test scripts defined in package.json
# CI runs: corepack pnpm test --if-present (exits 0 if no test script)
```

## Source Mirror Architecture

This repository is a **source mirror** — an extracted connector package that declares `@cinatra-ai/sdk-extensions` and `@cinatra-ai/sdk-ui` as optional peer dependencies. These peers exist only in the cinatra monorepo and cannot be resolved in a standalone install.

As documented in `.github/workflows/ci.yml`, the CI pipeline explicitly skips standalone install, typecheck, and test when host-internal `@cinatra-ai/*` peers are detected:

```
Source mirror: declares host-internal @cinatra-ai/* optional peers —
the cinatra monorepo provides/builds/typechecks/tests these.
Skipping standalone install + typecheck + test.
```

This means **all testing runs in the cinatra monorepo**, not in this repository.

## Test File Organization

**Location:** No test files (`*.test.*` or `*.spec.*`) exist under `src/` or anywhere in the repo.

**Expected location (when tests are written in the monorepo):**
- Co-located with the source file they test, or in a `__tests__/` subdirectory within the monorepo workspace for this connector

## CI Gate (what runs here)

The CI pipeline (`.github/workflows/ci.yml`) runs these checks on every push/PR to `main`:

1. **Dependency shape validation** — enforces that no `@cinatra-ai/*` packages appear in `dependencies`, `devDependencies`, or `optionalDependencies`. First-party packages must be optional `peerDependencies` with `peerDependenciesMeta.optional: true`.

2. **`npm pack --dry-run`** — validates package shape and publish payload without resolving peers. This is the primary structural gate for this repo.

3. **No kind-specific gate** — the `kind-gates` job runs but emits "No kind-specific gate for this extension kind" (connector kind has no extra gate today).

The **release pipeline** (`.github/workflows/release.yml`) delegates entirely to `cinatra-ai/.github/.github/workflows/reusable-extension-release.yml@main` via GitHub Actions reusable workflows.

## Mocking

**Framework:** Not applicable — no tests in this repo.

**Expected approach in monorepo:**
- `@/lib/linkedin-api` functions (`getLinkedInAPIStatus`, `listLinkedInAccounts`, `listLinkedInDestinations`, `publishLinkedInPost`) are the external boundary — these would be mocked in integration tests of the handlers and connector
- `@cinatra-ai/sdk-extensions` functions (`requireExtensionAction`, `getExtensionConnectorConfig`, `setExtensionConnectorConfig`) would be mocked in server action tests

## Fixtures and Factories

Not applicable — no test files present.

## Coverage

**Requirements:** Not enforced in this repo.

**Coverage is managed by the monorepo** which runs tests for all connector packages together.

## Test Types

**Unit Tests:** Not present in this repo. Would cover `src/mcp/handlers.ts` handler logic, `src/actions.ts` server actions, `src/connector.ts` `SocialMediaConnector` implementation, and `src/lib/utils.ts` utility functions.

**Integration Tests:** Not present. Would cover the full MCP tool registration flow in `src/mcp/registry.ts` and the `LinkedInSettingsPage` server component.

**E2E Tests:** Not used in this repo.

## Adding Tests (if this repo becomes standalone)

If host-internal peer dependencies are ever removed and the repo becomes truly standalone, the recommended approach (based on tsconfig and package type):

```bash
# Install a test runner compatible with ESM + TypeScript
corepack pnpm add -D vitest @vitest/ui

# Add to package.json scripts:
# "test": "vitest run"
# "test:watch": "vitest"
# "test:coverage": "vitest run --coverage"
```

Key units to test first:
- `src/lib/utils.ts` — pure functions with no external deps (`slugify`, `cn`, `formatCurrencyMillions`, `getPageNumbers`) — highest value, zero mocking required
- `src/mcp/handlers.ts` — handler dispatch logic, Zod schema parsing, input destructuring
- `src/actions.ts` — server action authorization gate and config read/write

---

*Testing analysis: 2026-06-09*
