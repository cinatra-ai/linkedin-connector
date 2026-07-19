import { describe, it, expect, vi } from "vitest";

import {
  LINKEDIN_POST_DRAFT_TYPE_ID,
  MEMBER_POST_TEXT_LIMIT,
  MEDIA_ASSET_REF_MAX,
  linkedinPostDraftSchema,
  buildLinkedinPostDraftActor,
  buildLinkedinPostDraftData,
  writeLinkedinPostDraftWith,
} from "../integration/post-draft-writer-core";

const memberDestination = {
  accountId: "acct-1",
  destinationType: "member" as const,
  destinationId: "urn:li:person:abc",
};

describe("linkedinPostDraftSchema (per-network constraints)", () => {
  it("accepts a well-formed member draft (text within the limit + member destination)", () => {
    const result = linkedinPostDraftSchema.safeParse({
      content: "Hello LinkedIn",
      destination: memberDestination,
      visibility: "PUBLIC",
    });
    expect(result.success).toBe(true);
  });

  it("rejects text over the member post character limit", () => {
    const result = linkedinPostDraftSchema.safeParse({
      content: "x".repeat(MEMBER_POST_TEXT_LIMIT + 1),
      destination: memberDestination,
    });
    expect(result.success).toBe(false);
  });

  it("rejects a non-member destinationType (the per-network constraint — org is a separate type)", () => {
    const result = linkedinPostDraftSchema.safeParse({
      content: "hi",
      destination: { ...memberDestination, destinationType: "organization" },
    });
    expect(result.success).toBe(false);
  });

  it("rejects a missing/empty destination account or id", () => {
    expect(
      linkedinPostDraftSchema.safeParse({ content: "hi", destination: { ...memberDestination, accountId: "" } })
        .success,
    ).toBe(false);
    expect(
      linkedinPostDraftSchema.safeParse({ content: "hi", destination: { ...memberDestination, destinationId: "" } })
        .success,
    ).toBe(false);
  });

  it("rejects an empty post (no text and no media)", () => {
    expect(linkedinPostDraftSchema.safeParse({ destination: memberDestination }).success).toBe(false);
    expect(
      linkedinPostDraftSchema.safeParse({ content: "   ", destination: memberDestination }).success,
    ).toBe(false);
  });

  it("accepts a media-only draft (media satisfies the non-empty-post rule)", () => {
    expect(
      linkedinPostDraftSchema.safeParse({
        destination: memberDestination,
        mediaAssetRefs: ["urn:li:image:C4D22AQ"],
      }).success,
    ).toBe(true);
  });

  it("accepts the four LinkedIn media asset namespaces", () => {
    for (const urn of [
      "urn:li:digitalmediaAsset:C5522AQGTYER3ryU3xg",
      "urn:li:image:C4D22AQ_x1y2z3",
      "urn:li:video:D4E10AQ-abc.def",
      "urn:li:document:C4E10AQ_doc1",
    ]) {
      expect(
        linkedinPostDraftSchema.safeParse({ destination: memberDestination, mediaAssetRefs: [urn] }).success,
      ).toBe(true);
    }
  });

  it("rejects a media reference that is not a LinkedIn asset URN (e.g. an artifact id)", () => {
    expect(
      linkedinPostDraftSchema.safeParse({
        content: "hi",
        destination: memberDestination,
        mediaAssetRefs: ["3f8a1c2e-4b5d-6e7f-8a9b-0c1d2e3f4a5b"],
      }).success,
    ).toBe(false);
  });

  it("rejects a non-MEDIA LinkedIn entity URN and a malformed empty-id URN", () => {
    for (const urn of [
      "urn:li:person:abc",
      "urn:li:organization:123",
      "urn:li:share:456",
      "urn:li:image:", // empty id
      "urn:li:image::", // colon-only id
      "urn:li:image:a:b", // embedded colon
      "urn:li:sponsoredContent:789",
    ]) {
      expect(
        linkedinPostDraftSchema.safeParse({ destination: memberDestination, mediaAssetRefs: [urn] }).success,
      ).toBe(false);
    }
  });

  it("rejects more than the maximum number of media assets", () => {
    expect(
      linkedinPostDraftSchema.safeParse({
        destination: memberDestination,
        mediaAssetRefs: Array.from({ length: MEDIA_ASSET_REF_MAX + 1 }, (_, i) => `urn:li:image:a${i}`),
      }).success,
    ).toBe(false);
  });
});

describe("buildLinkedinPostDraftData", () => {
  it("builds the draft-content envelope (content directly, NO connectorRef wrapper)", () => {
    const data = buildLinkedinPostDraftData({
      content: "Hello LinkedIn",
      destination: memberDestination,
      visibility: "CONNECTIONS",
      mediaAssetRefs: ["urn:li:image:C4D22AQ"],
      runId: "run-1",
      campaignId: "camp-1",
    });
    expect("connectorRef" in data).toBe(false);
    expect(data).toEqual({
      content: "Hello LinkedIn",
      destination: memberDestination,
      visibility: "CONNECTIONS",
      mediaAssetRefs: ["urn:li:image:C4D22AQ"],
      runId: "run-1",
      campaignId: "camp-1",
    });
  });

  it("never writes a receipt or lifecycle state (draft content only)", () => {
    const data = buildLinkedinPostDraftData({ content: "hi", destination: memberDestination }) as Record<
      string,
      unknown
    >;
    for (const forbidden of ["state", "status", "receipt", "postUrn", "postUrl", "publishedAt", "scheduledAt"]) {
      expect(forbidden in data).toBe(false);
    }
  });

  it("omits absent optional fields rather than writing undefined/null", () => {
    const data = buildLinkedinPostDraftData({ content: "hi", destination: memberDestination });
    expect("visibility" in data).toBe(false);
    expect("mediaAssetRefs" in data).toBe(false);
    expect("runId" in data).toBe(false);
    expect("campaignId" in data).toBe(false);
  });

  it("fail-closes (throws) on a per-network violation", () => {
    expect(() =>
      buildLinkedinPostDraftData({ content: "x".repeat(MEMBER_POST_TEXT_LIMIT + 1), destination: memberDestination }),
    ).toThrow();
  });
});

describe("buildLinkedinPostDraftActor", () => {
  it("stamps the member role floor + the org (both orgId and organizationId)", () => {
    const actor = buildLinkedinPostDraftActor({ orgId: "org-1", userId: "user-1" });
    expect(actor).toMatchObject({
      actorType: "model",
      source: "agent",
      roles: ["member"],
      orgId: "org-1",
      organizationId: "org-1",
      userId: "user-1",
    });
  });

  it("omits userId when the trigger is not user-attributed", () => {
    const actor = buildLinkedinPostDraftActor({ orgId: "org-1", userId: null });
    expect("userId" in actor).toBe(false);
  });
});

describe("writeLinkedinPostDraftWith", () => {
  it("upserts the draft through objects_save with the host linkedin:post-draft typeHint", async () => {
    const saveObject = vi.fn().mockResolvedValue({
      objectId: "obj-1",
      type: LINKEDIN_POST_DRAFT_TYPE_ID,
      isNew: true,
      wasMerged: false,
      confidence: 1,
      changeSetId: "cs-1",
    });
    const provider = { saveObject } as unknown as Parameters<typeof writeLinkedinPostDraftWith>[0];
    const actor = buildLinkedinPostDraftActor({ orgId: "org-1" });

    const result = await writeLinkedinPostDraftWith(
      provider,
      { content: "Hello LinkedIn", destination: memberDestination, runId: "run-1" },
      actor,
    );

    expect(result).toEqual({ objectId: "obj-1", isNew: true });
    expect(saveObject).toHaveBeenCalledTimes(1);
    const call = saveObject.mock.calls[0][0];
    expect(call.typeHint).toBe(LINKEDIN_POST_DRAFT_TYPE_ID);
    expect(call.mode).toBe("agentic");
    expect(call.actor).toBe(actor);
    expect(call.rawData.content).toBe("Hello LinkedIn");
    expect(call.rawData.destination.destinationType).toBe("member");
    expect("connectorRef" in call.rawData).toBe(false);
  });

  it("rejects (throws) an invalid draft before any objects_save call (fail-closed)", async () => {
    const saveObject = vi.fn();
    const provider = { saveObject } as unknown as Parameters<typeof writeLinkedinPostDraftWith>[0];
    await expect(
      writeLinkedinPostDraftWith(
        provider,
        { content: "", destination: memberDestination },
        buildLinkedinPostDraftActor({ orgId: "org-1" }),
      ),
    ).rejects.toThrow();
    expect(saveObject).not.toHaveBeenCalled();
  });
});
