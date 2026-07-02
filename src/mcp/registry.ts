import { z } from "zod";
import type { ExtensionMcpToolServer, ExtensionMcpToolResult } from "@cinatra-ai/sdk-extensions";
import { createLinkedInPrimitiveHandlers, destinationsSchema, publishPostSchema } from "./handlers";

// `linkedin_post_publish` binds the acted-on account to the TRUSTED actor of
// the current request, resolved SERVER-SIDE. The MCP SDK transport carries no
// actor on `registerTool`'s handler args, so the host provides a resolver that
// reads the request/run context; the registry stamps the resolved identity
// onto the actor the handler sees. When no resolver is wired the userId is
// absent → a shared app-scope account (the existing behavior), never a
// model-supplied id. This keeps the connector off `@cinatra-ai/mcp-server`
// while still binding identity server-side.
export type ConnectorActorResolver = () => Promise<{ userId?: string; orgId?: string }>;

const TOOL_META: Record<string, { description: string; inputSchema: z.ZodTypeAny }> = {
  "linkedin_status": {
    description: "Get the current LinkedIn connector connection status.",
    inputSchema: z.object({}),
  },
  "linkedin_accounts_list": {
    description: "List all connected LinkedIn accounts.",
    inputSchema: z.object({}),
  },
  "linkedin_destinations_list": {
    description: "List available LinkedIn publishing destinations (member profile or organization pages), optionally filtered by account.",
    inputSchema: destinationsSchema,
  },
  "linkedin_post_publish": {
    description: "Publish a post to a LinkedIn member profile or organization page.",
    inputSchema: publishPostSchema,
  },
};

export function registerLinkedInPrimitives(
  server: ExtensionMcpToolServer,
  resolveActor?: ConnectorActorResolver,
) {
  const handlers = createLinkedInPrimitiveHandlers();

  for (const [name, handler] of Object.entries(handlers)) {
    const meta = TOOL_META[name] ?? { description: name, inputSchema: z.object({}).passthrough() };
    server.registerTool(
      name,
      {
        title: name,
        description: meta.description,
        inputSchema: meta.inputSchema,
      },
      async (input: unknown): Promise<ExtensionMcpToolResult> => {
        // Build the actor SERVER-SIDE from the host-provided resolver; never
        // trust an inbound/model-supplied actor.
        const resolved = resolveActor ? await resolveActor() : {};
        const result = await handler({
          primitiveName: name,
          input,
          actor: {
            actorType: "model",
            source: "agent",
            userId: resolved.userId,
            orgId: resolved.orgId,
          },
          mode: "agentic",
        });
        return {
          content: [{ type: "text", text: JSON.stringify(result) }],
          structuredContent: Array.isArray(result) ? { items: result } : typeof result === "object" && result !== null ? (result as Record<string, unknown>) : { result },
        };
      },
    );
  }
}
