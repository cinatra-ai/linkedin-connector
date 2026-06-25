# LinkedIn

Link one or more LinkedIn accounts to your workspace so agents can publish posts to a member's own feed or to any organization page the connected member is allowed to manage. Once connected, LinkedIn shows up as a publishing destination everywhere Cinatra posts to social networks. Install `@cinatra-ai/linkedin-oauth-connector` first to supply the LinkedIn app credentials, then each user connects their own account from **Settings > Connections > LinkedIn**.

## Works with

- LinkedIn
- `@cinatra-ai/social-media-connector` — the social publishing facade that routes posts to this connector
- `@cinatra-ai/linkedin-oauth-connector` — required first: stores the LinkedIn app Client ID and secret for the workspace

## Capabilities

- Connect one or more LinkedIn member accounts to your workspace via OAuth
- Publish posts to a connected member's personal feed
- Publish posts to organization pages the connected member administers
- Pick a specific destination from the full set the connected member has access to
- `linkedin_status` — MCP tool: returns the current connection status
- `linkedin_accounts_list` — MCP tool: lists connected accounts (no credentials returned)
- `linkedin_destinations_list` — MCP tool: lists available member feeds and organization pages; accepts optional `accountId` filter
- `linkedin_post_publish` — MCP tool: publishes a post; requires `accountId`, `destinationType` (`member` or `organization`), `destinationId`, and `content`; returns `postUrn`, `postUrl`, `publishedAt`
- Nango provider key: `cinatra-linkedin`; host ports: `authSession`, `nango`, `capabilities`
- Run `node extension-kind-gate.mjs --package-root .` before submitting a pull request
