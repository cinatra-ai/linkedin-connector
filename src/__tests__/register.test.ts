// `register(ctx)` shape — the cinatra#172 Stage H4 deps-slot cutover: the
// connector keeps its `social-post` provider registration AND binds its host
// deps slot itself (always-bind, lazy per-call host-service resolution over
// `@cinatra-ai/host:linkedin-connection`). Slot-timing coverage (cinatra#172
// finding 8): the slot is populated AT ACTIVATION — before the settings page
// / transport adapter / MCP handlers resolve it — and an unbound slot fails
// LOUD naming the package and the registration step.

import { describe, expect, it, vi, beforeEach } from "vitest";

import { register } from "../register";
import {
  getLinkedInDeps,
  registerLinkedInConnector,
  _resetLinkedInDepsForTests,
} from "../deps";

function activateWithServices(impls: Record<string, unknown>) {
  const registerProvider = vi.fn();
  const resolveProviders = vi.fn((capability: string) =>
    impls[capability] !== undefined
      ? [{ packageName: "@cinatra-ai/host", impl: impls[capability] }]
      : [],
  );
  const ctx = {
    capabilities: { registerProvider, resolveProviders },
  } as never;
  register(ctx);
  return { registerProvider, resolveProviders };
}

const ACCOUNT = {
  id: "acc-1",
  memberId: "m-1",
  name: "Ada",
  destinations: [{ id: "d-1", type: "member" as const, name: "Ada" }],
  createdAt: "2026-01-01T00:00:00Z",
  updatedAt: "2026-01-02T00:00:00Z",
};
const DESTINATION = {
  linkedinAccountId: "acc-1",
  linkedinAccountName: "Ada",
  destinationType: "member" as const,
  destinationId: "d-1",
  destinationName: "Ada",
  authorUrn: "urn:li:person:1",
};

beforeEach(() => {
  vi.clearAllMocks();
  _resetLinkedInDepsForTests();
});

describe("register(ctx) — provider + deps binding (cinatra#172 Stage H4)", () => {
  it("keeps the social-post provider registration AND binds the deps slot at activation, resolving the host service LAZILY", async () => {
    const getStatus = vi.fn(async () => ({ status: "connected" as const, detail: "1 account" }));
    const getSettings = vi.fn(async () => ({ clientId: "id-1", accounts: [ACCOUNT] }));
    const listAccounts = vi.fn(async () => [ACCOUNT]);
    const listDestinations = vi.fn(async () => [DESTINATION]);
    const publishPost = vi.fn(async () => ({
      postUrn: "urn:li:share:9",
      postUrl: "https://linkedin.com/feed/update/urn:li:share:9",
    }));
    const { registerProvider, resolveProviders } = activateWithServices({
      "@cinatra-ai/host:linkedin-connection": {
        getStatus,
        getSettings,
        listAccounts,
        listDestinations,
        publishPost,
      },
    });
    // The transport provider registration is unchanged by the H4 cutover.
    expect(registerProvider).toHaveBeenCalledWith(
      "social-post",
      expect.objectContaining({ packageName: "@cinatra-ai/linkedin-connector" }),
    );
    // No host-service resolution happened at registration (probe-safe), but
    // the slot IS bound — page/handler bundles resolving it later succeed.
    expect(resolveProviders).not.toHaveBeenCalled();

    await expect(getLinkedInDeps().getStatus()).resolves.toEqual({
      status: "connected",
      detail: "1 account",
    });
    await expect(getLinkedInDeps().getSettings()).resolves.toEqual({
      clientId: "id-1",
      accounts: [ACCOUNT],
    });
    await expect(getLinkedInDeps().listAccounts()).resolves.toEqual([ACCOUNT]);
    await expect(getLinkedInDeps().listDestinations({ userId: "acc-1" })).resolves.toEqual([
      DESTINATION,
    ]);
    expect(listDestinations).toHaveBeenCalledWith({ userId: "acc-1" });
    // WRITER forwards the publish input unchanged (gating stays at the host's
    // MCP dispatch / the facade routing, per the TRUST note).
    const publishInput = {
      linkedinAccountId: "acc-1",
      destinationType: "member" as const,
      destinationId: "d-1",
      content: "hello",
      userId: "u-1",
    };
    await expect(getLinkedInDeps().publishPost(publishInput)).resolves.toEqual({
      postUrn: "urn:li:share:9",
      postUrl: "https://linkedin.com/feed/update/urn:li:share:9",
    });
    expect(publishPost).toHaveBeenCalledWith(publishInput);
  });

  it("REPLACES a pre-bound deps slot (always-bind — a hot-update digest swap re-binds fresh resolvers)", async () => {
    const sentinel = vi.fn(async () => ({ status: "connected" as const, detail: "stale" }));
    registerLinkedInConnector({ getStatus: sentinel } as never);
    activateWithServices({
      "@cinatra-ai/host:linkedin-connection": {
        getStatus: async () => ({ status: "not_connected" as const, detail: "fresh" }),
      },
    });
    await expect(getLinkedInDeps().getStatus()).resolves.toEqual({
      status: "not_connected",
      detail: "fresh",
    });
    expect(sentinel).not.toHaveBeenCalled();
  });

  it("fails LOUD (descriptive) on a missing host service at call time", () => {
    activateWithServices({});
    expect(() => getLinkedInDeps().getStatus()).toThrow(
      /host service "@cinatra-ai\/host:linkedin-connection" is not registered/,
    );
  });

  it("fails LOUD with the package name + registration step when the SLOT itself is unbound", () => {
    expect(() => getLinkedInDeps()).toThrow(
      /@cinatra-ai\/linkedin-connector: host runtime deps not registered[\s\S]*registerLinkedInConnector/,
    );
  });
});
