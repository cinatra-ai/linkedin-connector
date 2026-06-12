// The linkedin connector's `register(ctx)` server entry.
//
// Transport-registration cutover: the host no longer imports `linkedInSocialMediaConnector` — this entry
// registers the LinkedIn `SocialMediaConnector` impl behind the `social-post`
// capability at activation. The social-media facade resolves that capability
// lazily from its own serverEntry configuration, so publish routing reaches
// LinkedIn without any host (or facade) import of this package.
//
// hostInternal pinned-empty sweep (cinatra#172 Stage H4): this entry ALSO
// binds the connector's host deps slot (`./deps`) by adapting the per-concern
// host service published in the capability registry
// (`@cinatra-ai/host:linkedin-connection`) — the settings page, the transport
// adapter, and the MCP handlers stop importing `@/lib/linkedin-api` and
// resolve `getLinkedInDeps()` from separately-compiled bundles instead. Every
// adapter member resolves its host service LAZILY at call time, so activation
// order against the host's boot imports never matters.
//
// Registration-only (no I/O) — safe under required-extension-activation's
// prod-boot arming, and probe-safe (the hot-update probe's `resolveProviders`
// reads stay live, so a probe-bound deps slot resolves identically to an
// activation-bound one).
//
// SDK imports here are TYPE-ONLY (host-peer value-import gate): the provider
// impl and the host service both travel as DATA through `ctx.capabilities`;
// the capability id is an inlined string literal; the service shape is a
// local structural type so the connector compiles against ANY host SDK it
// can meet during skew.

import "server-only";
import type { ExtensionHostContext } from "@cinatra-ai/sdk-extensions";
import { linkedInSocialMediaConnector } from "./connector";
import { registerLinkedInConnector, type LinkedInConnectorDeps } from "./deps";

const PACKAGE_NAME = "@cinatra-ai/linkedin-connector";

// Local STRUCTURAL shape of the per-concern host service this connector
// adapts into its deps slot.
type HostLinkedInConnectionShape = {
  getStatus: LinkedInConnectorDeps["getStatus"];
  getSettings: LinkedInConnectorDeps["getSettings"];
  listAccounts: LinkedInConnectorDeps["listAccounts"];
  listDestinations: LinkedInConnectorDeps["listDestinations"];
  publishPost: LinkedInConnectorDeps["publishPost"];
};

/** Lazy per-concern host-service resolution (fail-loud on a missing service —
 * the host boot wiring publishes it before any connector call runs). */
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

/** Build the host-bound deps from the per-concern host service. Every member
 * resolves LAZILY at call time — constructing this object does no I/O and no
 * resolution (probe-safe). */
function buildHostBoundDeps(ctx: ExtensionHostContext): LinkedInConnectorDeps {
  const linkedin = () =>
    hostService<HostLinkedInConnectionShape>(ctx, "@cinatra-ai/host:linkedin-connection");
  return {
    getStatus: () => linkedin().getStatus(),
    getSettings: () => linkedin().getSettings(),
    listAccounts: () => linkedin().listAccounts(),
    listDestinations: (options) => linkedin().listDestinations(options),
    // WRITER — only ever reached through the host's MCP dispatch + actor
    // gating and the social-media facade's publish routing (the host
    // service's TRUST note documents the shared in-process capability id;
    // gating posture is unchanged vs the static import).
    publishPost: (input) => linkedin().publishPost(input),
  };
}

export function register(ctx: ExtensionHostContext): void {
  ctx.capabilities.registerProvider("social-post", {
    packageName: PACKAGE_NAME,
    impl: linkedInSocialMediaConnector,
  });
  // Bind the host deps slot. Always-bind: re-activation — incl. a hot-update
  // digest swap — re-binds fresh lazy resolvers, so a stale deps object can
  // never outlive its digest.
  registerLinkedInConnector(buildHostBoundDeps(ctx));
}
