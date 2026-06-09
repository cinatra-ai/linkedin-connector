# External Integrations

**Analysis Date:** 2026-06-09

## APIs & External Services

**LinkedIn API:**
- LinkedIn - Publish posts to member feeds and organization pages
  - SDK/Client: Host-provided `@/lib/linkedin-api` module (path alias; not bundled in this package)
  - Functions consumed: `publishLinkedInPost`, `getLinkedInAPIStatus`, `getLinkedInAPISettings`, `listLinkedInAccounts`, `listLinkedInDestinations`
  - Auth: LinkedIn OAuth app credentials (clientId + clientSecret) stored via Cinatra's generic connector config store; callback/redirect URI derived from the configured Nango server URL automatically

**Nango (OAuth Connection Service):**
- Nango - Manages the LinkedIn OAuth account connection flow
  - Referenced via settings page description: "Cinatra derives the callback URL from the configured Nango connection service"
  - Not directly imported in this package — handled by host via `@/lib/linkedin-api`

## Data Storage

**Databases:**
- Not directly accessed in this package. All persistence goes through the Cinatra SDK accessors:
  - `getExtensionConnectorConfig` / `setExtensionConnectorConfig` from `@cinatra-ai/sdk-extensions` — reads/writes connector config (LinkedIn clientId, clientSecret, connected accounts list) via the SDK's generic store
  - Underlying store implementation is in the host application

**File Storage:**
- Not applicable

**Caching:**
- Not detected

## Authentication & Identity

**Auth Provider:**
- Cinatra SDK authorization — `requireExtensionAction("@cinatra-ai/linkedin-connector", "manage")` gates all mutating server actions (`saveLinkedInConnectionAction`, `deleteLinkedInAccountAction`) in `src/actions.ts`
- Roles enforced: `org_owner`, `org_admin`, `platform_admin` (fail-closed, per inline comment)
- MCP tool authorization: enforced upstream at the MCP kernel boundary; connector passes a static `STATIC_AGENT_ACTOR` to handlers (see `src/mcp/registry.ts`)

**LinkedIn OAuth:**
- Connection setup is user-facing via `/account/security` route in the host app
- OAuth app credentials (clientId, clientSecret) are managed via the settings page at `/connectors/cinatra-ai/linkedin-connector/setup`

## Monitoring & Observability

**Error Tracking:**
- Not detected in this package

**Logs:**
- Not detected; no logging calls in source files

## CI/CD & Deployment

**Hosting:**
- Not a standalone deployable; deployed as part of the Cinatra host application (Next.js)

**CI Pipeline:**
- GitHub Actions — `.github/workflows/ci.yml`
  - Runs on push/PR to `main`
  - Node.js 24 + corepack
  - Validates first-party dep shape (no leaked `@cinatra-ai/*` in deps/devDeps)
  - Skips install/typecheck/test for source-mirror repos (those with first-party optional peers); monorepo owns those gates
  - Kind gate step: `connector` kind — no additional kind-specific gate steps detected beyond the baseline

## Environment Configuration

**Required env vars:**
- None directly required by this package. LinkedIn clientId and clientSecret are stored via the Cinatra SDK config store (not environment variables at this layer).

**Secrets location:**
- LinkedIn OAuth credentials stored in the Cinatra SDK connector config store (`linkedin_connection` key under `@cinatra-ai/linkedin-connector` namespace) via `setExtensionConnectorConfig` in `src/actions.ts`
- No `.env` files present in this repo

## Webhooks & Callbacks

**Incoming:**
- Not applicable — this package does not define webhook endpoints

**Outgoing:**
- LinkedIn API calls for publishing posts are outbound via host `@/lib/linkedin-api` module
- LinkedIn OAuth redirect URI is managed automatically by the Nango connection service configuration

## MCP Tool Surface

This connector exposes four MCP tools registered via `src/mcp/registry.ts`:

| Tool Name | Description |
|-----------|-------------|
| `linkedin_status` | Get current LinkedIn connector connection status |
| `linkedin_accounts_list` | List all connected LinkedIn accounts |
| `linkedin_destinations_list` | List publishing destinations (member profile or org pages), optionally filtered by account |
| `linkedin_post_publish` | Publish a post to a LinkedIn member profile or organization page |

Input schemas defined in `src/mcp/handlers.ts` using Zod. MCP server registration via `@cinatra-ai/sdk-extensions` `ExtensionMcpToolServer` interface.

---

*Integration audit: 2026-06-09*
