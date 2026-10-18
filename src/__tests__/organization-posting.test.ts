// LinkedIn company page posting with a Community Management app.
//
// A LinkedIn app with the Community Management API (CM) carries no other
// product, so it has no OpenID scopes: v2/userinfo is not available to it. When
// the admin form set `organizationPosting: true` on the shared "linkedin" row,
// Connect and the per-user member post read the member through v2/me, the flag
// and the client pair saved with it survive every write of the row, and only
// that pair counts. Without the flag every road stays as it was.
//
// Every test calls only members of the published
// `@cinatra-ai/host:linkedin-connection` service that `register(ctx)` provides.

import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";

import { register } from "../register";
import { _resetLinkedInDepsForTests } from "../deps";

type PublishedService = {
  getSettings(): Promise<{ clientId?: string; clientSecret?: string; [key: string]: unknown }>;
  listDestinations(options?: { scope?: "app" | "user"; userId?: string }): Promise<
    Array<{ destinationType: string; destinationId: string; destinationName: string; authorUrn: string }>
  >;
  publishPost(input: {
    linkedinAccountId: string;
    destinationType: "member" | "organization";
    destinationId: string;
    content: string;
    userId?: string;
  }): Promise<{ postUrn: string; postUrl: string }>;
  saveAccountFromNangoConnection(input: { providerConfigKey: string; connectionId: string }): Promise<void>;
};

type Row = Record<string, unknown>;

const ME = { id: "me-1", localizedFirstName: "Ada", localizedLastName: "Lovelace" };
const USERINFO = { sub: "oidc-1", name: "Ada Lovelace", email: "ada@example.com" };

function jsonResponse(status: number, body: unknown, headers: Record<string, string> = {}) {
  return {
    ok: status >= 200 && status < 300,
    status,
    headers: { get: (name: string) => headers[name] ?? null },
    json: async () => body,
    text: async () => (body === null ? "" : JSON.stringify(body)),
  };
}

/** A URL-routed LinkedIn double. `onFirstCall` runs inside the first LinkedIn
 * call, before it answers (an admin save made while Connect awaits LinkedIn). */
function linkedInFetch(options: { onFirstCall?: () => void } = {}) {
  let calls = 0;
  return vi.fn(async (input: unknown, init?: { method?: string; body?: string }) => {
    calls += 1;
    if (calls === 1) {
      options.onFirstCall?.();
    }
    const url = String(input);
    if (url === "https://api.linkedin.com/v2/me") {
      return jsonResponse(200, ME);
    }
    if (url === "https://api.linkedin.com/v2/userinfo") {
      return jsonResponse(200, USERINFO);
    }
    if (url === "https://api.linkedin.com/v2/organizationAcls?q=roleAssignee") {
      return jsonResponse(200, { elements: [{ organization: "urn:li:organization:42" }] });
    }
    if (url === "https://api.linkedin.com/v2/organizations/42") {
      return jsonResponse(200, { localizedName: "Example Company" });
    }
    if (url.startsWith("https://api.linkedin.com/rest/organizationAuthorizations/")) {
      // Approved only for the member the v2/me double names.
      const approved = url.includes(encodeURIComponent("urn:li:person:me-1"));
      return jsonResponse(200, { status: approved ? { "com.linkedin.organization.Approved": {} } : {} });
    }
    if (url === "https://api.linkedin.com/v2/ugcPosts" && init?.method === "POST") {
      return jsonResponse(201, null, { "x-restli-id": "urn:li:share:7" });
    }
    return jsonResponse(404, { message: `unexpected ${url}` });
  });
}

function calledUrls(fetchMock: ReturnType<typeof linkedInFetch>) {
  return fetchMock.mock.calls.map((call) => String(call[0]));
}

function activate(
  store: Record<string, Row>,
  options: {
    integrationPair?: { clientId?: string; clientSecret?: string } | null;
    userConnections?: Array<Record<string, unknown>>;
  } = {},
) {
  const nango = {
    isNangoConfigured: vi.fn(() => true),
    getNangoOAuthCallbackUrl: vi.fn(() => "https://app.example.com/api/nango/callback"),
    listSavedNangoConnections: vi.fn(() => options.userConnections ?? []),
    removeNangoConnectionRecord: vi.fn(async () => undefined),
    ensureNangoIntegration: vi.fn(async () => null),
    getNangoConnection: vi.fn(async () => ({
      credentials: { type: "OAUTH2", access_token: "token-abc" },
      end_user: { email: "end-user@example.com" },
    })),
    deleteNangoConnection: vi.fn(async () => undefined),
    getNangoOAuth2IntegrationCredentials: vi.fn(async () => options.integrationPair ?? null),
    providerConfigKeys: { linkedin: "cinatra-linkedin" },
  };
  const impls: Record<string, unknown> = {
    "@cinatra-ai/host:connector-config": {
      read: <T,>(key: string, fallback: T): T => (store[key] as T) ?? fallback,
      write: (key: string, value: unknown) => {
        store[key] = value as Row;
      },
    },
    "nango-system": nango,
    "@cinatra-ai/host:instance-connection-gate": {
      enforceInstanceConnectionUse: vi.fn(async () => ({ gated: true })),
      enforcePerUserInstanceConnectionUse: vi.fn(async () => ({ gated: true })),
    },
  };
  const registerProvider = vi.fn();
  const ctx = {
    capabilities: {
      registerProvider,
      resolveProviders: (capability: string) =>
        impls[capability] !== undefined ? [{ packageName: "@cinatra-ai/host", impl: impls[capability] }] : [],
    },
    logger: { warn: vi.fn(), capture: vi.fn(async () => undefined), captureDirectory: vi.fn(() => "") },
  } as never;
  register(ctx);
  const registration = registerProvider.mock.calls.find((call) => call[0] === "@cinatra-ai/host:linkedin-connection");
  return { service: registration?.[1].impl as PublishedService, nango };
}

const CONNECT = { providerConfigKey: "cinatra-linkedin", connectionId: "conn-1" };

const STORED_ACCOUNT = {
  id: "acc-1",
  memberId: "me-1",
  name: "Ada Lovelace",
  destinations: [
    { id: "me-1", type: "member" as const, name: "Ada Lovelace" },
    { id: "42", type: "organization" as const, name: "Example Company", urn: "urn:li:organization:42" },
  ],
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

describe("LinkedIn company page posting with a Community Management app (organizationPosting)", () => {
  it("A. a CM Connect reads the member through v2/me, never v2/userinfo, and lists the company page", async () => {
    const store: Record<string, Row> = {
      linkedin: { clientId: "cm-id", clientSecret: "cm-secret", organizationPosting: true, accounts: [] },
    };
    const fetchMock = linkedInFetch();
    vi.stubGlobal("fetch", fetchMock);
    const { service } = activate(store);

    await service.saveAccountFromNangoConnection(CONNECT);

    expect(calledUrls(fetchMock)[0]).toBe("https://api.linkedin.com/v2/me");
    expect(calledUrls(fetchMock)).not.toContain("https://api.linkedin.com/v2/userinfo");
    const accounts = (store.linkedin.accounts ?? []) as Array<Record<string, unknown>>;
    expect(accounts[0]).toMatchObject({ id: "conn-1", memberId: "me-1", name: "Ada Lovelace", email: "end-user@example.com" });
    await expect(service.listDestinations()).resolves.toContainEqual(
      expect.objectContaining({
        destinationType: "organization",
        destinationId: "42",
        destinationName: "Example Company",
        authorUrn: "urn:li:organization:42",
      }),
    );
  });

  it("B. Connect keeps organizationPosting: true on the row", async () => {
    const store: Record<string, Row> = {
      linkedin: { clientId: "cm-id", clientSecret: "cm-secret", organizationPosting: true, accounts: [] },
    };
    vi.stubGlobal("fetch", linkedInFetch());
    const { service } = activate(store);

    await service.saveAccountFromNangoConnection(CONNECT);

    expect(store.linkedin).toMatchObject({ clientId: "cm-id", clientSecret: "cm-secret", organizationPosting: true });
  });

  it("C. a CM per-user member post reads the member id through v2/me", async () => {
    const store: Record<string, Row> = {
      linkedin: { clientId: "cm-id", clientSecret: "cm-secret", organizationPosting: true, accounts: [] },
    };
    const fetchMock = linkedInFetch();
    vi.stubGlobal("fetch", fetchMock);
    const { service } = activate(store, {
      userConnections: [
        {
          connectorKey: "linkedin",
          connectionId: "user-conn-1",
          providerConfigKey: "cinatra-linkedin",
          connectedAt: "2026-01-01T00:00:00Z",
          scope: "user",
          userId: "u-1",
        },
      ],
    });

    await expect(
      service.publishPost({
        linkedinAccountId: "user-conn-1",
        destinationType: "member",
        destinationId: "user-conn-1",
        content: "hello",
        userId: "u-1",
      }),
    ).resolves.toMatchObject({ postUrn: "urn:li:share:7" });

    expect(calledUrls(fetchMock)).toEqual(["https://api.linkedin.com/v2/me", "https://api.linkedin.com/v2/ugcPosts"]);
    const body = JSON.parse(String(fetchMock.mock.calls[1][1]?.body)) as { author?: string };
    expect(body.author).toBe("urn:li:person:me-1");
  });

  it("D. a CM page post from an account makes only the ugcPosts call, with the organization author", async () => {
    const store: Record<string, Row> = {
      linkedin: {
        clientId: "cm-id",
        clientSecret: "cm-secret",
        organizationPosting: true,
        accounts: [STORED_ACCOUNT],
      },
    };
    const fetchMock = linkedInFetch();
    vi.stubGlobal("fetch", fetchMock);
    const { service } = activate(store);

    await expect(
      service.publishPost({
        linkedinAccountId: "acc-1",
        destinationType: "organization",
        destinationId: "42",
        content: "hello",
      }),
    ).resolves.toMatchObject({ postUrn: "urn:li:share:7" });

    expect(calledUrls(fetchMock)).toEqual(["https://api.linkedin.com/v2/ugcPosts"]);
    const body = JSON.parse(String(fetchMock.mock.calls[0][1]?.body)) as { author?: string };
    expect(body.author).toBe("urn:li:organization:42");
  });

  it("E. with no flag, Connect reads v2/userinfo first and never v2/me", async () => {
    const store: Record<string, Row> = {
      linkedin: { clientId: "openid-id", clientSecret: "openid-secret", accounts: [] },
    };
    const fetchMock = linkedInFetch();
    vi.stubGlobal("fetch", fetchMock);
    const { service } = activate(store);

    await service.saveAccountFromNangoConnection(CONNECT);

    expect(calledUrls(fetchMock)[0]).toBe("https://api.linkedin.com/v2/userinfo");
    expect(calledUrls(fetchMock)).not.toContain("https://api.linkedin.com/v2/me");
    const accounts = (store.linkedin.accounts ?? []) as Array<Record<string, unknown>>;
    expect(accounts[0]).toMatchObject({ id: "conn-1", memberId: "oidc-1", name: "Ada Lovelace", email: "ada@example.com" });
  });

  it("G. an admin who unticks the box while Connect awaits LinkedIn is not reverted", async () => {
    const store: Record<string, Row> = {
      linkedin: { clientId: "cm-id", clientSecret: "cm-secret", organizationPosting: true, accounts: [] },
    };
    vi.stubGlobal(
      "fetch",
      linkedInFetch({
        onFirstCall: () => {
          store.linkedin = { ...store.linkedin, organizationPosting: false };
        },
      }),
    );
    const { service } = activate(store);

    await service.saveAccountFromNangoConnection(CONNECT);

    expect(store.linkedin.organizationPosting).toBe(false);
    expect(store.linkedin).toMatchObject({ clientId: "cm-id", clientSecret: "cm-secret" });
  });

  it("G2. a CM pair and box saved while an OpenID Connect awaits LinkedIn are kept together", async () => {
    const store: Record<string, Row> = {
      linkedin: { clientId: "openid-id", clientSecret: "openid-secret", accounts: [] },
    };
    vi.stubGlobal(
      "fetch",
      linkedInFetch({
        onFirstCall: () => {
          store.linkedin = { ...store.linkedin, clientId: "cm-id", clientSecret: "cm-secret", organizationPosting: true };
        },
      }),
    );
    const { service } = activate(store);

    await service.saveAccountFromNangoConnection(CONNECT);

    expect(store.linkedin).toMatchObject({ clientId: "cm-id", clientSecret: "cm-secret", organizationPosting: true });
    const accounts = (store.linkedin.accounts ?? []) as Array<Record<string, unknown>>;
    expect(accounts[0]).toMatchObject({ id: "conn-1" });
  });

  it("H. with the flag on, getSettings returns the row's CM pair over the integration's older OpenID pair", async () => {
    const store: Record<string, Row> = {
      linkedin: { clientId: "cm-id", clientSecret: "cm-secret", organizationPosting: true, accounts: [] },
    };
    const { service } = activate(store, { integrationPair: { clientId: "openid-id", clientSecret: "openid-secret" } });

    const settings = await service.getSettings();

    expect(settings.clientId).toBe("cm-id");
    expect(settings.clientSecret).toBe("cm-secret");
  });

  it("H2. with the flag on and only a client id on the row, getSettings returns no client pair", async () => {
    const store: Record<string, Row> = {
      linkedin: { clientId: "cm-id", organizationPosting: true, accounts: [] },
    };
    const { service } = activate(store, { integrationPair: { clientId: "openid-id", clientSecret: "openid-secret" } });

    const settings = await service.getSettings();

    expect(settings.clientId).toBeUndefined();
    expect(settings.clientSecret).toBeUndefined();
  });

  it("I. with no flag, the integration's pair still wins", async () => {
    const store: Record<string, Row> = {
      linkedin: { clientId: "row-id", clientSecret: "row-secret", accounts: [] },
    };
    const { service } = activate(store, { integrationPair: { clientId: "openid-id", clientSecret: "openid-secret" } });

    const settings = await service.getSettings();

    expect(settings.clientId).toBe("openid-id");
    expect(settings.clientSecret).toBe("openid-secret");
  });

  // Only the boolean `true` turns the flag on: a stored string or number, even
  // "true", is a malformed row and takes the identity road (userinfo) as with no flag.
  const NON_BOOLEAN_FLAGS: unknown[] = ["false", "true", "", 1];

  it.each(NON_BOOLEAN_FLAGS)(
    "J. a non-boolean stored flag (%j) is not the flag: Connect reads v2/userinfo first, never v2/me, and the row keeps no flag",
    async (flag) => {
      const store: Record<string, Row> = {
        linkedin: { clientId: "openid-id", clientSecret: "openid-secret", organizationPosting: flag, accounts: [] },
      };
      const fetchMock = linkedInFetch();
      vi.stubGlobal("fetch", fetchMock);
      const { service } = activate(store);

      await service.saveAccountFromNangoConnection(CONNECT);

      expect(calledUrls(fetchMock)[0]).toBe("https://api.linkedin.com/v2/userinfo");
      expect(calledUrls(fetchMock)).not.toContain("https://api.linkedin.com/v2/me");
      const accounts = (store.linkedin.accounts ?? []) as Array<Record<string, unknown>>;
      expect(accounts[0]).toMatchObject({ id: "conn-1", memberId: "oidc-1", name: "Ada Lovelace", email: "ada@example.com" });
      expect(store.linkedin.organizationPosting).toBe(false);
    },
  );

  it.each(NON_BOOLEAN_FLAGS)(
    "J2. a non-boolean stored flag (%j) leaves the per-user member post on v2/userinfo, never v2/me",
    async (flag) => {
      const store: Record<string, Row> = {
        linkedin: { clientId: "openid-id", clientSecret: "openid-secret", organizationPosting: flag, accounts: [] },
      };
      const fetchMock = linkedInFetch();
      vi.stubGlobal("fetch", fetchMock);
      const { service } = activate(store, {
        userConnections: [
          {
            connectorKey: "linkedin",
            connectionId: "user-conn-1",
            providerConfigKey: "cinatra-linkedin",
            connectedAt: "2026-01-01T00:00:00Z",
            scope: "user",
            userId: "u-1",
          },
        ],
      });

      await expect(
        service.publishPost({
          linkedinAccountId: "user-conn-1",
          destinationType: "member",
          destinationId: "user-conn-1",
          content: "hello",
          userId: "u-1",
        }),
      ).resolves.toMatchObject({ postUrn: "urn:li:share:7" });

      expect(calledUrls(fetchMock)).toEqual(["https://api.linkedin.com/v2/userinfo", "https://api.linkedin.com/v2/ugcPosts"]);
      const body = JSON.parse(String(fetchMock.mock.calls[1][1]?.body)) as { author?: string };
      expect(body.author).toBe("urn:li:person:oidc-1");
    },
  );

  it.each(NON_BOOLEAN_FLAGS)(
    "J3. a non-boolean stored flag (%j) leaves getSettings on the integration's pair, as with no flag",
    async (flag) => {
      const store: Record<string, Row> = {
        linkedin: { clientId: "row-id", clientSecret: "row-secret", organizationPosting: flag, accounts: [] },
      };
      const { service } = activate(store, { integrationPair: { clientId: "openid-id", clientSecret: "openid-secret" } });

      const settings = await service.getSettings();

      expect(settings.clientId).toBe("openid-id");
      expect(settings.clientSecret).toBe("openid-secret");
    },
  );
});
