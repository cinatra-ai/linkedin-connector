// Connector setup dispatch-route entry — the per-user LinkedIn connect surface
// (cinatra-ai/linkedin-connector#9). Delegates to the shared page
// implementation, passing the grant-aware host context (`ctx`) the dispatch
// route builds from this connector's `requestedHostPorts` (authSession + nango).

import type { ExtensionHostContext } from "@cinatra-ai/sdk-extensions";
import { LinkedInConnectorPageImpl } from "./linkedin-setup-impl";

type ConnectorSetupPageProps = {
  packageId: string;
  slug: string;
  searchParams: Record<string, string | string[] | undefined>;
  ctx: ExtensionHostContext;
};

export default async function LinkedInConnectorSetupPage({
  searchParams,
  ctx,
}: ConnectorSetupPageProps) {
  return LinkedInConnectorPageImpl({
    searchParams: Promise.resolve(searchParams),
    ctx,
  });
}
