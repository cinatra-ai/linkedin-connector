/**
 * Account-integrity guard for the LinkedIn MCP primitives.
 *
 * `linkedin_post_publish` must bind the acted-on account to the TRUSTED actor
 * of the invocation (built server-side by the host), NEVER to a model-supplied
 * `linkedinUserId`. Without this binding an agent could publish to any user's
 * connected LinkedIn account by naming that user's id in tool input.
 *
 * `linkedin_destinations_list` must filter by the LinkedIn `accountId` it is
 * given, not mis-pass it into the deps' Cinatra-`userId` slot.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

import {
  registerLinkedInConnector,
  _resetLinkedInDepsForTests,
  type LinkedInConnectorDeps,
} from "../deps";
import { createLinkedInPrimitiveHandlers, publishPostSchema } from "../mcp/handlers";
import { registerLinkedInPrimitives, type ConnectorActorResolver } from "../mcp/registry";

const publishMock = vi.fn(async () => ({ postUrn: "urn:li:share:1", postUrl: "https://x/1" }));
const listDestinationsMock = vi.fn(async () => [
  {
    linkedinAccountId: "acc-1",
    linkedinAccountName: "Ada",
    destinationType: "member" as const,
    destinationId: "d-1",
    destinationName: "Ada",
    authorUrn: "urn:li:person:1",
  },
  {
    linkedinAccountId: "acc-2",
    linkedinAccountName: "Grace",
    destinationType: "member" as const,
    destinationId: "d-2",
    destinationName: "Grace",
    authorUrn: "urn:li:person:2",
  },
]);

function stubDeps(): LinkedInConnectorDeps {
  return {
    getStatus: vi.fn(async () => ({ status: "connected" as const, detail: "ok" })),
    getSettings: vi.fn(async () => ({ accounts: [] })),
    listAccounts: vi.fn(async () => []),
    listDestinations: listDestinationsMock,
    publishPost: publishMock,
  };
}

const PUBLISH_INPUT = {
  accountId: "acc-1",
  destinationType: "member" as const,
  destinationId: "d-1",
  content: "hello",
};

beforeEach(() => {
  vi.clearAllMocks();
  _resetLinkedInDepsForTests();
});

describe("linkedin MCP primitives — identity is bound to the trusted actor, not input", () => {
  it("the publish input schema does not expose a `linkedinUserId` field", () => {
    expect(Object.keys(publishPostSchema.shape)).not.toContain("linkedinUserId");
  });

  it("linkedin_post_publish scopes publish to the trusted actor userId", async () => {
    registerLinkedInConnector(stubDeps());
    const handlers = createLinkedInPrimitiveHandlers();
    await handlers.linkedin_post_publish({
      primitiveName: "linkedin_post_publish",
      input: PUBLISH_INPUT,
      actor: { actorType: "human", source: "a2a", userId: "trusted-user" },
      mode: "agentic",
    });
    expect(publishMock).toHaveBeenCalledWith({
      linkedinAccountId: "acc-1",
      destinationType: "member",
      destinationId: "d-1",
      content: "hello",
      userId: "trusted-user",
    });
  });

  it("linkedin_post_publish REJECTS a model-supplied linkedinUserId fail-closed", async () => {
    registerLinkedInConnector(stubDeps());
    const handlers = createLinkedInPrimitiveHandlers();
    await expect(
      handlers.linkedin_post_publish({
        primitiveName: "linkedin_post_publish",
        input: { ...PUBLISH_INPUT, linkedinUserId: "victim-user" },
        actor: { actorType: "human", source: "a2a", userId: "attacker-user" },
        mode: "agentic",
      }),
    ).rejects.toThrow(/linkedinUserId.*not an accepted input/i);
    expect(publishMock).not.toHaveBeenCalled();
  });

  it("no trusted userId → publish scoped to undefined (shared app-scope account)", async () => {
    registerLinkedInConnector(stubDeps());
    const handlers = createLinkedInPrimitiveHandlers();
    await handlers.linkedin_post_publish({
      primitiveName: "linkedin_post_publish",
      input: PUBLISH_INPUT,
      actor: { actorType: "model", source: "agent" },
      mode: "agentic",
    });
    expect(publishMock).toHaveBeenCalledWith(expect.objectContaining({ userId: undefined }));
  });

  it("linkedin_destinations_list filters by linkedinAccountId, never passes accountId as userId", async () => {
    registerLinkedInConnector(stubDeps());
    const handlers = createLinkedInPrimitiveHandlers();
    const result = await handlers.linkedin_destinations_list({
      primitiveName: "linkedin_destinations_list",
      input: { accountId: "acc-1" },
      actor: { actorType: "model", source: "agent" },
      mode: "agentic",
    });
    // Never routed the LinkedIn accountId into the Cinatra userId slot.
    expect(listDestinationsMock).toHaveBeenCalledTimes(1);
    expect(listDestinationsMock).toHaveBeenCalledWith();
    expect(result).toEqual([
      expect.objectContaining({ linkedinAccountId: "acc-1" }),
    ]);
  });

  it("linkedin_destinations_list returns all destinations when no accountId is given", async () => {
    registerLinkedInConnector(stubDeps());
    const handlers = createLinkedInPrimitiveHandlers();
    const result = await handlers.linkedin_destinations_list({
      primitiveName: "linkedin_destinations_list",
      input: {},
      actor: { actorType: "model", source: "agent" },
      mode: "agentic",
    });
    expect(result).toHaveLength(2);
  });
});

describe("registerLinkedInPrimitives — the registry builds the actor server-side from resolveActor", () => {
  function registerOnStubServer(
    resolveActor?: ConnectorActorResolver,
  ): Map<string, (input: unknown, extra?: unknown) => Promise<unknown>> {
    const tools = new Map<string, (input: unknown, extra?: unknown) => Promise<unknown>>();
    const server = {
      registerTool: (
        name: string,
        _config: unknown,
        handler: (input: unknown, extra?: unknown) => Promise<unknown>,
      ) => {
        tools.set(name, handler);
      },
    };
    registerLinkedInPrimitives(server as never, resolveActor);
    return tools;
  }

  it("stamps the resolveActor()-resolved userId onto the actor the handler sees", async () => {
    registerLinkedInConnector(stubDeps());
    const tools = registerOnStubServer(async () => ({ userId: "resolved-user", orgId: "org-1" }));
    // A hostile input carrying its own `actor` must not influence scoping.
    await tools.get("linkedin_post_publish")!({ ...PUBLISH_INPUT, actor: { userId: "spoofed-actor" } });
    expect(publishMock).toHaveBeenCalledWith(expect.objectContaining({ userId: "resolved-user" }));
  });

  it("absent resolver → publish scoped to undefined (app-scope)", async () => {
    registerLinkedInConnector(stubDeps());
    const tools = registerOnStubServer(undefined);
    await tools.get("linkedin_post_publish")!(PUBLISH_INPUT);
    expect(publishMock).toHaveBeenCalledWith(expect.objectContaining({ userId: undefined }));
  });
});
