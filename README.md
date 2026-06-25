# LinkedIn

Link one or more LinkedIn accounts to your workspace so agents can publish posts to a member's own feed or to any organization page the connected member is allowed to manage. Once connected, LinkedIn shows up as a publishing destination everywhere Cinatra posts to social networks.

## Works with

- LinkedIn
- `@cinatra-ai/social-media-connector` (the social publishing facade that routes posts to this connector)
- `@cinatra-ai/linkedin-oauth-connector` (manages the LinkedIn app credentials required before users can connect)

## Capabilities

- Connect one or more LinkedIn member accounts to your workspace
- Publish posts to a connected member's personal feed
- Publish posts to organization pages the connected member administers
- Pick a specific destination from the full set the connected member has access to

---

## Purpose

The LinkedIn connector is the social-network provider that teaches Cinatra how to publish to LinkedIn. It implements the `SocialMediaConnector` interface from `@cinatra-ai/social-media-connector` and registers itself into the social publishing facade at boot time, so any agent or workflow that posts to social networks can route through LinkedIn without any provider-specific code in the caller.

This connector handles the member-facing half of LinkedIn publishing. The companion `@cinatra-ai/linkedin-oauth-connector` manages the shared LinkedIn app credentials (Client ID and secret) that must be in place before individual users can connect.

## Installation

The LinkedIn connector is installed from the Cinatra marketplace. Navigate to the marketplace, find the LinkedIn connector, and install it. The platform handles activation automatically once installed.

**Prerequisites:**

1. Install and configure `@cinatra-ai/linkedin-oauth-connector` first. That connector stores the LinkedIn app Client ID and Client secret for the whole workspace.
2. After app credentials are saved, each user connects their own LinkedIn account from the connector setup page.

## Usage

### Connecting a LinkedIn account

1. After the workspace administrator has saved the LinkedIn app credentials in the LinkedIn OAuth connector, go to your connector setup page at **Settings > Connections > LinkedIn**.
2. Click **Connect LinkedIn**. You will be taken through LinkedIn's OAuth authorization flow.
3. Once authorized, your member feed and any organization pages you manage will appear as available publishing destinations.

### Publishing a post via an agent

When LinkedIn is connected and at least one account is set up, any Cinatra agent that uses the social publishing facade can publish to LinkedIn without additional configuration. Select LinkedIn (or a specific destination such as a company page) when the agent asks where to publish.

### MCP tools

The connector exposes four MCP tools that agents use at runtime:

| Tool | Description |
|---|---|
| `linkedin_status` | Returns the current connection status for this workspace. |
| `linkedin_accounts_list` | Lists all connected LinkedIn accounts (token-stripped; no credentials returned). |
| `linkedin_destinations_list` | Lists available publishing destinations — member feeds and organization pages. Accepts an optional `accountId` to filter by a specific connected account. |
| `linkedin_post_publish` | Publishes a post to a LinkedIn member feed or organization page. Requires `accountId`, `destinationType` (`member` or `organization`), `destinationId`, and `content`. |

**Example: publish a post**

```json
{
  "tool": "linkedin_post_publish",
  "input": {
    "accountId": "<linkedin-account-id>",
    "destinationType": "member",
    "destinationId": "<member-destination-id>",
    "content": "Excited to announce our new product launch!"
  }
}
```

The tool returns a receipt containing `postUrn`, `postUrl`, and `publishedAt`.

## Configuration

| Setting | Where | Description |
|---|---|---|
| LinkedIn Client ID | LinkedIn OAuth connector setup page | The Client ID from your LinkedIn developer app. Required before any user can connect. |
| LinkedIn Client Secret | LinkedIn OAuth connector setup page | The Client Secret from your LinkedIn developer app. Required before any user can connect. |
| Per-user account | LinkedIn connector setup page (`/connectors/cinatra-ai/linkedin-connector/setup`) | Each user connects their own LinkedIn account through the OAuth flow on this page. |

**Nango provider key:** `cinatra-linkedin`

The connector requests three host ports at activation: `authSession`, `nango`, and `capabilities`. It does not store OAuth tokens itself — Nango holds the user's LinkedIn credentials and the host service resolves them at publish time.

## Development

### Repository layout

```
src/
  connector.ts          # SocialMediaConnector implementation
  deps.ts               # Host DI singleton (LinkedInConnectorDeps)
  register.ts           # serverEntry — binds the connector at activation
  index.ts              # Public exports (MCP module, primitives, connector)
  settings-page.tsx     # Admin overlay (pointer to OAuth + setup pages)
  setup-page.tsx        # Per-user connect surface (OAuth flow)
  linkedin-setup-impl.tsx  # Setup page implementation
  mcp/
    handlers.ts         # Primitive handler functions
    registry.ts         # MCP tool registration
    module.ts           # createLinkedInModule factory
  components/           # Shared UI components
```

### Lint

```bash
npm run lint
# or
pnpm lint
```

### Extension gate

Run the local extension-kind gate before opening a pull request:

```bash
node extension-kind-gate.mjs --package-root .
```

This catches manifest shape errors, invalid port names, and dependency constraint issues before they reach the install pipeline.

### Architecture note

This connector carries no host-internal (`@/`) imports. Every host service the connector needs is delivered through the `LinkedInConnectorDeps` interface, bound at activation by `register(ctx)` adapting the `@cinatra-ai/host:linkedin-connection` capability. The deps slot is anchored on `globalThis` via a namespaced Symbol so separately compiled Next.js bundles (the settings page, the MCP handlers) all resolve the same slot without importing the registrar.

## API contract

### `register(ctx: ExtensionHostContext): void`

The `serverEntry` export. Registers the `linkedin` provider under the `social-post` capability and binds the host deps slot. Called once at connector activation; safe to call again on hot-update (re-binds fresh lazy resolvers).

### `createLinkedInModule()`

Returns `{ registerCapabilities }`. Used by the host to mount the four `linkedin_*` MCP tools on the workspace's MCP server.

### `LinkedInConnectorDeps` interface

```ts
interface LinkedInConnectorDeps {
  getStatus(): Promise<{ status: "connected" | "not_connected"; detail: string }>;
  getSettings(): Promise<LinkedInSettingsShape>;
  listAccounts(): Promise<LinkedInAccountRowShape[]>;
  listDestinations(options?: { scope?: "app" | "user"; userId?: string }): Promise<LinkedInDestinationOptionShape[]>;
  publishPost(input: {
    linkedinAccountId: string;
    destinationType: "member" | "organization";
    destinationId: string;
    content: string;
    userId?: string;
  }): Promise<{ postUrn: string; postUrl: string }>;
}
```

Account rows returned by `listAccounts` and `listDestinations` are token-stripped by contract: `accessToken` and `tokenExpiresAt` are never included in the connector's data path.

## Troubleshooting

**"LinkedIn app credentials are not configured yet"**

An administrator must save the LinkedIn Client ID and secret in the LinkedIn OAuth connector (`@cinatra-ai/linkedin-oauth-connector`) before the per-user connect flow is available. Go to Settings > Connections > LinkedIn OAuth and complete that setup first.

**"Not connected" on the setup page after completing OAuth**

The OAuth redirect may have encountered an error. Check the `?error=` query parameter on the setup page URL. Common causes: the LinkedIn app's OAuth redirect URI does not match the one configured in your LinkedIn developer app, or the app does not have the `w_member_social` permission scope.

**"authorization expired" error**

Click **Reconnect** on the LinkedIn connector setup page to refresh your LinkedIn OAuth token. If the error reappears immediately after reconnecting, verify that your LinkedIn developer app credentials are still valid in the LinkedIn OAuth connector settings.

**`linkedin_post_publish` returns an error**

- Verify the `accountId` is a valid connected-account ID from `linkedin_accounts_list`.
- Verify `destinationId` is a valid destination ID from `linkedin_destinations_list` for that account.
- Confirm the connected member has publish rights for the destination (organization pages require the member to be an admin of that page).
- If the workspace shows "connected" but publishing fails, try reconnecting the affected LinkedIn account on the setup page.

**Host deps not registered error at runtime**

If you see `@cinatra-ai/linkedin-connector: host runtime deps not registered`, the connector's `register(ctx)` entry was not called at boot. Ensure the connector is activated through the standard extension activation path so the host runs `serverEntry` before any MCP tool or social-post capability is invoked.
