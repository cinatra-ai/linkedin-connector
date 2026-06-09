# Technology Stack

**Analysis Date:** 2026-06-09

## Languages

**Primary:**
- TypeScript (strict mode, ES2023 target) - all source files under `src/`
- TSX (React JSX) - UI components and pages under `src/components/` and `src/settings-page.tsx`

**Secondary:**
- Not applicable

## Runtime

**Environment:**
- Node.js 24 (specified in CI via `.github/workflows/ci.yml`)
- ESModule format (`"type": "module"` in `package.json`)

**Package Manager:**
- npm with corepack enabled (CI uses `corepack enable`)
- `.npmrc` file present — note existence only, contents not read
- No lockfile detected in repo root (source mirror — monorepo owns install)

## Frameworks

**Core:**
- React 19 (peer dependency) - UI components and settings/setup pages
- Next.js (implicit via `"use server"` directives in `src/actions.ts`, `next/navigation` redirect, `next/link` in `src/settings-page.tsx`) - server actions and routing

**Testing:**
- Not detected (CI skips test for source-mirror repos with first-party peer deps)

**Build/Dev:**
- TypeScript compiler via `tsconfig.json` (`outDir: dist`, `declaration: true`)
- No bundler config detected (bundler module resolution set in `tsconfig.json`)

## Key Dependencies

**Critical:**
- `zod` ^3.x (imported in `src/mcp/handlers.ts`, `src/mcp/registry.ts`, `src/actions.ts`) - runtime input validation for MCP tool schemas and server actions
- `@cinatra-ai/sdk-extensions` (optional peer) - provides `ExtensionMcpToolServer`, `ExtensionPrimitiveRequest`, `requireExtensionAction`, `getExtensionConnectorConfig`, `setExtensionConnectorConfig`; core SDK contract
- `@cinatra-ai/sdk-ui` (optional peer) - provides `Main`, `PageHeader`, `PageContent`, `StatusPill` UI primitives from `@cinatra-ai/sdk-ui/marketplace`
- `@cinatra-ai/social-media-connector` (cinatra.dependencies runtime) - social media connector facade this package registers with

**Infrastructure:**
- `class-variance-authority` ^0.7.1 - variant-driven component styling (used in UI components)
- `clsx` ^2.1.1 - conditional classname composition, used via `src/lib/utils.ts` `cn()` helper
- `tailwind-merge` ^3.5.0 - Tailwind class deduplication, used via `cn()` helper
- `radix-ui` ^1.4.3 - headless UI primitives backing `src/components/ui/` components

## Configuration

**Environment:**
- LinkedIn OAuth app credentials (clientId, clientSecret) stored via `setExtensionConnectorConfig` SDK accessor — no direct `.env` usage in this package
- No `.env` files present in this repo

**Build:**
- `tsconfig.json` - standalone strict TypeScript config, targets `src/`, outputs to `dist/`
- `.npmrc` - package manager auth (existence noted, contents not read)
- `.github/workflows/ci.yml` - CI pipeline config

## Platform Requirements

**Development:**
- Node.js 24+
- Consumed as part of the Cinatra monorepo workspace; monorepo owns install and typecheck
- First-party `@cinatra-ai/*` packages are never published to a registry; provided by the monorepo at workspace resolution time

**Production:**
- Next.js server environment (uses `"use server"`, `server-only`, `next/navigation`)
- Deployed as part of the Cinatra host application — not a standalone deployable

---

*Stack analysis: 2026-06-09*
