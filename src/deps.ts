// Host DI singleton for the LinkedIn connector's runtime deps.
//
// The connector carries NO non-SDK `@cinatra-ai/*` code dependency and NO `@/`
// host-internal import (cinatra#172 Stage H4): every host-shared surface it
// needs is delivered here, bound at activation by `register(ctx)` adapting the
// per-concern host service published in the capability registry
// (`@cinatra-ai/host:linkedin-connection`).
// Surfaces:
//   - connection status  — aggregate status for the settings page and the
//                          `linkedin_status` MCP primitive
//                          (`@/lib/linkedin-api` stays host-side).
//   - settings document  — Nango-resolved client credentials + account rows.
//                          TOKEN MATERIAL IS ABSENT BY CONTRACT: the host
//                          service strips `accessToken`/`tokenExpiresAt` from
//                          every published account row (the
//                          `linkedin_accounts_list` primitive returns these
//                          rows to callers; the publish path resolves tokens
//                          host-side and never needs them here).
//   - account rows       — connected accounts + their publish destinations.
//   - destinations       — app-scope account destinations, or user-scope
//                          Nango connections when `scope: "user"`.
//   - publishPost        — WRITER (publishes PUBLIC content to the remote
//                          LinkedIn network). Reached only through the host's
//                          MCP dispatch + actor gating (the
//                          `linkedin_post_publish` primitive) and the
//                          social-media facade's publish routing — the
//                          identical posture the static import carried.
//
// The deps slot is anchored on `globalThis` via a namespaced+versioned Symbol
// so the boot-time registration and the runtime callers — which live in
// SEPARATELY-COMPILED Next.js bundles (the settings page and the MCP handlers
// do NOT import the registrar) — resolve the SAME slot. A plain module-local
// binding would leave those bundles' instance unregistered →
// getLinkedInDeps() would throw. (Same reason as the SDK action-guard + the
// crm/github/wordpress-mcp deps slots.)

/** Connected LinkedIn account row as PUBLISHED by the host service
 * (structural mirror of the host's `LinkedInAccountConnection` MINUS the
 * host-only `accessToken`/`tokenExpiresAt`, which the service strips — no SDK
 * type import needed to compile against any host this connector can meet
 * during skew). */
export type LinkedInAccountRowShape = {
  id: string;
  memberId: string;
  name: string;
  email?: string;
  profileUrl?: string;
  destinations: Array<{
    id: string;
    type: "member" | "organization";
    name: string;
    urn?: string;
  }>;
  createdAt: string;
  updatedAt: string;
};

/** Aggregate LinkedIn connection status (host shape). */
export type LinkedInStatusShape = {
  status: "connected" | "not_connected";
  detail: string;
};

/** Settings document as PUBLISHED by the host service (account rows
 * token-stripped, see above). */
export type LinkedInSettingsShape = {
  clientId?: string;
  clientSecret?: string;
  redirectUri?: string;
  accounts: LinkedInAccountRowShape[];
  loggingEnabled?: boolean;
};

/** Publish destination option (structural mirror of the host's
 * `LinkedInDestinationOption`). */
export type LinkedInDestinationOptionShape = {
  linkedinAccountId: string;
  linkedinAccountName: string;
  destinationType: "member" | "organization";
  destinationId: string;
  destinationName: string;
  authorUrn: string;
};

export interface LinkedInConnectorDeps {
  /** Aggregate connection status (settings page + `linkedin_status`). */
  getStatus: () => Promise<LinkedInStatusShape>;
  /** Full settings document (token-stripped account rows). */
  getSettings: () => Promise<LinkedInSettingsShape>;
  /** Connected account rows, updatedAt-desc (token-stripped). */
  listAccounts: () => Promise<LinkedInAccountRowShape[]>;
  /** Publish destinations (app-scope account destinations, or user-scope
   * Nango connections when `scope: "user"`). */
  listDestinations: (options?: {
    scope?: "app" | "user";
    userId?: string;
  }) => Promise<LinkedInDestinationOptionShape[]>;
  /** WRITER — publish a post to the remote LinkedIn network (member feed or
   * organization page). Only ever reached through the host's MCP dispatch +
   * actor gating and the social-media facade's publish routing — the same
   * posture as the static import it replaces. */
  publishPost: (input: {
    linkedinAccountId: string;
    destinationType: "member" | "organization";
    destinationId: string;
    content: string;
    userId?: string;
  }) => Promise<{ postUrn: string; postUrl: string }>;
}

const LINKEDIN_DEPS_KEY = Symbol.for("@cinatra-ai/linkedin-connector:host-deps/v1");
type DepsHolder = { [k: symbol]: LinkedInConnectorDeps | null | undefined };
const _holder = globalThis as unknown as DepsHolder;

export function registerLinkedInConnector(deps: LinkedInConnectorDeps): void {
  _holder[LINKEDIN_DEPS_KEY] = deps;
}

export function getLinkedInDeps(): LinkedInConnectorDeps {
  const deps = _holder[LINKEDIN_DEPS_KEY];
  if (!deps) {
    throw new Error(
      "@cinatra-ai/linkedin-connector: host runtime deps not registered. " +
        "Call registerLinkedInConnector(deps) at boot.",
    );
  }
  return deps;
}

/** @internal test-only. */
export function _resetLinkedInDepsForTests(): void {
  _holder[LINKEDIN_DEPS_KEY] = null;
}
