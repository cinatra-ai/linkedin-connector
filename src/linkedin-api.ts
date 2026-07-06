// The LinkedIn API client — RELOCATED from cinatra core `src/lib/linkedin-api.ts`
// (cinatra#975 Wave 3, epic #978: connector-registered instance capabilities
// replace core vendor API clients). This connector now OWNS the client; core's
// copy is evicted by the follow-up core PR once every connector slice merges.
//
// Behavior is byte-equivalent to the core client it replaces, with the two
// sanctioned boundary substitutions of the contracts lane:
//   - persistence/credentials/authz reach the host ONLY through published
//     capabilities (`@cinatra-ai/host:connector-config`, the connector-authored
//     `nango-system` surface, and the `@cinatra-ai/host:instance-connection-gate`
//     seam of cinatra#1077 — authz itself stays core, #975). Every host surface
//     is resolved LAZILY at call time and FAILS LOUD when unresolved.
//   - the request/response file log (pre-#981: a direct `node:fs` write under
//     `data/logs/linkedin-api/`) routes through the host-owned
//     `ctx.logger.capture` channel (cinatra#981; `node:fs` is banned in
//     extension source by the cinatra#979 conformance gate). The
//     enabled/redaction policy stays extension-owned and unchanged: the same
//     `loggingEnabled` settings gate, the same entry labels/kinds/bodies —
//     secret values (bearer tokens, client secrets) are never logged, exactly
//     as before.
//
// Audit-source parity: the per-connection use-gate calls keep the EXACT
// `source: "linkedin-api"` labels the core client emits, so audit rows are
// indistinguishable across the relocation.
//
// `fetchWithTimeout` is a pure relocated copy (`./lib/fetch-with-timeout`) —
// a neutral helper, not a host surface.

import { fetchWithTimeout } from "./lib/fetch-with-timeout";

const LINKEDIN_API_VERSION = "202603";

/** The connector-config row key shared with the admin half
 * (`@cinatra-ai/linkedin-oauth-connector` writes the same "linkedin" row). */
const LINKEDIN_CONFIG_KEY = "linkedin";

/** The open nango connector vendor key this client's connections live under. */
const LINKEDIN_CONNECTOR_KEY = "linkedin";

const LINKEDIN_OAUTH_SCOPES = [
  "openid",
  "profile",
  "email",
  "w_member_social",
].join(" ");

// ---------------------------------------------------------------------------
// Host surfaces (local STRUCTURAL shapes — the serverEntry graph keeps SDK
// imports type-only, so the shapes are declared here and the impls arrive as
// DATA through `ctx.capabilities` / `ctx.logger`, adapted by ./register.ts).
// ---------------------------------------------------------------------------

/** The generic host connector-config KV service
 * (`@cinatra-ai/host:connector-config`) — sync, exactly the
 * `readConnectorConfigFromDatabase` / `writeConnectorConfigToDatabase` pair
 * the core client called. */
export type LinkedInConnectorConfigSurface = {
  read<T>(connectorId: string, fallback: T): T;
  write(connectorId: string, value: unknown): void;
};

/** The subset of the connector-authored `nango-system` capability surface this
 * client uses (structural mirror of `NangoSystemSurface` — import-era
 * signatures preserved; sync stays sync). */
export type LinkedInNangoSurface = {
  isNangoConfigured(): boolean;
  getNangoOAuthCallbackUrl(): string;
  listSavedNangoConnections(
    connectorKey: string,
    options?: { scope?: "app" | "user"; userId?: string },
  ): Array<{
    connectorKey: string;
    connectionId: string;
    providerConfigKey: string;
    connectedAt: string;
    scope?: "app" | "user";
    userId?: string;
    displayName?: string;
    email?: string;
  }>;
  removeNangoConnectionRecord(
    connectorKey: string,
    connectionId: string,
    options?: { scope?: "app" | "user"; userId?: string },
  ): Promise<void>;
  ensureNangoIntegration(input: {
    provider: string;
    providerConfigKey: string;
    displayName: string;
    credentials?: {
      type: "OAUTH2";
      client_id: string;
      client_secret: string;
      scopes?: string;
    };
  }): Promise<unknown>;
  getNangoConnection(
    providerConfigKey: string,
    connectionId: string,
    options?: { forceRefresh?: boolean; refreshToken?: boolean },
  ): Promise<{
    credentials?: { type?: string; [k: string]: unknown };
    end_user?: { display_name?: string | null; email?: string | null } | null;
    [k: string]: unknown;
  } | null>;
  deleteNangoConnection(providerConfigKey: string, connectionId: string): Promise<void>;
  getNangoOAuth2IntegrationCredentials(
    providerConfigKey: string,
  ): Promise<{ clientId?: string; clientSecret?: string; scopes?: string } | null>;
  /** Const provider-config key map (single author: the nango connector). */
  providerConfigKeys: Readonly<Record<string, string>>;
};

/** The per-instance connection use-gate seam
 * (`@cinatra-ai/host:instance-connection-gate`, cinatra#1077 — #975 Wave 3
 * prerequisite). Gate decision/audit/actor construction stay HOST-SIDE; a
 * deny THROWS fail-closed out of the enforce members; `{ gated: false }`
 * preserves the pre-#967 ungated fallback the core client carried. */
export type LinkedInConnectionGateSurface = {
  enforceInstanceConnectionUse(input: {
    connectorKey: string;
    connectionId: string;
    binding?: { orgId?: string; runBy?: string };
    source: string;
    runId?: string;
  }): Promise<{ gated: boolean }>;
  enforcePerUserInstanceConnectionUse(input: {
    connectorKey: string;
    connectionId: string;
    userId: string;
    source: string;
    runId?: string;
  }): Promise<{ gated: boolean }>;
};

/** The lazily-resolving host bindings ./register.ts constructs from `ctx`.
 * Each accessor resolves its capability AT CALL TIME (probe-safe) and FAILS
 * LOUD when the surface is unresolved. `capture`/`captureDirectory` adapt the
 * ambient `ctx.logger` #981 members (see ./register.ts for the skew posture:
 * a pre-2.3.0 host without `logger.capture` degrades to a warn-once skip —
 * telemetry only, never the API behavior). */
export type LinkedInApiHost = {
  config(): LinkedInConnectorConfigSurface;
  nango(): LinkedInNangoSurface;
  gate(): LinkedInConnectionGateSurface;
  capture(entry: { label: string; kind: string; body: unknown }): Promise<void>;
  captureDirectory(): string;
};

// ---------------------------------------------------------------------------
// Domain shapes (unchanged from the core client).
// ---------------------------------------------------------------------------

type LinkedInDestination = {
  id: string;
  type: "member" | "organization";
  name: string;
  urn?: string;
};

export type LinkedInAccountConnection = {
  id: string;
  memberId: string;
  name: string;
  email?: string;
  accessToken?: string;
  tokenExpiresAt?: string;
  profileUrl?: string;
  destinations: LinkedInDestination[];
  createdAt: string;
  updatedAt: string;
};

type LinkedInAPISettings = {
  clientId?: string;
  clientSecret?: string;
  redirectUri?: string;
  accounts: LinkedInAccountConnection[];
  loggingEnabled?: boolean;
};

type LinkedInUserInfoResponse = {
  sub?: string;
  name?: string;
  given_name?: string;
  family_name?: string;
  email?: string;
  picture?: string;
};

type LinkedInOrganizationAclResponse = {
  elements?: Array<Record<string, unknown>>;
};

type LinkedInOrganizationResponse = {
  localizedName?: string;
  vanityName?: string;
  name?: string;
};

type LinkedInPublishResponse = {
  id?: string;
};

type LinkedInDestinationOption = {
  linkedinAccountId: string;
  linkedinAccountName: string;
  destinationType: "member" | "organization";
  destinationId: string;
  destinationName: string;
  authorUrn: string;
};

type LinkedInOrganizationAuthorizationResponse = {
  status?: Record<string, unknown>;
};

export type LinkedInApiClient = ReturnType<typeof createLinkedInApiClient>;

function nowIso() {
  return new Date().toISOString();
}

function normalizeLinkedInRedirectUri(value?: string) {
  const trimmed = String(value ?? "").trim();
  if (!trimmed) {
    return "";
  }

  const withProtocol = /^https?:\/\//i.test(trimmed) ? trimmed : `http://${trimmed}`;

  try {
    const url = new URL(withProtocol);
    url.hash = "";
    return url.toString();
  } catch {
    throw new Error("Enter a valid absolute LinkedIn redirect URI, for example http://localhost:3000/api/apps/linkedin/oauth/callback.");
  }
}

function readStoredLinkedInRedirectUri(value?: string) {
  const trimmed = String(value ?? "").trim();
  return trimmed;
}

function buildLinkedInHeaders(accessToken: string) {
  return {
    Authorization: `Bearer ${accessToken}`,
    "X-Restli-Protocol-Version": "2.0.0",
    "Linkedin-Version": LINKEDIN_API_VERSION,
  };
}

function extractOrganizationId(value: unknown) {
  if (typeof value !== "string") {
    return "";
  }
  const match = value.match(/urn:li:organization:(\d+)/i);
  return match?.[1] ?? "";
}

function buildMemberUrn(memberId: string) {
  return `urn:li:person:${memberId}`;
}

function buildOrganizationUrn(organizationId: string) {
  return `urn:li:organization:${organizationId}`;
}

function isLinkedInAuthorizationApproved(payload: LinkedInOrganizationAuthorizationResponse | null) {
  if (!payload?.status || typeof payload.status !== "object") {
    return false;
  }
  return Object.keys(payload.status).some((key) => key === "com.linkedin.organization.Approved");
}

function isLinkedInConfigured(settings: LinkedInAPISettings) {
  return Boolean(settings.clientId && settings.clientSecret && settings.redirectUri);
}

function inferLinkedInPostUrl(postUrn: string) {
  return `https://www.linkedin.com/feed/update/${encodeURIComponent(postUrn)}/`;
}

/**
 * Build the connector-owned LinkedIn API client over the lazily-resolving host
 * bindings. Construction does NO host-surface resolution and no I/O
 * (probe-safe) — every member resolves its surfaces at call time.
 */
export function createLinkedInApiClient(host: LinkedInApiHost) {
  /** The Nango provider-config key for LinkedIn, from the nango-system
   * surface's const key map (single author: the nango connector — the core
   * client read the same map via `CINATRA_NANGO_PROVIDER_CONFIG_KEYS`).
   * Fail-loud when the surface publishes no LinkedIn key. */
  function linkedinProviderConfigKey(): string {
    const key = host.nango().providerConfigKeys?.[LINKEDIN_CONNECTOR_KEY];
    if (!key) {
      throw new Error(
        "@cinatra-ai/linkedin-connector: the nango-system surface publishes no " +
          `"${LINKEDIN_CONNECTOR_KEY}" provider-config key — refusing to guess one.`,
      );
    }
    return key;
  }

  function isLinkedInLoggingEnabled() {
    return readSettings().loggingEnabled !== false;
  }

  /** Request/response capture — pre-#981 this was a direct `node:fs` write
   * under `data/logs/linkedin-api/`; it now routes through the host-owned
   * `ctx.logger.capture` channel (storage/rotation host-side). The
   * enabled-gate and the entry shape (label/kind/body, string bodies wrapped
   * as `{ raw }`) are unchanged. Secret material (bearer tokens, client
   * secrets) is never part of an entry — identical to the core client. */
  async function writeLinkedInLogFile(input: {
    label: string;
    kind: "request" | "response";
    body: unknown;
  }) {
    if (!isLinkedInLoggingEnabled()) {
      return;
    }

    const content = typeof input.body === "string" ? { raw: input.body } : input.body;
    await host.capture({ label: input.label, kind: input.kind, body: content });
  }

  function readSettings(): LinkedInAPISettings {
    const stored = host.config().read<LinkedInAPISettings>(LINKEDIN_CONFIG_KEY, { accounts: [] });
    return {
      clientId: typeof stored.clientId === "string" && stored.clientId.trim() ? stored.clientId.trim() : undefined,
      clientSecret: typeof stored.clientSecret === "string" && stored.clientSecret.trim() ? stored.clientSecret.trim() : undefined,
      redirectUri: readStoredLinkedInRedirectUri(stored.redirectUri),
      accounts: Array.isArray(stored.accounts)
        ? stored.accounts
            .map((account) => ({
              id: String(account.id ?? ""),
              memberId: String(account.memberId ?? ""),
              name: String(account.name ?? "").trim(),
              email: typeof account.email === "string" && account.email.trim() ? account.email.trim() : undefined,
              accessToken: String(account.accessToken ?? "").trim(),
              tokenExpiresAt:
                typeof account.tokenExpiresAt === "string" && account.tokenExpiresAt.trim() ? account.tokenExpiresAt : undefined,
              profileUrl:
                typeof account.profileUrl === "string" && account.profileUrl.trim() ? account.profileUrl.trim() : undefined,
              destinations: Array.isArray(account.destinations)
                ? account.destinations
                    .map(
                      (destination): LinkedInDestination => ({
                        id: String(destination.id ?? ""),
                        type: destination.type === "organization" ? "organization" : "member",
                        name: String(destination.name ?? "").trim(),
                        urn: typeof destination.urn === "string" && destination.urn.trim() ? destination.urn.trim() : undefined,
                      }),
                    )
                    .filter((destination) => destination.id && destination.name)
                : [],
              createdAt: typeof account.createdAt === "string" && account.createdAt.trim() ? account.createdAt : nowIso(),
              updatedAt: typeof account.updatedAt === "string" && account.updatedAt.trim() ? account.updatedAt : nowIso(),
            }))
            .filter((account) => account.id && account.memberId && account.name)
        : [],
      loggingEnabled: stored.loggingEnabled ?? true,
    };
  }

  function writeSettings(value: LinkedInAPISettings) {
    host.config().write(LINKEDIN_CONFIG_KEY, {
      clientId: value.clientId,
      clientSecret: value.clientSecret,
      accounts: value.accounts,
      loggingEnabled: value.loggingEnabled,
      redirectUri: value.redirectUri,
    });
  }

  async function fetchLinkedInJson<T>(url: string, accessToken: string) {
    await writeLinkedInLogFile({
      label: "linkedin-api",
      kind: "request",
      body: {
        endpoint: url,
        method: "GET",
      },
    });
    const response = await fetchWithTimeout(url, {
      headers: buildLinkedInHeaders(accessToken),
      cache: "no-store",
    });
    const payload = (await response.json().catch(() => null)) as (T & { message?: string; error_description?: string }) | null;
    await writeLinkedInLogFile({
      label: "linkedin-api",
      kind: "response",
      body: {
        endpoint: url,
        status: response.status,
        body: payload,
      },
    });
    if (!response.ok) {
      throw new Error(payload?.message || payload?.error_description || "LinkedIn API request failed.");
    }
    return payload;
  }

  async function resolveLinkedInAccessToken(account: LinkedInAccountConnection) {
    if (!host.nango().isNangoConfigured()) {
      throw new Error("Configure Nango first so LinkedIn API requests can authenticate through Nango.");
    }

    // Owner-aware resolver routing (cinatra#967, W3 residue of #952/#953):
    // resolve (self-heal seeding when absent) the account connection's
    // identity row and gate + audit this credential use through the W2
    // use-gate — via the `instance-connection-gate` seam (cinatra#1077): the
    // decision/audit/actor stay host-side; a DENY throws fail-closed here;
    // `{ gated: false }` keeps the pre-#967 ungated fallback. LinkedIn
    // accounts carry no {orgId, runBy} multi-tenant binding (unlike
    // wordpress/drupal), so an unseeded identity falls back to the
    // single-tenant default owner/org.
    await host.gate().enforceInstanceConnectionUse({
      connectorKey: LINKEDIN_CONNECTOR_KEY,
      connectionId: account.id,
      source: "linkedin-api",
    });

    const connection = await host.nango().getNangoConnection(
      linkedinProviderConfigKey(),
      account.id,
      { forceRefresh: true, refreshToken: true },
    );
    const credentials = (connection as {
      credentials?: {
        type?: string;
        access_token?: string;
      };
    } | null)?.credentials;

    if (credentials?.type === "OAUTH2" && typeof credentials.access_token === "string" && credentials.access_token.trim()) {
      return credentials.access_token;
    }

    throw new Error("Unable to load the LinkedIn access token from Nango.");
  }

  async function readLinkedInUserConnection(input: {
    connectionId: string;
    userId: string;
  }) {
    const savedConnection = host
      .nango()
      .listSavedNangoConnections(LINKEDIN_CONNECTOR_KEY, {
        scope: "user",
        userId: input.userId,
      })
      .find((entry) => entry.connectionId === input.connectionId);
    if (!savedConnection) {
      return null;
    }

    // Owner-aware resolver routing (cinatra#967, W3 residue): this is a
    // strictly per-user (`scope:"user"`) LinkedIn connection with a REAL
    // actor already in hand (`input.userId`) — seed (self-heal) a null-org
    // identity row owned by that exact user, then gate + audit the read as
    // that HumanUser (never a fabricated worker actor; the actor IS the
    // connection owner by construction).
    await host.gate().enforcePerUserInstanceConnectionUse({
      connectorKey: LINKEDIN_CONNECTOR_KEY,
      connectionId: savedConnection.connectionId,
      userId: input.userId,
      source: "linkedin-api",
    });

    const connection = await host.nango().getNangoConnection(savedConnection.providerConfigKey, savedConnection.connectionId, {
      forceRefresh: true,
      refreshToken: true,
    });
    const credentials = (connection as
      | {
          credentials?: {
            type?: string;
            access_token?: string;
          };
        }
      | null)?.credentials;

    if (credentials?.type !== "OAUTH2" || typeof credentials.access_token !== "string" || !credentials.access_token.trim()) {
      throw new Error("Unable to load the LinkedIn access token from Nango.");
    }

    return {
      accessToken: credentials.access_token,
      savedConnection,
    };
  }

  async function listManagedOrganizationDestinations(accessToken: string): Promise<LinkedInDestination[]> {
    try {
      const aclPayload = await fetchLinkedInJson<LinkedInOrganizationAclResponse>(
        "https://api.linkedin.com/v2/organizationAcls?q=roleAssignee",
        accessToken,
      );
      if (!aclPayload) {
        return [];
      }
      const organizationIds = Array.from(
        new Set(
          (aclPayload.elements ?? [])
            .map((entry) =>
              extractOrganizationId(
                (entry.organization as string | undefined) ??
                  (entry.organizationalTarget as string | undefined) ??
                  (entry.organizationTarget as string | undefined),
              ),
            )
            .filter(Boolean),
        ),
      );

      const organizations = await Promise.all(
        organizationIds.map(async (organizationId) => {
          try {
            const organization = await fetchLinkedInJson<LinkedInOrganizationResponse>(
              `https://api.linkedin.com/v2/organizations/${encodeURIComponent(organizationId)}`,
              accessToken,
            );
            if (!organization) {
              return null;
            }
            const name = organization.localizedName?.trim() || organization.name?.trim() || `Organization ${organizationId}`;
            return {
              id: organizationId,
              type: "organization" as const,
              name,
              urn: `urn:li:organization:${organizationId}`,
            };
          } catch {
            return null;
          }
        }),
      );

      return organizations.filter(Boolean) as LinkedInDestination[];
    } catch {
      return [];
    }
  }

  async function memberCanCreateOrganicOrganizationPost(input: {
    accessToken: string;
    memberUrn: string;
    organizationUrn: string;
  }) {
    const encodedImpersonator = encodeURIComponent(input.memberUrn);
    const encodedOrganization = encodeURIComponent(input.organizationUrn);
    const url =
      `https://api.linkedin.com/rest/organizationAuthorizations/` +
      `(impersonator:${encodedImpersonator},organization:${encodedOrganization},action:(organizationContentAuthorizationAction:(actionType:ORGANIC_SHARE_CREATE)))`;

    try {
      const payload = await fetchLinkedInJson<LinkedInOrganizationAuthorizationResponse>(url, input.accessToken);
      return isLinkedInAuthorizationApproved(payload);
    } catch {
      return false;
    }
  }

  async function listAuthorizedOrganizationDestinations(input: {
    accessToken: string;
    memberId: string;
  }): Promise<LinkedInDestination[]> {
    const administeredOrganizations = await listManagedOrganizationDestinations(input.accessToken);
    if (administeredOrganizations.length === 0) {
      return [];
    }

    const memberUrn = buildMemberUrn(input.memberId);
    const authorizedOrganizations = await Promise.all(
      administeredOrganizations.map(async (organization) => {
        const organizationUrn = organization.urn ?? buildOrganizationUrn(organization.id);
        const approved = await memberCanCreateOrganicOrganizationPost({
          accessToken: input.accessToken,
          memberUrn,
          organizationUrn,
        });
        return approved
          ? {
              ...organization,
              urn: organizationUrn,
            }
          : null;
      }),
    );

    return authorizedOrganizations.filter(Boolean) as LinkedInDestination[];
  }

  async function getLinkedInAPISettings() {
    const stored = readSettings();
    const nangoCredentials = await host
      .nango()
      .getNangoOAuth2IntegrationCredentials(linkedinProviderConfigKey());

    return {
      ...stored,
      clientId: nangoCredentials?.clientId || stored.clientId,
      clientSecret: nangoCredentials?.clientSecret || stored.clientSecret,
      redirectUri: stored.redirectUri || normalizeLinkedInRedirectUri(host.nango().getNangoOAuthCallbackUrl()),
    };
  }

  function getLinkedInLoggingSettings() {
    const settings = readSettings();
    return {
      enabled: settings.loggingEnabled !== false,
      // The host-owned #981 capture directory replaces the pre-relocation
      // `data/logs/linkedin-api` path (read-only display value).
      directory: host.captureDirectory(),
    };
  }

  async function listLinkedInAccounts() {
    return readSettings().accounts.sort((left, right) => right.updatedAt.localeCompare(left.updatedAt));
  }

  async function readLinkedInAccountById(accountId: string) {
    return (await listLinkedInAccounts()).find((account) => account.id === accountId) ?? null;
  }

  async function listLinkedInDestinations(options?: {
    scope?: "app" | "user";
    userId?: string;
  }): Promise<LinkedInDestinationOption[]> {
    if (options?.scope === "user") {
      const connections = options.userId
        ? host.nango().listSavedNangoConnections(LINKEDIN_CONNECTOR_KEY, {
            scope: "user",
            userId: options.userId,
          })
        : host
            .nango()
            .listSavedNangoConnections(LINKEDIN_CONNECTOR_KEY)
            .filter((connection) => (connection.scope ?? "app") === "user");

      return connections.map((connection) => {
        const profileName =
          String(connection.displayName ?? "").trim() ||
          String(connection.email ?? "").trim() ||
          "LinkedIn profile";

        return {
          linkedinAccountId: connection.connectionId,
          linkedinAccountName: profileName,
          destinationType: "member" as const,
          destinationId: connection.connectionId,
          destinationName: profileName,
          authorUrn: "",
        };
      });
    }

    const accounts = await listLinkedInAccounts();
    return accounts.flatMap((account) =>
      account.destinations.map((destination) => ({
        linkedinAccountId: account.id,
        linkedinAccountName: account.name,
        destinationType: destination.type,
        destinationId: destination.id,
        destinationName: destination.name,
        authorUrn:
          destination.type === "organization"
            ? destination.urn ?? buildOrganizationUrn(destination.id)
            : destination.urn ?? buildMemberUrn(account.memberId),
      })),
    );
  }

  async function getLinkedInAPIStatus() {
    const settings = await getLinkedInAPISettings();
    const nangoConnections = host.nango().listSavedNangoConnections(LINKEDIN_CONNECTOR_KEY);
    if (nangoConnections.length > 0) {
      return {
        status: "connected" as const,
        detail:
          nangoConnections.length === 1
            ? "1 LinkedIn connection is available."
            : `${nangoConnections.length} LinkedIn connections are available.`,
      };
    }
    if (settings.accounts.length > 0) {
      return {
        status: "connected" as const,
        detail:
          settings.accounts.length === 1
            ? "1 LinkedIn account is connected."
            : `${settings.accounts.length} LinkedIn accounts are connected.`,
      };
    }

    if (isLinkedInConfigured(settings)) {
      return {
        status: "connected" as const,
        detail: "LinkedIn OAuth is configured for Cinatra.",
      };
    }

    return {
      status: "not_connected" as const,
      detail: "Configure LinkedIn OAuth to connect profiles and managed company pages.",
    };
  }

  async function ensureLinkedInIntegration(settings: LinkedInAPISettings) {
    if (!settings.clientId || !settings.clientSecret) {
      return;
    }

    await host.nango().ensureNangoIntegration({
      provider: "linkedin",
      providerConfigKey: linkedinProviderConfigKey(),
      displayName: "Cinatra LinkedIn",
      credentials: {
        type: "OAUTH2",
        client_id: settings.clientId,
        client_secret: settings.clientSecret,
        scopes: LINKEDIN_OAUTH_SCOPES,
      },
    });
  }

  async function saveLinkedInOAuthSettings(input: {
    clientId?: string;
    clientSecret?: string;
  }) {
    const current = await getLinkedInAPISettings();
    const normalizedRedirectUri = normalizeLinkedInRedirectUri(host.nango().getNangoOAuthCallbackUrl());
    const nextSettings: LinkedInAPISettings = {
      ...current,
      clientId: input.clientId?.trim() || current.clientId,
      clientSecret: input.clientSecret?.trim() || current.clientSecret,
      redirectUri: normalizedRedirectUri,
      accounts: current.accounts,
      loggingEnabled: current.loggingEnabled,
    };
    await ensureLinkedInIntegration(nextSettings);
    writeSettings({
      ...nextSettings,
    });
    return nextSettings;
  }

  async function saveLinkedInLoggingSettings(enabled: boolean) {
    const current = readSettings();
    writeSettings({
      ...current,
      loggingEnabled: enabled,
    });
  }

  async function saveLinkedInAccountFromNangoConnection(input: {
    providerConfigKey: string;
    connectionId: string;
  }) {
    const settings = readSettings();

    // NOT gated here (codex round-1 finding, reverting an earlier round-0
    // over-fix). This function is the materializer the generic
    // `/api/nango/connections/save` route invokes DURING
    // `handleNangoConnectionSaveRequest`, BEFORE that route's own POST-save
    // `registerSavedConnectionIdentity` call registers the REAL session
    // {userId, activeOrganizationId} (its PRE-save foreign-identity guard
    // already rejects a request targeting a connection registered to a
    // DIFFERENT owner/org). This function carries NO {orgId, runBy} binding at
    // all, so gating here would ALWAYS self-heal-seed from the single-tenant
    // FALLBACK owner — racing, and potentially conflicting with, the route's
    // real-session registration that runs right after (a spurious 409 on a
    // legitimate first save). This call path is ALREADY fully authorized by
    // that surrounding route machinery — it is not part of the w3-residue this
    // module exists to close. `resolveLinkedInAccessToken` and
    // `readLinkedInUserConnection` (the genuinely bypassing publish-time reads)
    // gate in this file.
    const connection = await host.nango().getNangoConnection(input.providerConfigKey, input.connectionId, {
      forceRefresh: true,
      refreshToken: true,
    });
    const credentials = (connection as
      | {
          credentials?: {
            type?: string;
            access_token?: string;
            expires_at?: string | Date;
          };
          end_user?: {
            email?: string;
          };
        }
      | null)?.credentials;

    if (credentials?.type !== "OAUTH2" || typeof credentials.access_token !== "string" || !credentials.access_token.trim()) {
      throw new Error("Unable to load the LinkedIn access token from Nango.");
    }

    const userinfo = await fetchLinkedInJson<LinkedInUserInfoResponse>("https://api.linkedin.com/v2/userinfo", credentials.access_token);
    const memberId = String(userinfo?.sub ?? "").trim();
    const memberName =
      String(userinfo?.name ?? "").trim() ||
      [userinfo?.given_name, userinfo?.family_name].map((value) => String(value ?? "").trim()).filter(Boolean).join(" ");
    if (!memberId || !memberName) {
      throw new Error("Unable to load the LinkedIn member profile.");
    }

    const destinations: LinkedInDestination[] = [
      {
        id: memberId,
        type: "member",
        name: memberName,
      },
      ...(await listAuthorizedOrganizationDestinations({
        accessToken: credentials.access_token,
        memberId,
      })),
    ];

    const updatedAt = nowIso();
    const existing = settings.accounts.find((account) => account.id === input.connectionId || account.memberId === memberId);
    const accountRecord: LinkedInAccountConnection = {
      id: input.connectionId,
      memberId,
      name: memberName,
      email:
        typeof userinfo?.email === "string" && userinfo.email.trim()
          ? userinfo.email.trim()
          : typeof connection?.end_user?.email === "string" && connection.end_user.email.trim()
            ? connection.end_user.email.trim()
            : undefined,
      accessToken: undefined,
      tokenExpiresAt:
        typeof credentials.expires_at === "string"
          ? credentials.expires_at
          : credentials.expires_at instanceof Date
            ? credentials.expires_at.toISOString()
            : undefined,
      profileUrl: undefined,
      destinations,
      createdAt: existing?.createdAt ?? updatedAt,
      updatedAt,
    };

    writeSettings({
      ...settings,
      accounts: [accountRecord, ...settings.accounts.filter((account) => account.id !== input.connectionId && account.memberId !== memberId)],
    });

    return accountRecord;
  }

  async function deleteLinkedInAccount(accountId: string) {
    const current = readSettings();
    await host.nango().deleteNangoConnection(linkedinProviderConfigKey(), accountId);
    await host.nango().removeNangoConnectionRecord(LINKEDIN_CONNECTOR_KEY, accountId);
    writeSettings({
      ...current,
      accounts: current.accounts.filter((account) => account.id !== accountId),
    });
  }

  async function publishLinkedInPost(input: {
    linkedinAccountId: string;
    destinationType: "member" | "organization";
    destinationId: string;
    content: string;
    userId?: string;
  }) {
    const account = await readLinkedInAccountById(input.linkedinAccountId);
    let accessToken = "";
    let memberId = "";

    if (account) {
      accessToken = await resolveLinkedInAccessToken(account);
      memberId = account.memberId;
    } else if (input.userId) {
      const userConnection = await readLinkedInUserConnection({
        connectionId: input.linkedinAccountId,
        userId: input.userId,
      });
      if (!userConnection) {
        throw new Error("LinkedIn account not found.");
      }

      accessToken = userConnection.accessToken;
      const userinfo = await fetchLinkedInJson<LinkedInUserInfoResponse>("https://api.linkedin.com/v2/userinfo", accessToken);
      memberId = String(userinfo?.sub ?? "").trim();
      if (!memberId) {
        throw new Error("Unable to load the LinkedIn member profile.");
      }
    } else {
      throw new Error("LinkedIn account not found.");
    }

    const author =
      input.destinationType === "organization"
        ? buildOrganizationUrn(input.destinationId)
        : buildMemberUrn(memberId);

    const endpoint = "https://api.linkedin.com/v2/ugcPosts";
    const body = {
      author,
      lifecycleState: "PUBLISHED",
      specificContent: {
        "com.linkedin.ugc.ShareContent": {
          shareCommentary: {
            text: input.content,
          },
          shareMediaCategory: "NONE",
        },
      },
      visibility: {
        "com.linkedin.ugc.MemberNetworkVisibility": "PUBLIC",
      },
    };

    await writeLinkedInLogFile({
      label: "linkedin-publish-post",
      kind: "request",
      body: {
        endpoint,
        method: "POST",
        body,
      },
    });

    const response = await fetchWithTimeout(endpoint, {
      method: "POST",
      headers: {
        ...buildLinkedInHeaders(accessToken),
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
      cache: "no-store",
    });

    const text = await response.text();
    let payload: LinkedInPublishResponse | null = null;
    try {
      payload = text ? (JSON.parse(text) as LinkedInPublishResponse) : null;
    } catch {
      payload = null;
    }

    await writeLinkedInLogFile({
      label: "linkedin-publish-post",
      kind: "response",
      body: {
        status: response.status,
        headers: {
          "x-restli-id": response.headers.get("x-restli-id"),
        },
        body: payload ?? text,
      },
    });

    const postUrn = String(payload?.id ?? response.headers.get("x-restli-id") ?? "").trim();
    if (!response.ok || !postUrn) {
      throw new Error("Unable to publish the post on LinkedIn.");
    }

    return {
      postUrn,
      postUrl: inferLinkedInPostUrl(postUrn),
    };
  }

  return {
    getSettings: getLinkedInAPISettings,
    getStatus: getLinkedInAPIStatus,
    getLoggingSettings: getLinkedInLoggingSettings,
    listAccounts: listLinkedInAccounts,
    readAccountById: readLinkedInAccountById,
    listDestinations: listLinkedInDestinations,
    saveOAuthSettings: saveLinkedInOAuthSettings,
    saveLoggingSettings: saveLinkedInLoggingSettings,
    saveAccountFromNangoConnection: saveLinkedInAccountFromNangoConnection,
    deleteAccount: deleteLinkedInAccount,
    publishPost: publishLinkedInPost,
  };
}
