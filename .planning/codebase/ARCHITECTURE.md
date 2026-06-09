<!-- refreshed: 2026-06-09 -->
# Architecture

**Analysis Date:** 2026-06-09

## System Overview

```text
┌─────────────────────────────────────────────────────────────┐
│                    Host Application (Next.js)                │
│   /configuration/connections/linkedin  (settings UI route)  │
│   /connectors/cinatra-ai/linkedin-connector/setup (setup)   │
└──────────┬──────────────────────────────────┬───────────────┘
           │ server actions                   │ React Server Components
           ▼                                  ▼
┌──────────────────────┐          ┌───────────────────────────┐
│   src/actions.ts     │          │  src/settings-page.tsx    │
│  (Next.js "use       │          │  src/setup-page.tsx       │
│   server" actions)   │          │  src/components/ui/       │
└──────────┬───────────┘          └─────────────┬─────────────┘
           │                                    │
           ▼                                    ▼
┌─────────────────────────────────────────────────────────────┐
│           @cinatra-ai/sdk-extensions (peer dep)              │
│   requireExtensionAction / getExtensionConnectorConfig /     │
│   setExtensionConnectorConfig                                │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│                     MCP Surface                              │
│    src/mcp/module.ts → registry.ts → handlers.ts            │
└───────────────────────┬─────────────────────────────────────┘
                        │ dispatches to
                        ▼
┌─────────────────────────────────────────────────────────────┐
│         Host-provided @/lib/linkedin-api                     │
│  getLinkedInAPIStatus / listLinkedInAccounts /               │
│  listLinkedInDestinations / publishLinkedInPost              │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│  SocialMediaConnector facade                                 │
│  src/connector.ts → @cinatra-ai/social-media-connector       │
└─────────────────────────────────────────────────────────────┘
```

## Component Responsibilities

| Component | Responsibility | File |
|-----------|----------------|------|
| `linkedInSocialMediaConnector` | Implements provider-neutral `SocialMediaConnector` contract; routes publish/status calls to host `@/lib/linkedin-api` | `src/connector.ts` |
| `createLinkedInModule` | Factory that returns a module object with `registerCapabilities`; used by connector host at boot | `src/mcp/module.ts` |
| `registerLinkedInPrimitives` | Iterates tool definitions and registers each against `ExtensionMcpToolServer`; adds static agent actor | `src/mcp/registry.ts` |
| `createLinkedInPrimitiveHandlers` | Pure handler map for four MCP tools: status, accounts_list, destinations_list, post_publish | `src/mcp/handlers.ts` |
| `LinkedInSettingsPage` | React Server Component: displays connection status, accounts list, and admin credential form | `src/settings-page.tsx` |
| `LinkedInConnectorSetupPage` | Thin dispatch-route entry that wraps `LinkedInSettingsPage` | `src/setup-page.tsx` |
| Server actions | `saveLinkedInConnectionAction` / `deleteLinkedInAccountAction` — RBAC-gated Next.js `"use server"` functions | `src/actions.ts` |
| UI primitives | Radix-based `Button`, `Input`, `Label`, `Badge` wrappers | `src/components/ui/` |
| Utilities | `cn`, `slugify`, pagination helpers | `src/lib/utils.ts` |

## Pattern Overview

**Overall:** Cinatra Extension Connector — a self-contained package that plugs into the host via two independent surfaces: the **MCP tool surface** (agentic API) and the **SocialMediaConnector facade** (programmatic publishing). The UI layer (React Server Components + Next.js server actions) is bundled alongside and mounted by the host router with zero per-connector host changes.

**Key Characteristics:**
- Zero host coupling — the host has no per-connector imports; all config I/O is through generic SDK accessors (`getExtensionConnectorConfig` / `setExtensionConnectorConfig`)
- Authorization is enforced at the SDK boundary via `requireExtensionAction` (fail-closed, roles: org_owner / org_admin / platform_admin)
- The connector carries **no** `@/lib/*` imports in `src/actions.ts`; UI pages do use `@/lib/linkedin-api` (host path alias) for read operations
- MCP handlers use a static `STATIC_AGENT_ACTOR` — authorization is delegated to the kernel's MCP boundary upstream

## Layers

**MCP Surface:**
- Purpose: Expose LinkedIn operations as callable agent tools
- Location: `src/mcp/`
- Contains: module factory, tool registry, handler implementations
- Depends on: `@cinatra-ai/sdk-extensions`, `@/lib/linkedin-api` (host alias), `zod`
- Used by: Host MCP server at boot via `createLinkedInModule()`

**SocialMediaConnector Facade:**
- Purpose: Let the `@cinatra-ai/social-media-connector` facade route LinkedIn publishes without provider-specific code in callers
- Location: `src/connector.ts`
- Contains: `linkedInSocialMediaConnector` object literal
- Depends on: `@cinatra-ai/sdk-extensions/social-contract`, `@/lib/linkedin-api`
- Used by: Host `src/lib/register-social-providers.ts` at boot

**UI / Settings Layer:**
- Purpose: Admin settings page and connector setup page
- Location: `src/settings-page.tsx`, `src/setup-page.tsx`, `src/actions.ts`
- Contains: React Server Components, Next.js server actions, form handling
- Depends on: `@cinatra-ai/sdk-extensions`, `@cinatra-ai/sdk-ui/marketplace`, `@/lib/linkedin-api`, local UI primitives
- Used by: Host Next.js router (mounted at `/configuration/connections/linkedin` and `/connectors/cinatra-ai/linkedin-connector/setup`)

**UI Primitives:**
- Purpose: Radix-based styled primitives scoped to this connector
- Location: `src/components/ui/`
- Contains: `Badge`, `Button`, `Input`, `Label`
- Depends on: `class-variance-authority`, `clsx`, `tailwind-merge`, `radix-ui`, `react`
- Used by: `src/settings-page.tsx`

**Utilities:**
- Purpose: Shared helpers (classname merging, string manipulation, pagination)
- Location: `src/lib/utils.ts`
- Depends on: `clsx`, `tailwind-merge`
- Used by: UI components

## Data Flow

### MCP Tool Call (e.g. linkedin_post_publish)

1. Agent kernel receives MCP request → authorizes at kernel boundary
2. `registerLinkedInPrimitives` dispatcher (`src/mcp/registry.ts`) routes by tool name
3. Zod schema (`publishPostSchema`) validates and parses `request.input` (`src/mcp/handlers.ts:14–20`)
4. `createLinkedInPrimitiveHandlers` handler calls `publishLinkedInPost` from host `@/lib/linkedin-api`
5. Result serialized to `ExtensionMcpToolResult` with `content` + `structuredContent`

### Settings Form Save

1. User submits form in `LinkedInSettingsPage` (`src/settings-page.tsx`)
2. Next.js invokes `saveLinkedInConnectionAction` (`src/actions.ts`)
3. `requireExtensionAction` enforces RBAC — throws if unauthorized
4. Zod parses `clientId` / `clientSecret` from `FormData`
5. `setExtensionConnectorConfig` writes config via SDK generic accessor
6. `redirect()` sends user to setup or fallback URL

### Social Publish via Facade

1. Host calls `linkedInSocialMediaConnector.publish(post, opts)` (`src/connector.ts:34`)
2. Connector maps `SocialMediaPost` fields to `publishLinkedInPost` params
3. Returns `SocialMediaPublishReceipt` with `postUrn`, `postUrl`, timestamp

**State Management:**
- No in-memory state. All persistence goes through the SDK's generic connector config accessor or through the host's `@/lib/linkedin-api`.

## Key Abstractions

**SocialMediaConnector:**
- Purpose: Provider-neutral contract for publishing and status
- Examples: `src/connector.ts`
- Pattern: Object literal implementing interface from `@cinatra-ai/sdk-extensions/social-contract`

**ExtensionMcpToolServer:**
- Purpose: Host-provided server instance that connectors register tools against
- Examples: `src/mcp/registry.ts`
- Pattern: `server.registerTool(name, meta, handler)` loop

**ExtensionPrimitiveRequest:**
- Purpose: Typed request envelope carrying `primitiveName`, `input`, `actor`, `mode`
- Examples: `src/mcp/handlers.ts`
- Pattern: Generic type parameterized by input shape; input is Zod-parsed inside each handler

## Entry Points

**Package public API:**
- Location: `src/index.ts`
- Triggers: Imported by host application
- Responsibilities: Re-exports `createLinkedInModule`, `registerLinkedInPrimitives`, `createLinkedInPrimitiveHandlers`, `linkedInSocialMediaConnector`

**Settings UI:**
- Location: `src/settings-page.tsx` (exported named component), `src/setup-page.tsx` (default export)
- Triggers: Next.js router mounting the connector's pages
- Responsibilities: Render settings form, show connected accounts, handle saves

**Server Actions:**
- Location: `src/actions.ts`
- Triggers: Form submissions from `LinkedInSettingsPage`
- Responsibilities: RBAC gate, config read/write, redirect

## Architectural Constraints

- **Server-only boundary:** `src/connector.ts` and `src/mcp/handlers.ts` import `server-only` or host server modules; must never be bundled client-side.
- **Host path alias:** `@/lib/linkedin-api` is resolved by the host's bundler/tsconfig. This connector does NOT ship that module — it is injected by the host.
- **No circular imports:** `module.ts` → `registry.ts` → `handlers.ts` is strictly one-directional.
- **ESM-only:** `"type": "module"` in `package.json`; `moduleResolution: "bundler"` in `tsconfig.json`.
- **Peer dependencies:** React 19, `@cinatra-ai/sdk-extensions`, `@cinatra-ai/sdk-ui` must be provided by host.

## Anti-Patterns

### Importing host lib from actions

**What happens:** `src/actions.ts` intentionally has no `@/lib/*` import — all config I/O uses the SDK generic accessor.
**Why it's wrong:** A per-connector host DI binding would require a host change for every new connector.
**Do this instead:** Use `getExtensionConnectorConfig` / `setExtensionConnectorConfig` from `@cinatra-ai/sdk-extensions` as shown in `src/actions.ts`.

### Bypassing `requireExtensionAction`

**What happens:** Earlier versions of this connector's server actions had no authorization gate.
**Why it's wrong:** Any authenticated user could modify LinkedIn credentials.
**Do this instead:** Always call `await requireExtensionAction("@cinatra-ai/linkedin-connector", "manage")` as the first line of every mutating server action (`src/actions.ts:27,43`).

## Error Handling

**Strategy:** Delegate to the SDK and Next.js. No explicit try/catch in handlers — errors propagate to the caller (MCP kernel or Next.js action runtime).

**Patterns:**
- Zod `.parse()` throws `ZodError` on invalid input (caught by MCP kernel or Next.js form error boundary)
- `requireExtensionAction` throws on unauthorized (fail-closed)
- `redirect()` in server actions uses Next.js's redirect mechanism (throws internally)

## Cross-Cutting Concerns

**Logging:** Not detected — no logger imported; relies on host application logging.
**Validation:** Zod schemas (`linkedinConnectorSchema`, `destinationsSchema`, `publishPostSchema`) in `src/actions.ts` and `src/mcp/handlers.ts`.
**Authentication:** `requireExtensionAction` from `@cinatra-ai/sdk-extensions` enforces org_owner / org_admin / platform_admin roles on all mutating actions.

---

*Architecture analysis: 2026-06-09*
