// The linkedin connector's `register(ctx)` server entry.
//
// Transport-registration cutover: the host no longer imports `linkedInSocialMediaConnector` — this entry
// registers the LinkedIn `SocialMediaConnector` impl behind the `social-post`
// capability at activation. The social-media facade resolves that capability
// lazily from its own serverEntry configuration, so publish routing reaches
// LinkedIn without any host (or facade) import of this package.
//
// Vendor-publish-direction inversion (cinatra#975 Wave 3, epic #978 — the
// Wave-2 widget-auth precedent, wordpress-mcp-connector#56 / drupal#58): this
// connector now OWNS the LinkedIn API client (`./linkedin-api`, relocated from
// core `src/lib/linkedin-api.ts`) and REGISTERS it under the SAME
// `@cinatra-ai/host:linkedin-connection` capability id the host published in
// the cinatra#172 Stage H4 era — a provider flip, no SDK contract change. The
// client persists through the host `connector-config` capability, resolves
// credentials through the connector-authored `nango-system` surface, and gates
// credential use through the `@cinatra-ai/host:instance-connection-gate` seam
// (cinatra#1077 — authz stays core). Until the follow-up core-eviction PR
// lands, the host's own registration coexists under the same id (the registry
// keys providers by packageName); both impls are behavior-equivalent, and this
// connector's OWN surfaces (deps slot below) bind directly to the
// connector-owned client.
//
// The published impl STRIPS `accessToken`/`tokenExpiresAt` from every account
// row (`linkedin_accounts_list` returns these rows to callers) — the identical
// least-privilege hardening the host's registration carries (codex H4 round-1
// finding 1). The publish path resolves tokens host-side from Nango.
//
// ADDITIVE members beyond the SDK `HostLinkedInConnectionService` contract
// (resolved STRUCTURALLY by core, the `HostExternalMcpRegistrySetupSurface`
// precedent — no packages/sdk-extensions change):
//   - `saveAccountFromNangoConnection` — the linkedin branch of the host's
//     BLOCKING nango-connection materializer re-points here at core eviction.
//     Deliberately NOT registered as a second `nango-connection-materializer`
//     provider now: the nango dispatch runs EVERY provider, so a second
//     linkedin handler would double-materialize each save during the interim.
//   - `getLoggingSettings` — the telemetry-page read (`enabled` + the
//     host-owned #981 capture directory).
//
// Registration-only (no I/O) — safe under required-extension-activation's
// prod-boot arming, and probe-safe (constructing the client and its published
// surface does no host-service resolution; every member resolves lazily at
// call time, so activation order against the host's boot imports never
// matters and the hot-update probe's `resolveProviders` reads stay live).
//
// SDK imports here are TYPE-ONLY (host-peer value-import gate): the provider
// impls and the host services all travel as DATA through `ctx.capabilities`;
// the capability ids are inlined string literals; the service shapes are
// local structural types so the connector compiles against ANY host SDK it
// can meet during skew.

import "server-only";
import type { ExtensionHostContext, ObjectsProvider } from "@cinatra-ai/sdk-extensions";
import { linkedInSocialMediaConnector } from "./connector";
import { registerLinkedInConnector, type LinkedInConnectorDeps } from "./deps";
import {
  createLinkedInApiClient,
  type LinkedInApiClient,
  type LinkedInAccountConnection,
  type LinkedInConnectorConfigSurface,
  type LinkedInConnectionGateSurface,
  type LinkedInNangoSurface,
} from "./linkedin-api";
import {
  buildLinkedinPostDraftActor,
  writeLinkedinPostDraftWith,
  type LinkedinPostDraftInput,
} from "./integration/post-draft-writer-core";

const PACKAGE_NAME = "@cinatra-ai/linkedin-connector";

/** The #981 capture channel the relocated client logs request/response
 * entries under (pre-relocation: the core client's `data/logs/linkedin-api`
 * directory — the channel keeps the name). */
const LINKEDIN_CAPTURE_CHANNEL = "linkedin-api";

/** Lazy per-concern host-service resolution (fail-loud on a missing service —
 * the host boot wiring / system-extension activation publishes these before
 * any connector call runs). */
function hostService<T>(ctx: ExtensionHostContext, capability: string): T {
  const provider = ctx.capabilities.resolveProviders(capability)[0];
  if (!provider) {
    throw new Error(
      `${PACKAGE_NAME}: host service "${capability}" is not registered — ` +
        `the host boot wiring (register-host-connector-services) must run before connector calls.`,
    );
  }
  return provider.impl as T;
}

/** Build the connector-owned LinkedIn API client over lazily-resolving host
 * bindings (construction does no resolution and no I/O — probe-safe). */
function buildLinkedInApiClient(ctx: ExtensionHostContext): LinkedInApiClient {
  let warnedCaptureUnavailable = false;
  return createLinkedInApiClient({
    config: () =>
      hostService<LinkedInConnectorConfigSurface>(ctx, "@cinatra-ai/host:connector-config"),
    nango: () => hostService<LinkedInNangoSurface>(ctx, "nango-system"),
    gate: () =>
      hostService<LinkedInConnectionGateSurface>(ctx, "@cinatra-ai/host:instance-connection-gate"),
    // #981 request/response capture — ambient `ctx.logger` members, OPTIONAL
    // by ABI (added at 2.3.0). On an older host (skew) capture degrades to a
    // warn-once skip: telemetry only, never the API behavior; the client's
    // own `loggingEnabled` gate and redaction posture are unchanged.
    capture: async (entry) => {
      if (typeof ctx.logger.capture === "function") {
        await ctx.logger.capture(LINKEDIN_CAPTURE_CHANNEL, entry);
        return;
      }
      if (!warnedCaptureUnavailable) {
        warnedCaptureUnavailable = true;
        ctx.logger.warn(
          "logger.capture is unavailable on this host (pre-2.3.0 SDK ABI) — LinkedIn request/response capture is skipped.",
        );
      }
    },
    captureDirectory: () =>
      typeof ctx.logger.captureDirectory === "function"
        ? ctx.logger.captureDirectory(LINKEDIN_CAPTURE_CHANNEL)
        : "",
  });
}

/** Strip host-only token material from a published account row: legacy stored
 * rows may carry an OAuth bearer (`accessToken`/`tokenExpiresAt`), and the
 * `linkedin_accounts_list` MCP primitive returns published rows to callers.
 * Identical to the stripping the host's own registration carries. */
function stripLinkedInAccountTokens(account: LinkedInAccountConnection) {
  const { accessToken: _hostOnlyToken, tokenExpiresAt: _hostOnlyExpiry, ...row } = account;
  return row;
}

/** The `@cinatra-ai/host:linkedin-connection` impl this connector registers:
 * the SDK-contract members (token-stripped) plus the additive members the
 * core-eviction flip resolves structurally (see the module header). */
function buildPublishedLinkedInConnectionService(client: LinkedInApiClient) {
  return {
    getStatus: () => client.getStatus(),
    getSettings: async () => {
      const { accounts, ...settings } = await client.getSettings();
      return { ...settings, accounts: accounts.map(stripLinkedInAccountTokens) };
    },
    listAccounts: async () => (await client.listAccounts()).map(stripLinkedInAccountTokens),
    listDestinations: (options?: { scope?: "app" | "user"; userId?: string }) =>
      client.listDestinations(options),
    // WRITER — publishes to the remote LinkedIn network; reached only through
    // the host's MCP dispatch + actor gating and the social-media facade's
    // publish routing (the SDK contract's TRUST note). The account-addressed
    // and per-user token reads inside gate through the
    // `instance-connection-gate` seam with the unchanged
    // `source: "linkedin-api"` audit labels.
    publishPost: (input: {
      linkedinAccountId: string;
      destinationType: "member" | "organization";
      destinationId: string;
      content: string;
      userId?: string;
    }) => client.publishPost(input),
    // ADDITIVE — the linkedin branch of the host's BLOCKING nango
    // connection-save materializer (row upsert; the return row is deliberately
    // dropped so token-adjacent material never rides the published surface).
    saveAccountFromNangoConnection: async (input: {
      providerConfigKey: string;
      connectionId: string;
    }): Promise<void> => {
      await client.saveAccountFromNangoConnection(input);
    },
    // ADDITIVE — the telemetry-page logging read (enabled flag + the
    // host-owned #981 capture directory as a read-only display value).
    getLoggingSettings: () => client.getLoggingSettings(),
  };
}

/** Build the host-bound deps from the connector-owned client (token-stripped
 * via the published surface — the deps row shapes carry no token fields).
 * Every member resolves its host surfaces LAZILY at call time — constructing
 * this object does no I/O and no resolution (probe-safe). */
function buildHostBoundDeps(
  service: ReturnType<typeof buildPublishedLinkedInConnectionService>,
): LinkedInConnectorDeps {
  return {
    getStatus: () => service.getStatus(),
    getSettings: () => service.getSettings(),
    listAccounts: () => service.listAccounts(),
    listDestinations: (options) => service.listDestinations(options),
    // WRITER — only ever reached through the host's MCP dispatch + actor
    // gating and the social-media facade's publish routing (the host
    // service's TRUST note documents the shared in-process capability id;
    // gating posture is unchanged vs the static import).
    publishPost: (input) => service.publishPost(input),
  };
}

// --- LinkedIn member post-draft registration (cinatra#1457, epic #1448) -------
// The connector's half of the `@cinatra-ai/linkedin:post-draft` DRAFTABLE
// lifecycle: it WRITES draft rows for the HOST-registered
// `@cinatra-ai/linkedin:post-draft` type (packages/objects/.../register-types.ts,
// #1808) through the host objects surface. Unlike the wordpress:post /
// drupal:node external-pointer writers, a linkedin draft carries authored
// CONTENT (the post-draft-writer-core leaf validates it fail-closed against the
// LinkedIn per-network constraints before write). The draft→scheduled→published
// state machine and the publish RECEIPTS (post URN/URL) are the publication
// ledger's job (cinatra#1450/#1774) — this writer never writes a receipt or a
// lifecycle transition. The caller (the host draft/publish-prep trigger)
// resolves the `linkedin-post-draft-writer` capability and supplies the draft
// content + the org/user the draft actor is minted from. Resolving the objects
// provider does NO I/O at registration; the impl fails loud at WRITE time if the
// host never wired the objects surface (an old host), so a draft is never
// written unguarded.

/** The host objects-integration service shape (structural mirror — the connector
 * compiles against any host SDK that meets it; the host binds the real
 * `objectTypeRegistry` / `objects_save` surface at boot). */
type HostObjectsIntegrationShape = { getObjectsProvider(): ObjectsProvider | null };

/** Resolve the host objects provider, or null when the host never published the
 * objects-integration service. */
function hostObjectsProvider(ctx: ExtensionHostContext): ObjectsProvider | null {
  const provider = ctx.capabilities.resolveProviders("@cinatra-ai/host:objects-integration")[0];
  return (provider?.impl as HostObjectsIntegrationShape | undefined)?.getObjectsProvider() ?? null;
}

/** The `linkedin-post-draft-writer` capability payload: a validated member
 * post-draft (content + member destination + optional visibility/media/
 * provenance) plus the org/user the draft actor is minted from. */
export type LinkedinPostDraftWriteRequest = LinkedinPostDraftInput & {
  /** The org the draft row is scoped to (REQUIRED — objects_save rejects a null org). */
  orgId: string;
  /** The user, when the trigger is user-attributed. */
  userId?: string | null;
};

export function register(ctx: ExtensionHostContext): void {
  ctx.capabilities.registerProvider("social-post", {
    packageName: PACKAGE_NAME,
    impl: linkedInSocialMediaConnector,
  });

  // cinatra#975 Wave 3 — the connector-owned LinkedIn client, registered under
  // the SAME capability id the host published (provider flip; the registry
  // keys providers by packageName, so the host's registration coexists until
  // the core-eviction follow-up removes it — both impls behavior-equivalent).
  const client = buildLinkedInApiClient(ctx);
  const service = buildPublishedLinkedInConnectionService(client);
  ctx.capabilities.registerProvider("@cinatra-ai/host:linkedin-connection", {
    packageName: PACKAGE_NAME,
    impl: service,
  });

  // Bind the host deps slot — now to the connector-owned client (via the
  // token-stripped published surface), no longer to the host's impl of the
  // linkedin-connection service. Always-bind: re-activation — incl. a
  // hot-update digest swap — re-binds fresh lazy resolvers, so a stale deps
  // object can never outlive its digest.
  registerLinkedInConnector(buildHostBoundDeps(service));

  // cinatra#1457 — the connector-owned `linkedin:post-draft` DRAFT writer. The
  // host draft/publish-prep trigger resolves this capability and supplies the
  // draft content + org/user; the impl validates the content fail-closed against
  // the LinkedIn per-network constraints, mints the draft actor, and upserts the
  // DRAFT row (idempotent host-side by (runId, destinationId)) through the host
  // objects surface. Writes draft content only — never a receipt or a lifecycle
  // transition (those ride the publication ledger). Building the impl does NO
  // host-service resolution and NO I/O (probe-safe) — the objects provider
  // resolves lazily at write time.
  ctx.capabilities.registerProvider("linkedin-post-draft-writer", {
    packageName: PACKAGE_NAME,
    impl: {
      writeDraft: async (request: LinkedinPostDraftWriteRequest) => {
        const provider = hostObjectsProvider(ctx);
        if (!provider) {
          throw new Error(`${PACKAGE_NAME}: host objects surface is not wired`);
        }
        const { orgId, userId, ...draft } = request;
        return writeLinkedinPostDraftWith(
          provider,
          draft,
          buildLinkedinPostDraftActor({ orgId, userId: userId ?? null }),
        );
      },
    },
  });
}
