// LinkedIn member post-draft write CORE — a dependency-light LEAF module
// (SDK TYPE imports only; NO SDK value imports), the linkedin-connector's half
// of the `@cinatra-ai/linkedin:post-draft` draftable lifecycle (cinatra#1457,
// epic #1448).
//
// MODEL DIFFERENCE vs the wordpress:post / drupal:node precedents (#1464/#1465):
// those write EXTERNAL POINTER rows — a `connectorRef` envelope of bare identity
// (url + ids + reference state), NEVER a body, because the canonical content
// lives in the remote CMS. A `linkedin:post-draft` is the opposite: DRAFTABLE
// MEMBER content authored IN cinatra. The draft body (post text + member
// destination + provider media references) IS the row's `objects.data`; there is
// no `connectorRef` wrapper. The draft is editable while in `draft` state and
// LOCKS in `scheduled`/`published` — that state machine, and the publish
// receipts (the post URN/URL), ride the publication-operation ledger
// (cinatra#1450/#1774) and are written ONLY by the publish machinery. This
// writer NEVER writes a receipt, a lifecycle state, or a `scheduled`/`published`
// transition — it materializes draft content only.
//
// The HOST is the single runtime registrar for the `@cinatra-ai/linkedin:post-draft`
// TYPE (packages/objects/.../register-types.ts, cinatra#1808 — epic #1448
// principle 5: exactly one registrar per type; the pack claim adds only the
// draftable disposition, never a second registrar). This connector does NOT
// register a second object type. Its connector-side contribution is (a) this
// per-network VALIDATING schema — the LinkedIn domain knowledge the host's
// permissive registrar does not encode (the member text limit, the member-only
// destination, provider-URN media references, a non-empty-post rule) — and
// (b) the typed row-writer that validates fail-closed before upserting a draft
// row through the host objects surface.
//
// Shared by the host-resolved `linkedin-post-draft-writer` capability
// (register.ts) and its tests. Kept OFF the package index (the server graph must
// not re-export React); the writer is reached through the capability registry.

import type { ObjectsProvider } from "@cinatra-ai/sdk-extensions";
import { z } from "zod";

/** The host-registered draftable type id this connector writes rows for
 * (registered host-side in packages/objects/.../register-types.ts, #1808). */
export const LINKEDIN_POST_DRAFT_TYPE_ID = "@cinatra-ai/linkedin:post-draft";

/** This connector's package id — soft provenance only, never an FK. */
export const LINKEDIN_CONNECTOR_ID = "@cinatra-ai/linkedin-connector";

/** Per-network constraint: LinkedIn's `ugcPosts` `shareCommentary.text` caps a
 * member share at 3000 characters. A draft over the limit can never publish, so
 * the writer rejects it fail-closed rather than persisting an unpublishable draft. */
export const MEMBER_POST_TEXT_LIMIT = 3000;

/** Per-network constraint: a single LinkedIn share carries at most 9 media
 * assets (the multi-image maximum). */
export const MEDIA_ASSET_REF_MAX = 9;

/** Provider asset-reference shape: a LinkedIn digital-MEDIA asset URN in one of
 * the four namespaces `ugcPosts`/`shareMedia` accepts — `digitalmediaAsset`
 * (Vector Assets), `image`, `video`, `document` — followed by a non-empty,
 * colon-free asset id. Restricting to the MEDIA namespaces (not any `urn:li:*`
 * entity) rejects a mis-supplied person/organization/share URN
 * (`urn:li:person:…`, `urn:li:share:…`), a malformed empty-id URN
 * (`urn:li:image::`), AND an artifact id (a UUID/object id never matches) —
 * epic #1448 atomicity principle 2: media references are provider MEDIA asset
 * references, NEVER artifact ids or other entity URNs. */
const LINKEDIN_ASSET_URN =
  /^urn:li:(digitalmediaAsset|image|video|document):[A-Za-z0-9._-]+$/;

/**
 * The per-network member post-draft schema — fail-closed. Encodes the LinkedIn
 * constraints the host's permissive registrar (all-optional) does not: a
 * member-only destination, the 3000-char text limit, provider-URN media
 * references, and a non-empty-post rule (a share must carry text OR media to be
 * publishable). Soft-provenance `runId`/`campaignId` pass through unconstrained.
 */
export const linkedinPostDraftSchema = z
  .object({
    /** The member share commentary. Optional at the field level (a media-only
     * draft is legal), but the object-level refine requires text OR media. */
    content: z
      .string()
      .max(
        MEMBER_POST_TEXT_LIMIT,
        `LinkedIn member post text exceeds the ${MEMBER_POST_TEXT_LIMIT}-character limit`,
      )
      .optional(),
    /** The MEMBER destination (the per-network constraint, cinatra#1457): the
     * organization-page draft is a SEPARATE type (#1767), so `destinationType`
     * is the literal `"member"` here. */
    destination: z.object({
      accountId: z.string().min(1, "destination.accountId is required"),
      destinationType: z.literal("member"),
      destinationId: z.string().min(1, "destination.destinationId is required"),
    }),
    /** Member-network visibility (defaults left to the publish path). */
    visibility: z.enum(["PUBLIC", "CONNECTIONS"]).optional(),
    /** Provider media asset URNs, at most 9, NEVER artifact ids. */
    mediaAssetRefs: z
      .array(
        z
          .string()
          .regex(
            LINKEDIN_ASSET_URN,
            "mediaAssetRefs must be LinkedIn asset URNs (urn:li:…), never artifact ids",
          ),
      )
      .max(MEDIA_ASSET_REF_MAX, `a LinkedIn share carries at most ${MEDIA_ASSET_REF_MAX} media assets`)
      .optional(),
    /** Soft-provenance run correlation (drives host-side (runId, destinationId)
     * dedup identity — never an FK). */
    runId: z.string().optional(),
    /** Soft-provenance campaign correlation. */
    campaignId: z.string().optional(),
  })
  .refine(
    (d) => (d.content?.trim().length ?? 0) > 0 || (d.mediaAssetRefs?.length ?? 0) > 0,
    { message: "a member post draft must carry non-empty text or at least one media asset" },
  );

/** The validated draft input (the row-writer's argument). */
export type LinkedinPostDraftInput = z.input<typeof linkedinPostDraftSchema>;

/** The `objects.data` envelope for a `@cinatra-ai/linkedin:post-draft` row — the
 * draft CONTENT directly (no `connectorRef` wrapper; this is authored content,
 * not an external pointer). Absent optionals are omitted, never written as
 * undefined/null. NEVER carries a receipt or a lifecycle state. */
export type LinkedinPostDraftData = {
  content?: string;
  destination: {
    accountId: string;
    destinationType: "member";
    destinationId: string;
  };
  visibility?: "PUBLIC" | "CONNECTIONS";
  mediaAssetRefs?: string[];
  runId?: string;
  campaignId?: string;
};

/**
 * Validate + build the `objects.data` payload for a member `linkedin:post-draft`.
 * PURE — no I/O. Throws (fail-closed) on any per-network violation: over-limit
 * text, a non-member destination, a malformed/artifact-id media reference, an
 * empty post, or too many assets. Omits absent optional fields.
 */
export function buildLinkedinPostDraftData(
  input: LinkedinPostDraftInput,
): LinkedinPostDraftData {
  const draft = linkedinPostDraftSchema.parse(input);
  const data: LinkedinPostDraftData = {
    destination: {
      accountId: draft.destination.accountId,
      destinationType: "member",
      destinationId: draft.destination.destinationId,
    },
  };
  if (draft.content !== undefined) data.content = draft.content;
  if (draft.visibility !== undefined) data.visibility = draft.visibility;
  if (draft.mediaAssetRefs !== undefined) data.mediaAssetRefs = draft.mediaAssetRefs;
  if (draft.runId !== undefined) data.runId = draft.runId;
  if (draft.campaignId !== undefined) data.campaignId = draft.campaignId;
  return data;
}

/**
 * Build a synthetic draft actor from explicit orgId/userId — the
 * twenty-pointer-writer precedent (byte-mirrors the wordpress/drupal writers,
 * #1464/#1465). The host draft trigger runs outside an MCP request frame, so it
 * captures org+user and this leaf rehydrates an equivalent actor. The actor MUST
 * stamp `roles: ["member"]` so a userless caller lifts to `orgRole: "member"`
 * (not the object.create-less ServiceAccount); a member post draft is
 * org-scoped authored content, and `member` does not escalate across orgs (the
 * kernel's cross-org guard still requires the row's org_id to match the actor's
 * organizationId). `orgId` is REQUIRED (objects_save rejects a null-org actor).
 */
export function buildLinkedinPostDraftActor(input: {
  orgId: string;
  userId?: string | null;
}): Record<string, unknown> {
  const actor: Record<string, unknown> = {
    actorType: "model",
    source: "agent",
    roles: ["member"],
    orgId: input.orgId,
    organizationId: input.orgId,
  };
  if (input.userId) actor.userId = input.userId;
  return actor;
}

/**
 * Write (upsert-by-identity) a single `linkedin:post-draft` DRAFT row through the
 * GIVEN objects provider with the GIVEN actor. The host `@cinatra-ai/linkedin:post-draft`
 * TYPE registrar (register-types.ts, #1808) must already be registered so
 * `objects_save`'s classifier resolves the typeHint to the static entry and the
 * host identityKey upserts by (runId, destinationId) rather than minting a
 * duplicate on every agent retry within a run. Writes DRAFT CONTENT only — never
 * a receipt or a lifecycle transition (those ride the publication ledger).
 * Returns the objects_save result (the caller records the object id).
 */
export async function writeLinkedinPostDraftWith(
  provider: ObjectsProvider,
  input: LinkedinPostDraftInput,
  actor: Record<string, unknown>,
): Promise<{ objectId: string; isNew: boolean }> {
  const data = buildLinkedinPostDraftData(input);
  const result = await provider.saveObject({
    typeHint: LINKEDIN_POST_DRAFT_TYPE_ID,
    rawData: data as unknown as Record<string, unknown>,
    actor,
    mode: "agentic",
  });
  return { objectId: result.objectId, isNew: result.isNew };
}
