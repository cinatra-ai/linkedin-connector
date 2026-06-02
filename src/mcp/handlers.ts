import { z } from "zod";
import type { ExtensionPrimitiveRequest } from "@cinatra-ai/sdk-extensions";
import {
  getLinkedInAPIStatus,
  listLinkedInAccounts,
  listLinkedInDestinations,
  publishLinkedInPost,
} from "@/lib/linkedin-api";

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
      return getLinkedInAPIStatus();
    },

    "linkedin_accounts_list": async (_request: ExtensionPrimitiveRequest<unknown>) => {
      return listLinkedInAccounts();
    },

    "linkedin_destinations_list": async (request: ExtensionPrimitiveRequest<unknown>) => {
      const { accountId } = destinationsSchema.parse(request.input);
      return listLinkedInDestinations(accountId ? { userId: accountId } : undefined);
    },

    "linkedin_post_publish": async (request: ExtensionPrimitiveRequest<unknown>) => {
      const { accountId, linkedinUserId, ...rest } = publishPostSchema.parse(request.input);
      return publishLinkedInPost({ ...rest, linkedinAccountId: accountId, userId: linkedinUserId });
    },
  } as const;
}
