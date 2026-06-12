import { z } from "zod";
import type { ExtensionPrimitiveRequest } from "@cinatra-ai/sdk-extensions";
// hostInternal pinned-empty sweep (cinatra#172 Stage H4): the primitive
// handlers resolve the host-bound deps slot (bound at serverEntry activation
// by `register(ctx)` adapting `@cinatra-ai/host:linkedin-connection`) instead
// of importing `@/lib/linkedin-api`. Account rows arrive token-stripped by
// contract; `publishPost` is the WRITER, reached only through the host's MCP
// dispatch + actor gating — the identical posture the static import carried.
import { getLinkedInDeps } from "../deps";

export const destinationsSchema = z.object({
  accountId: z.string().optional(),
});

export const publishPostSchema = z.object({
  accountId: z.string().min(1),
  destinationType: z.enum(["member", "organization"]),
  destinationId: z.string().min(1),
  content: z.string().min(1),
  linkedinUserId: z.string().optional(),
});

export function createLinkedInPrimitiveHandlers() {
  return {
    "linkedin_status": async (_request: ExtensionPrimitiveRequest<unknown>) => {
      return getLinkedInDeps().getStatus();
    },

    "linkedin_accounts_list": async (_request: ExtensionPrimitiveRequest<unknown>) => {
      return getLinkedInDeps().listAccounts();
    },

    "linkedin_destinations_list": async (request: ExtensionPrimitiveRequest<unknown>) => {
      const { accountId } = destinationsSchema.parse(request.input);
      return getLinkedInDeps().listDestinations(accountId ? { userId: accountId } : undefined);
    },

    "linkedin_post_publish": async (request: ExtensionPrimitiveRequest<unknown>) => {
      const { accountId, linkedinUserId, ...rest } = publishPostSchema.parse(request.input);
      return getLinkedInDeps().publishPost({
        ...rest,
        linkedinAccountId: accountId,
        userId: linkedinUserId,
      });
    },
  } as const;
}
