# Coding Conventions

**Analysis Date:** 2026-06-09

## Naming Patterns

**Files:**
- React page components: PascalCase, descriptive suffix — `settings-page.tsx`, `setup-page.tsx`
- React UI primitives: lowercase noun — `button.tsx`, `input.tsx`, `label.tsx`, `badge.tsx`
- Non-UI modules: lowercase, hyphen-separated — `utils.ts`, `module.ts`, `handlers.ts`, `registry.ts`, `connector.ts`, `actions.ts`

**Functions:**
- Exported factory functions: camelCase prefixed with `create` — `createLinkedInModule()`, `createLinkedInPrimitiveHandlers()`
- Exported registration functions: camelCase prefixed with `register` — `registerLinkedInPrimitives()`
- Server actions: camelCase suffixed with `Action` — `saveLinkedInConnectionAction`, `deleteLinkedInAccountAction`
- React page components: PascalCase — `LinkedInSettingsPage`, `LinkedInConnectorSetupPage`
- UI primitive components: PascalCase — `Button`, `Input`, `Label`
- Utility helpers: camelCase describing the transformation — `cn()`, `slugify()`, `firstName()`, `quarterLabel()`, `asArray()`, `compareValues()`, `getPageNumbers()`

**Variables:**
- camelCase throughout
- Constants (module-level, never reassigned): SCREAMING_SNAKE_CASE — `STATIC_AGENT_ACTOR`, `TOOL_META`, `SETUP_HREF`

**Types:**
- PascalCase, suffixed with the role — `SocialMediaConnector`, `SocialMediaConnectorStatusResult`, `SocialMediaPost`, `SocialMediaPublishReceipt`
- Props types: `ComponentNameProps` — `ConnectorSetupPageProps`, `SettingsLinkedInPageProps`
- Zod schemas: camelCase suffixed with `Schema` — `linkedinConnectorSchema`, `destinationsSchema`, `publishPostSchema`

## Code Style

**Formatting:**
- No `.prettierrc` or `biome.json` detected in the repo root
- 2-space indentation (observed in all source files)
- Double quotes for strings in JSX props; double quotes for TypeScript imports
- Trailing commas in multi-line object/array literals

**Linting:**
- No `.eslintrc*` or `eslint.config.*` detected — linting runs in the monorepo, not this extracted source mirror

## Import Organization

**Order (observed pattern):**
1. Node.js built-ins (not used in this repo)
2. Framework/external packages — `react`, `next/navigation`, `zod`, `radix-ui`, `class-variance-authority`, `clsx`, `tailwind-merge`
3. `@cinatra-ai/*` SDK packages — `@cinatra-ai/sdk-extensions`, `@cinatra-ai/sdk-ui`
4. Relative imports — `./actions`, `./connector`, `./mcp/handlers`, `../../lib/utils`, `@/lib/linkedin-api`

**Path Aliases:**
- `@/` resolves to the host monorepo's `src/` directory. Used only in files that import host-internal APIs: `src/connector.ts`, `src/mcp/handlers.ts`, `src/settings-page.tsx`. These imports (`@/lib/linkedin-api`) are host-only and cannot be resolved standalone.

**`verbatimModuleSyntax`:**
- Enabled in `tsconfig.json` — type-only imports must use `import type { ... }`. Observed throughout: `import type { SocialMediaConnector, ... }`, `import type { ExtensionPrimitiveRequest }`.

## Error Handling

**Patterns:**
- Input validation via Zod schemas — `z.string().min(1).parse(...)` throws on invalid input; no manual try/catch around these (errors propagate to Next.js error boundaries)
- Server actions use `redirect()` from `next/navigation` for post-action navigation; no explicit error returns
- Async functions in `handlers.ts` do not catch errors from `@/lib/linkedin-api` calls — errors propagate up to the MCP server boundary
- No custom error classes detected in this repo

## Logging

**Framework:** None detected in this repo. No `console.*` calls present in production code.

**Patterns:**
- No logging conventions established within this connector. Logging is expected to be handled by the host monorepo.

## Comments

**When to Comment:**
- Module-level block comments (lines starting with `//`) explain architectural decisions, authorization contracts, and what the module does NOT do — `src/index.ts`, `src/connector.ts`, `src/actions.ts`, `src/mcp/registry.ts`
- Inline comments document non-obvious choices (e.g., why `STATIC_AGENT_ACTOR` is static, why `@cinatra-ai/mcp-server` import is dropped)
- No JSDoc/TSDoc annotations detected — types are expressed via TypeScript signatures and Zod schemas

**Style:**
- Comment blocks use `//` line comments, not `/* */` block comments
- Comments are written above the construct they describe, not inline at end of line

## Function Design

**Size:** Small, single-responsibility functions. Handlers in `src/mcp/handlers.ts` are 1-4 lines each. Page components are the longest units (~90 lines) due to JSX markup.

**Parameters:**
- Prefer destructured typed objects for component props — `{ searchParams }: SettingsLinkedInPageProps`
- Server actions accept `FormData` directly (Next.js server action convention)
- MCP handlers accept a typed `ExtensionPrimitiveRequest<unknown>` and destructure input after Zod parsing

**Return Values:**
- Async functions return explicit `Promise<T>` types from SDK contracts
- React components return JSX (inferred type)
- Factory functions return plain objects (`createLinkedInModule` returns `{ registerCapabilities }`)

## Module Design

**Exports:**
- Named exports preferred throughout; no default exports except for the Next.js page component `LinkedInConnectorSetupPage` in `src/setup-page.tsx` (required by Next.js routing convention)
- `src/index.ts` is the public barrel — re-exports from `./mcp/module`, `./mcp/registry`, `./mcp/handlers`, `./connector`

**Barrel Files:**
- `src/index.ts` serves as the package entry barrel. UI components are NOT re-exported through `index.ts`; consumers import settings pages directly from `@cinatra-ai/linkedin-connector/settings-page` (noted in `src/index.ts` comment)

## TypeScript Configuration

**Key settings (`tsconfig.json`):**
- `strict: true` — strict mode enabled
- `noImplicitAny: false` — explicit any is allowed (loosens strict slightly)
- `isolatedModules: true` — each file must be independently transpilable
- `verbatimModuleSyntax: true` — enforces `import type` for type-only imports
- `target: ES2023`, `module: ESNext`, `moduleResolution: bundler`

## Zod Schema Convention

Schemas are defined at module scope and exported from `src/mcp/handlers.ts` so `src/mcp/registry.ts` can reuse them as `inputSchema` for MCP tool registration. This avoids schema duplication between validation and tool metadata.

```typescript
// src/mcp/handlers.ts
export const publishPostSchema = z.object({
  accountId: z.string().min(1),
  destinationType: z.enum(["member", "organization"]),
  ...
});

// src/mcp/registry.ts — reuses the exported schema
import { ..., publishPostSchema } from "./handlers";
```

## React Component Conventions

**UI primitives (`src/components/ui/`):**
- Use `React.ComponentProps<"element">` for prop spreading — no manual prop interface needed
- Apply `data-slot="component-name"` attribute for CSS targeting
- Use `cn()` from `src/lib/utils.ts` for conditional Tailwind class merging
- Use `cva` (class-variance-authority) for variant-based styling in `button.tsx`

**Page components:**
- Async server components (Next.js App Router pattern)
- `Promise.all([...])` for parallel data fetching at the top of the render function
- Helper functions (e.g., `pickSearchParam`) defined in the same file when used only there

---

*Convention analysis: 2026-06-09*
