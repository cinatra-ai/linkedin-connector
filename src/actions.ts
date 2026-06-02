"use server";

// LinkedIn connection server actions — relocated from the central
// `@cinatra-ai/connectors` host hub into the connector itself (SDK-only
// decouple). Gated by the SDK's `requireExtensionAction(pkg, "manage")` — the hub
// copies had NO gate, so this ADDS authorization (org_owner/org_admin/platform_admin,
// fail-closed). Connector-config is read/written through the SDK's GENERIC
// host-binds-once accessor (getExtensionConnectorConfig / setExtensionConnectorConfig,
// mirroring the action guard) — NOT a per-connector host DI binding — so the host
// has ZERO per-connector knowledge of this connector and adding a connector needs
// no host change. The connector carries no `@/lib/*` import.

import { z } from "zod";
import { redirect } from "next/navigation";
import {
  requireExtensionAction,
  getExtensionConnectorConfig,
  setExtensionConnectorConfig,
} from "@cinatra-ai/sdk-extensions";

const linkedinConnectorSchema = z.object({
  clientId: z.string().optional(),
  clientSecret: z.string().optional(),
});

export async function saveLinkedInConnectionAction(formData: FormData) {
  await requireExtensionAction("@cinatra-ai/linkedin-connector", "manage");
  const parsed = linkedinConnectorSchema.parse({
    clientId: formData.get("clientId") ?? undefined,
    clientSecret: formData.get("clientSecret") ?? undefined,
  });
  setExtensionConnectorConfig("@cinatra-ai/linkedin-connector", "linkedin_connection", {
    clientId: parsed.clientId?.trim() || undefined,
    clientSecret: parsed.clientSecret?.trim() || undefined,
  });
  // Honor an explicit post-save target. The LinkedIn connector setup page now
  // renders as a page (not an LLM-page modal) and passes its own URL.
  const redirectTo = (formData.get("redirectTo") as string | null)?.trim() || "/configuration/llm";
  redirect(redirectTo);
}

export async function deleteLinkedInAccountAction(formData: FormData) {
  await requireExtensionAction("@cinatra-ai/linkedin-connector", "manage");
  const accountId = z.string().min(1).parse(formData.get("accountId"));
  const current = getExtensionConnectorConfig<{ accounts?: Array<{ id: string }> }>(
    "@cinatra-ai/linkedin-connector",
    "linkedin_connection",
    { accounts: [] },
  );
  const next = {
    ...current,
    accounts: (current.accounts ?? []).filter((account) => account.id !== accountId),
  };
  setExtensionConnectorConfig("@cinatra-ai/linkedin-connector", "linkedin_connection", next);
  const redirectTo = (formData.get("redirectTo") as string | null)?.trim() || "/configuration/llm";
  redirect(redirectTo);
}
