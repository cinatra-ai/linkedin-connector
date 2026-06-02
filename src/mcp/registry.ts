import { z } from "zod";
import type { ExtensionMcpToolServer, ExtensionMcpToolResult } from "@cinatra-ai/sdk-extensions";
import { createLinkedInPrimitiveHandlers, destinationsSchema, publishPostSchema } from "./handlers";

// The four `linkedin_*` handlers read only `request.input` (account ids etc. come
// from the parsed input, never from `request.actor`). Authorization is enforced
// upstream at the MCP boundary (kernel), so a static model actor is passed and the
// host `mcpRequestContextStorage` read is dropped — keeping the connector off
// `@cinatra-ai/mcp-server`.
const STATIC_AGENT_ACTOR = { actorType: "model", source: "agent" } as const;

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

export function registerLinkedInPrimitives(server: ExtensionMcpToolServer) {
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
        const result = await handler({
          primitiveName: name,
          input,
          actor: STATIC_AGENT_ACTOR,
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
