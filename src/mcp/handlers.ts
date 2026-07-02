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

// The user whose connected LinkedIn account a publish acts on is bound to the
// TRUSTED actor of the current invocation (the host builds `request.actor`
// server-side; see ./registry). It is NEVER taken from tool input, so an agent
// cannot name another user's id to publish from that user's connected account.
// `linkedinUserId` is intentionally absent from this input schema; `accountId`
// selects the target account WITHIN the trusted user's scope (or a shared
// app-scope account) and is not an identity.
export const publishPostSchema = z.object({
  accountId: z.string().min(1),
  destinationType: z.enum(["member", "organization"]),
  destinationId: z.string().min(1),
  content: z.string().min(1),
});

/**
 * Read the trusted user id from the host-built request actor. The actor is
 * server-controlled (never derived from tool input); a non-string / blank
 * value resolves to `undefined`, which routes to a shared app-scope account.
 */
function trustedUserIdFromActor(actor: unknown): string | undefined {
  if (actor && typeof actor === "object" && "userId" in actor) {
    const userId = (actor as { userId?: unknown }).userId;
    if (typeof userId === "string" && userId.trim().length > 0) return userId;
  }
  return undefined;
}

/**
 * Fail CLOSED if a caller smuggles a `linkedinUserId` into tool input.
 * Identity is bound server-side to the trusted actor; a model-supplied user id
 * is an account-spoofing attempt (or a stale caller) and is rejected loudly
 * rather than silently ignored.
 */
function rejectModelSuppliedUserId(input: unknown, tool: string): void {
  if (
    input &&
    typeof input === "object" &&
    "linkedinUserId" in input &&
    (input as { linkedinUserId?: unknown }).linkedinUserId !== undefined
  ) {
    throw new Error(
      `${tool}: 'linkedinUserId' is not an accepted input. The LinkedIn account is bound to ` +
        `the authenticated session, not tool input.`,
    );
  }
}

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
      // `accountId` is a LinkedIn account id, NOT a Cinatra user id — filter the
      // app-scope destinations by it here rather than mis-passing it into the
      // deps' `userId` slot (which the host reads only for user-scope listings
      // and would otherwise ignore, returning unfiltered results).
      const destinations = await getLinkedInDeps().listDestinations();
      return accountId
        ? destinations.filter((destination) => destination.linkedinAccountId === accountId)
        : destinations;
    },

    "linkedin_post_publish": async (request: ExtensionPrimitiveRequest<unknown>) => {
      rejectModelSuppliedUserId(request.input, "linkedin_post_publish");
      const { accountId, ...rest } = publishPostSchema.parse(request.input);
      return getLinkedInDeps().publishPost({
        ...rest,
        linkedinAccountId: accountId,
        userId: trustedUserIdFromActor(request.actor),
      });
    },
  } as const;
}
