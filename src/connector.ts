import "server-only";

// ---------------------------------------------------------------------------
// `linkedInSocialMediaConnector` implements the
// @cinatra-ai/social-media-connector `SocialMediaConnector` contract.
//
// Concrete LinkedIn transport adapter: wraps the host-bound deps slot's
// `publishPost` (cinatra#172 Stage H4 — `@/lib/linkedin-api` stays host-side;
// the slot is bound at serverEntry activation by `register(ctx)` adapting
// `@cinatra-ai/host:linkedin-connection`) so the facade can route LinkedIn
// publishes without callers reaching into provider-specific code. Status is
// reported via the slot's `getStatus`, mapped to the provider-neutral
// SocialMediaConnectorStatusResult shape.
// ---------------------------------------------------------------------------

import type {
  SocialMediaConnector,
  SocialMediaConnectorStatusResult,
  SocialMediaPost,
  SocialMediaPublishReceipt,
} from "@cinatra-ai/sdk-extensions/social-contract";
import { getLinkedInDeps } from "./deps";

export const linkedInSocialMediaConnector: SocialMediaConnector = {
  definition: {
    connectorId: "linkedin",
    name: "LinkedIn",
    slug: "linkedin",
    description:
      "Publish posts to a connected LinkedIn member feed or organization page.",
    settingsHref: "/configuration/connections/linkedin",
    supportsOrganizationPosts: true,
    supportsMemberPosts: true,
  },

  async publish(
    post: SocialMediaPost,
    opts?: { userId?: string },
  ): Promise<SocialMediaPublishReceipt> {
    const published = await getLinkedInDeps().publishPost({
      linkedinAccountId: post.accountId,
      destinationType: post.destinationType,
      destinationId: post.destinationId,
      content: post.content,
      userId: opts?.userId,
    });
    return {
      providerId: "linkedin",
      providerPostId: published.postUrn,
      providerPostUrl: published.postUrl,
      publishedAt: new Date().toISOString(),
    };
  },

  async getStatus(): Promise<SocialMediaConnectorStatusResult> {
    const status = await getLinkedInDeps().getStatus();
    return {
      status: status.status === "connected" ? "connected" : "not_connected",
      detail: status.detail,
    };
  },
};
