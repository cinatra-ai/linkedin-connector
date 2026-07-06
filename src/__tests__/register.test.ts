// `register(ctx)` shape — cinatra#975 Wave 3 (vendor-publish-direction
// inversion, epic #978): the connector keeps its `social-post` provider
// registration, REGISTERS the connector-owned LinkedIn API client under the
// SAME `@cinatra-ai/host:linkedin-connection` capability id the host published
// (provider flip), and binds its host deps slot to that client (always-bind,
// lazy per-call host-surface resolution over `@cinatra-ai/host:connector-config`,
// the connector-authored `nango-system` surface, and the
// `@cinatra-ai/host:instance-connection-gate` seam of cinatra#1077).
// Slot-timing coverage (cinatra#172 finding 8) is preserved: the slot is
// populated AT ACTIVATION — before the settings page / transport adapter /
// MCP handlers resolve it — and an unbound slot fails LOUD naming the package
// and the registration step.

import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";

import { register } from "../register";
import {
  getLinkedInDeps,
  registerLinkedInConnector,
  _resetLinkedInDepsForTests,
} from "../deps";

type CapturedEntry = { channel: string; label: string; kind: string; body: unknown };

function buildGate() {
  return {
    enforceInstanceConnectionUse: vi.fn(async () => ({ gated: true })),
    enforcePerUserInstanceConnectionUse: vi.fn(async () => ({ gated: true })),
  };
}

function buildNango(overrides: Record<string, unknown> = {}) {
  return {
    isNangoConfigured: vi.fn(() => true),
    getNangoOAuthCallbackUrl: vi.fn(() => "https://app.example.com/api/nango/callback"),
    listSavedNangoConnections: vi.fn(() => []),
    removeNangoConnectionRecord: vi.fn(async () => undefined),
    ensureNangoIntegration: vi.fn(async () => null),
    getNangoConnection: vi.fn(async () => ({
      credentials: { type: "OAUTH2", access_token: "token-abc" },
    })),
    deleteNangoConnection: vi.fn(async () => undefined),
    getNangoOAuth2IntegrationCredentials: vi.fn(async () => null),
    providerConfigKeys: { linkedin: "cinatra-linkedin" },
    ...overrides,
  };
}

function buildConfig(store: Record<string, unknown>) {
  return {
    read: vi.fn(<T,>(key: string, fallback: T): T => (store[key] as T) ?? fallback),
    write: vi.fn((key: string, value: unknown) => {
      store[key] = value;
    }),
  };
}

function activateWithServices(
  impls: Record<string, unknown>,
  options: { captureAvailable?: boolean } = {},
) {
  const registerProvider = vi.fn();
  const resolveProviders = vi.fn((capability: string) =>
    impls[capability] !== undefined
      ? [{ packageName: "@cinatra-ai/host", impl: impls[capability] }]
      : [],
  );
  const captured: CapturedEntry[] = [];
  const warn = vi.fn();
  const logger: Record<string, unknown> = { warn };
  if (options.captureAvailable !== false) {
    logger.capture = vi.fn(async (channel: string, entry: Omit<CapturedEntry, "channel">) => {
      captured.push({ channel, ...entry });
    });
    logger.captureDirectory = vi.fn(
      (channel: string) => `/data/extensions/logs/linkedin-connector/${channel}`,
    );
  }
  const ctx = {
    capabilities: { registerProvider, resolveProviders },
    logger,
  } as never;
  register(ctx);
  return { registerProvider, resolveProviders, captured, warn };
}

/** A stored legacy account row CARRYING token material — the published rows
 * must strip it. */
const STORED_ACCOUNT = {
  id: "acc-1",
  memberId: "m-1",
  name: "Ada",
  accessToken: "legacy-bearer-SECRET",
  tokenExpiresAt: "2027-01-01T00:00:00Z",
  destinations: [{ id: "d-1", type: "member" as const, name: "Ada", urn: "urn:li:person:m-1" }],
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-02T00:00:00.000Z",
};

beforeEach(() => {
  vi.clearAllMocks();
  _resetLinkedInDepsForTests();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("register(ctx) — provider registrations + deps binding (cinatra#975 W3)", () => {
  it("registers social-post AND the connector-owned @cinatra-ai/host:linkedin-connection provider, resolving NOTHING at activation (probe-safe)", () => {
    const { registerProvider, resolveProviders } = activateWithServices({});
    expect(registerProvider).toHaveBeenCalledWith(
      "social-post",
      expect.objectContaining({ packageName: "@cinatra-ai/linkedin-connector" }),
    );
    // The provider FLIP: the same host capability id, this package's impl.
    expect(registerProvider).toHaveBeenCalledWith(
      "@cinatra-ai/host:linkedin-connection",
      expect.objectContaining({
        packageName: "@cinatra-ai/linkedin-connector",
        impl: expect.objectContaining({
          getStatus: expect.any(Function),
          getSettings: expect.any(Function),
          listAccounts: expect.any(Function),
          listDestinations: expect.any(Function),
          publishPost: expect.any(Function),
          // Additive members for the core-eviction flip.
          saveAccountFromNangoConnection: expect.any(Function),
          getLoggingSettings: expect.any(Function),
        }),
      }),
    );
    expect(resolveProviders).not.toHaveBeenCalled();
  });

  it("deps route through the connector-owned client: config-backed rows, token-STRIPPED", async () => {
    const store: Record<string, unknown> = { linkedin: { accounts: [STORED_ACCOUNT] } };
    activateWithServices({
      "@cinatra-ai/host:connector-config": buildConfig(store),
      "nango-system": buildNango(),
      "@cinatra-ai/host:instance-connection-gate": buildGate(),
    });

    const accounts = await getLinkedInDeps().listAccounts();
    expect(accounts).toHaveLength(1);
    expect(accounts[0]).toMatchObject({ id: "acc-1", memberId: "m-1", name: "Ada" });
    expect(accounts[0]).not.toHaveProperty("accessToken");
    expect(accounts[0]).not.toHaveProperty("tokenExpiresAt");

    const settings = await getLinkedInDeps().getSettings();
    expect(settings.accounts[0]).not.toHaveProperty("accessToken");
    expect(settings.accounts[0]).not.toHaveProperty("tokenExpiresAt");

    // App-scope destination mapping (urn fallback semantics unchanged).
    await expect(getLinkedInDeps().listDestinations()).resolves.toEqual([
      {
        linkedinAccountId: "acc-1",
        linkedinAccountName: "Ada",
        destinationType: "member",
        destinationId: "d-1",
        destinationName: "Ada",
        authorUrn: "urn:li:person:m-1",
      },
    ]);

    await expect(getLinkedInDeps().getStatus()).resolves.toEqual({
      status: "connected",
      detail: "1 LinkedIn account is connected.",
    });
  });

  it("publishPost (app-scope account) gates through the instance-connection-gate seam with the EXACT audit-source label, resolves the token via nango, and captures request/response on the linkedin-api channel", async () => {
    const store: Record<string, unknown> = { linkedin: { accounts: [STORED_ACCOUNT] } };
    const gate = buildGate();
    const nango = buildNango();
    const fetchMock = vi.fn(async () => ({
      ok: true,
      status: 201,
      headers: { get: (name: string) => (name === "x-restli-id" ? "urn:li:share:9" : null) },
      text: async () => "",
      json: async () => null,
    }));
    vi.stubGlobal("fetch", fetchMock);

    const { captured } = activateWithServices({
      "@cinatra-ai/host:connector-config": buildConfig(store),
      "nango-system": nango,
      "@cinatra-ai/host:instance-connection-gate": gate,
    });

    await expect(
      getLinkedInDeps().publishPost({
        linkedinAccountId: "acc-1",
        destinationType: "member",
        destinationId: "d-1",
        content: "hello",
      }),
    ).resolves.toEqual({
      postUrn: "urn:li:share:9",
      postUrl: `https://www.linkedin.com/feed/update/${encodeURIComponent("urn:li:share:9")}/`,
    });

    // Audit-source parity: the exact labels the core client emitted.
    expect(gate.enforceInstanceConnectionUse).toHaveBeenCalledExactlyOnceWith({
      connectorKey: "linkedin",
      connectionId: "acc-1",
      source: "linkedin-api",
    });
    // Token resolution rides the nango-system surface under the connector's
    // provider-config key from the surface's own key map.
    expect(nango.getNangoConnection).toHaveBeenCalledWith("cinatra-linkedin", "acc-1", {
      forceRefresh: true,
      refreshToken: true,
    });

    // #981 capture: request+response on the linkedin-api channel, labels
    // unchanged — and NO secret material in any captured body.
    expect(captured.map((entry) => [entry.channel, entry.label, entry.kind])).toEqual([
      ["linkedin-api", "linkedin-publish-post", "request"],
      ["linkedin-api", "linkedin-publish-post", "response"],
    ]);
    expect(JSON.stringify(captured)).not.toContain("token-abc");
    expect(JSON.stringify(captured)).not.toContain("legacy-bearer-SECRET");
  });

  it("publishPost fails CLOSED (no outbound call) when the use-gate denies", async () => {
    const store: Record<string, unknown> = { linkedin: { accounts: [STORED_ACCOUNT] } };
    const gate = buildGate();
    gate.enforceInstanceConnectionUse.mockRejectedValueOnce(
      Object.assign(new Error("connection use denied"), { name: "ConnectionUseDeniedError" }),
    );
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    activateWithServices({
      "@cinatra-ai/host:connector-config": buildConfig(store),
      "nango-system": buildNango(),
      "@cinatra-ai/host:instance-connection-gate": gate,
    });

    await expect(
      getLinkedInDeps().publishPost({
        linkedinAccountId: "acc-1",
        destinationType: "member",
        destinationId: "d-1",
        content: "hello",
      }),
    ).rejects.toThrow("connection use denied");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("publishPost (per-user scope:\"user\" connection) gates through the PER-USER seam member with the exact source label", async () => {
    const store: Record<string, unknown> = { linkedin: { accounts: [] } };
    const gate = buildGate();
    const nango = buildNango({
      listSavedNangoConnections: vi.fn(() => [
        {
          connectorKey: "linkedin",
          connectionId: "user-conn-1",
          providerConfigKey: "cinatra-linkedin",
          connectedAt: "2026-01-01T00:00:00Z",
          scope: "user" as const,
          userId: "u-1",
        },
      ]),
    });
    const fetchMock = vi
      .fn()
      // userinfo (member id resolution)
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        headers: { get: () => null },
        json: async () => ({ sub: "m-9", name: "Grace" }),
        text: async () => "",
      })
      // ugcPosts publish
      .mockResolvedValueOnce({
        ok: true,
        status: 201,
        headers: { get: (name: string) => (name === "x-restli-id" ? "urn:li:share:77" : null) },
        text: async () => "",
        json: async () => null,
      });
    vi.stubGlobal("fetch", fetchMock);

    activateWithServices({
      "@cinatra-ai/host:connector-config": buildConfig(store),
      "nango-system": nango,
      "@cinatra-ai/host:instance-connection-gate": gate,
    });

    await expect(
      getLinkedInDeps().publishPost({
        linkedinAccountId: "user-conn-1",
        destinationType: "member",
        destinationId: "user-conn-1",
        content: "hi",
        userId: "u-1",
      }),
    ).resolves.toMatchObject({ postUrn: "urn:li:share:77" });

    expect(gate.enforcePerUserInstanceConnectionUse).toHaveBeenCalledExactlyOnceWith({
      connectorKey: "linkedin",
      connectionId: "user-conn-1",
      userId: "u-1",
      source: "linkedin-api",
    });
    expect(gate.enforceInstanceConnectionUse).not.toHaveBeenCalled();
  });

  it("the additive saveAccountFromNangoConnection member materializes the account row WITHOUT gating (the save route owns authorization) and returns void", async () => {
    const store: Record<string, unknown> = { linkedin: { accounts: [] } };
    const gate = buildGate();
    const nango = buildNango();
    const fetchMock = vi
      .fn()
      // userinfo
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        headers: { get: () => null },
        json: async () => ({ sub: "m-1", name: "Ada Lovelace" }),
        text: async () => "",
      })
      // organizationAcls — no managed organizations
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        headers: { get: () => null },
        json: async () => ({ elements: [] }),
        text: async () => "",
      });
    vi.stubGlobal("fetch", fetchMock);

    const { registerProvider } = activateWithServices({
      "@cinatra-ai/host:connector-config": buildConfig(store),
      "nango-system": nango,
      "@cinatra-ai/host:instance-connection-gate": gate,
    });
    const registration = registerProvider.mock.calls.find(
      (call) => call[0] === "@cinatra-ai/host:linkedin-connection",
    );
    const impl = registration?.[1].impl as {
      saveAccountFromNangoConnection: (input: {
        providerConfigKey: string;
        connectionId: string;
      }) => Promise<void>;
    };

    await expect(
      impl.saveAccountFromNangoConnection({
        providerConfigKey: "cinatra-linkedin",
        connectionId: "conn-1",
      }),
    ).resolves.toBeUndefined();

    const persisted = store.linkedin as { accounts: Array<Record<string, unknown>> };
    expect(persisted.accounts[0]).toMatchObject({ id: "conn-1", memberId: "m-1", name: "Ada Lovelace" });
    // The import-seam readback stays UNGATED (the nango save route machinery
    // authorizes it — the core client's codex round-1 posture, preserved).
    expect(gate.enforceInstanceConnectionUse).not.toHaveBeenCalled();
    expect(gate.enforcePerUserInstanceConnectionUse).not.toHaveBeenCalled();
  });

  it("fails LOUD (descriptive) on a missing host capability at call time", async () => {
    // Nothing published: the first surface the status read touches is the
    // connector-config store — the loud miss names the capability id.
    activateWithServices({});
    await expect(getLinkedInDeps().getStatus()).rejects.toThrow(
      /host service "@cinatra-ai\/host:connector-config" is not registered/,
    );
    // And with config present but the nango-system surface absent, the miss
    // names nango-system (never a silent degradation).
    activateWithServices({
      "@cinatra-ai/host:connector-config": buildConfig({}),
    });
    await expect(getLinkedInDeps().getStatus()).rejects.toThrow(
      /host service "nango-system" is not registered/,
    );
  });

  it("degrades capture to a warn-once SKIP on a pre-2.3.0 host (telemetry only — the publish itself still runs)", async () => {
    const store: Record<string, unknown> = { linkedin: { accounts: [STORED_ACCOUNT] } };
    const fetchMock = vi.fn(async () => ({
      ok: true,
      status: 201,
      headers: { get: (name: string) => (name === "x-restli-id" ? "urn:li:share:9" : null) },
      text: async () => "",
      json: async () => null,
    }));
    vi.stubGlobal("fetch", fetchMock);
    const { warn } = activateWithServices(
      {
        "@cinatra-ai/host:connector-config": buildConfig(store),
        "nango-system": buildNango(),
        "@cinatra-ai/host:instance-connection-gate": buildGate(),
      },
      { captureAvailable: false },
    );

    await expect(
      getLinkedInDeps().publishPost({
        linkedinAccountId: "acc-1",
        destinationType: "member",
        destinationId: "d-1",
        content: "hello",
      }),
    ).resolves.toMatchObject({ postUrn: "urn:li:share:9" });
    expect(warn).toHaveBeenCalledTimes(1);
    expect(warn).toHaveBeenCalledWith(expect.stringContaining("logger.capture is unavailable"));
  });

  it("REPLACES a pre-bound deps slot (always-bind — a hot-update digest swap re-binds fresh resolvers)", async () => {
    const sentinel = vi.fn(async () => ({ status: "connected" as const, detail: "stale" }));
    registerLinkedInConnector({ getStatus: sentinel } as never);
    activateWithServices({
      "@cinatra-ai/host:connector-config": buildConfig({}),
      "nango-system": buildNango(),
      "@cinatra-ai/host:instance-connection-gate": buildGate(),
    });
    await expect(getLinkedInDeps().getStatus()).resolves.toEqual({
      status: "not_connected",
      detail: "Configure LinkedIn OAuth to connect profiles and managed company pages.",
    });
    expect(sentinel).not.toHaveBeenCalled();
  });

  it("fails LOUD with the package name + registration step when the SLOT itself is unbound", () => {
    expect(() => getLinkedInDeps()).toThrow(
      /@cinatra-ai\/linkedin-connector: host runtime deps not registered[\s\S]*registerLinkedInConnector/,
    );
  });
});
