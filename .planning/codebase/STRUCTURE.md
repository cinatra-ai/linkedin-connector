# Codebase Structure

**Analysis Date:** 2026-06-09

## Directory Layout

```
linkedin-connector/
├── src/
│   ├── index.ts                  # Package public API re-exports
│   ├── connector.ts              # SocialMediaConnector implementation
│   ├── actions.ts                # Next.js "use server" server actions
│   ├── settings-page.tsx         # LinkedIn settings React Server Component
│   ├── setup-page.tsx            # Connector setup route entry (wraps settings-page)
│   ├── mcp/
│   │   ├── module.ts             # createLinkedInModule factory
│   │   ├── registry.ts           # MCP tool registration loop + tool metadata
│   │   └── handlers.ts           # MCP handler implementations + Zod schemas
│   ├── components/
│   │   └── ui/
│   │       ├── badge.tsx         # Styled Badge primitive
│   │       ├── button.tsx        # Styled Button primitive
│   │       ├── input.tsx         # Styled Input primitive
│   │       └── label.tsx         # Styled Label primitive
│   └── lib/
│       └── utils.ts              # cn(), slugify(), pagination, formatting helpers
├── .github/
│   └── workflows/
│       ├── ci.yml                # CI pipeline
│       └── release.yml           # Release pipeline
├── package.json                  # Package manifest + cinatra connector metadata
├── tsconfig.json                 # Standalone TypeScript config (no monorepo extend)
├── .npmrc                        # npm registry config
└── LICENSE                       # Apache-2.0
```

## Directory Purposes

**`src/`:**
- Purpose: All source TypeScript/TSX. Compiled to `dist/` on publish.
- Key files: `src/index.ts` (public API entry), `src/connector.ts` (facade impl)

**`src/mcp/`:**
- Purpose: Everything related to exposing LinkedIn as MCP tools for the agent kernel.
- Contains: Module factory, tool registry, handler map with Zod validation.

**`src/components/ui/`:**
- Purpose: Connector-local Radix-based UI primitives used only by settings/setup pages.
- Contains: `Badge`, `Button`, `Input`, `Label` — styled with `class-variance-authority` + `tailwind-merge`.

**`src/lib/`:**
- Purpose: Shared utility functions with no LinkedIn-specific logic.
- Key files: `src/lib/utils.ts`

**`.github/workflows/`:**
- Purpose: CI (lint/typecheck/test) and release automation.
- Key files: `ci.yml`, `release.yml`

## Key File Locations

**Entry Points:**
- `src/index.ts`: Package public exports consumed by host app
- `src/setup-page.tsx`: Default export for host Next.js connector setup route
- `src/settings-page.tsx`: Named export `LinkedInSettingsPage` for admin settings route

**Configuration:**
- `package.json`: Package metadata, peer deps, and `cinatra` connector manifest block
- `tsconfig.json`: Standalone TypeScript config targeting `src/`, outputs to `dist/`
- `.npmrc`: npm registry authentication config (note: may contain token — treat as sensitive)

**Core Logic:**
- `src/connector.ts`: `SocialMediaConnector` implementation — publish and status
- `src/mcp/handlers.ts`: Four MCP tool handlers + exported Zod schemas
- `src/mcp/registry.ts`: Tool registration with descriptions and input schemas
- `src/actions.ts`: RBAC-gated server actions for credential save and account delete

**UI:**
- `src/settings-page.tsx`: Full settings UI (accounts list, admin credential form)
- `src/components/ui/`: Reusable styled primitives

**Utilities:**
- `src/lib/utils.ts`: `cn()`, `slugify()`, `firstName()`, `quarterLabel()`, `asArray()`, `compareValues()`, `getPageNumbers()`, `formatCurrencyMillions()`

## Naming Conventions

**Files:**
- `kebab-case.ts` / `kebab-case.tsx` for all source files
- UI primitives named after their component: `button.tsx`, `input.tsx`
- MCP files grouped under `mcp/` with descriptive names: `module.ts`, `registry.ts`, `handlers.ts`

**Directories:**
- `kebab-case` — `components/ui/`, `mcp/`, `lib/`

**Exports:**
- Named exports for all MCP and connector symbols: `createLinkedInModule`, `registerLinkedInPrimitives`, `createLinkedInPrimitiveHandlers`, `linkedInSocialMediaConnector`
- Default export only for the setup-page route component (`src/setup-page.tsx`)
- React components: `PascalCase` (`LinkedInSettingsPage`, `LinkedInConnectorSetupPage`)
- Functions: `camelCase` (`createLinkedInModule`, `saveLinkedInConnectionAction`)
- Constants: `SCREAMING_SNAKE_CASE` for module-level constants (`STATIC_AGENT_ACTOR`, `TOOL_META`, `SETUP_HREF`)

## Where to Add New Code

**New MCP tool:**
1. Add handler to the return object in `src/mcp/handlers.ts` — add a Zod schema if input is non-empty
2. Add tool metadata entry in `TOOL_META` in `src/mcp/registry.ts`
3. Export any new public schema from `src/index.ts` if consumers need it

**New server action:**
- Add to `src/actions.ts` — always call `requireExtensionAction` as the first line

**New UI section on settings page:**
- Edit `src/settings-page.tsx`; add UI primitives to `src/components/ui/` if a new primitive is needed

**New shared utility:**
- Add to `src/lib/utils.ts`

**New connector-level export:**
- Add re-export to `src/index.ts`

## Special Directories

**`dist/`:**
- Purpose: TypeScript compilation output (`outDir` in `tsconfig.json`)
- Generated: Yes
- Committed: No (not present in repo)

**`.planning/codebase/`:**
- Purpose: GSD codebase map documents
- Generated: Yes (by GSD tooling)
- Committed: Per project convention

**`.github/workflows/`:**
- Purpose: GitHub Actions CI and release workflows
- Generated: No
- Committed: Yes

---

*Structure analysis: 2026-06-09*
