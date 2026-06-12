import "server-only";
import Link from "next/link";
import type { Metadata } from "next";
import type { ExtensionHostContext } from "@cinatra-ai/sdk-extensions";
import { Main, PageHeader, PageContent } from "@cinatra-ai/sdk-ui/marketplace";
import { NangoUserConnectButton } from "@cinatra-ai/sdk-ui/marketplace";
import { getLinkedInDeps } from "./deps";
import { Alert, AlertDescription } from "./components/ui/alert";

// Per-user LinkedIn connect surface (cinatra-ai/linkedin-connector#9). Mirrors
// gmail-setup-impl.tsx: the user connects their own LinkedIn account through
// Nango's OAuth connect UI. Nango data (frontend config + the user's primary
// saved connection) is read from the injected host port `ctx.nango.*`
// (host-port inversion) and the actor from `ctx.authSession` — the impl carries
// no `@/` host-internal import.
//
// The admin Client ID / secret form lives in the SEPARATE
// `@cinatra-ai/linkedin-oauth-connector` (the credentials half of the split);
// when those credentials are missing this page renders a prerequisite hint
// linking to that connector's setup page (mirrors the host GitHub skills page).

export type LinkedInConnectorPageImplProps = {
  searchParams?: Promise<SearchParams>;
  ctx: ExtensionHostContext;
};

export const metadata: Metadata = { title: "LinkedIn | Cinatra" };
export const dynamic = "force-dynamic";

type SearchParams = Record<string, string | string[] | undefined>;
function pick(v: string | string[] | undefined) {
  return Array.isArray(v) ? v[0] : v;
}

const OAUTH_SETUP_HREF = "/connectors/cinatra-ai/linkedin-oauth-connector/setup";

export async function LinkedInConnectorPageImpl(props: LinkedInConnectorPageImplProps) {
  const actor = await props.ctx.authSession.getActor();
  if (!actor?.userId) {
    // The dispatch route already gated via enforceConnectorPolicy; this
    // defensive check ensures a misconfigured port never silently mis-scopes
    // user-private connection data.
    throw new Error("[linkedin-connector] no userId on actor");
  }
  const userId = actor.userId;

  const sp = (await (props.searchParams ?? Promise.resolve({}))) as SearchParams;
  const error = pick(sp.error);

  // Drive the missing-credentials prerequisite from the SECRET-FREE aggregate
  // status, NOT from getSettings() — a workspace-visible page must not pull the
  // OAuth client secret over the DI boundary just to compute readiness.
  // getStatus() reports "connected" once the app credentials are configured (or
  // any account / Nango connection exists) and exposes only {status, detail} —
  // never the secret. "not_connected" means the admin has not saved the
  // LinkedIn app credentials yet, which is exactly the prerequisite to surface.
  const status = await getLinkedInDeps().getStatus();
  const credentialsConfigured = status.status === "connected";

  const nangoFrontendConfig = (await props.ctx.nango.getFrontendConfig?.()) ?? {};
  const connection =
    (await props.ctx.nango.getPrimarySavedConnections?.({ scope: "user", userId }))?.linkedin ??
    null;

  // USER-SCOPED destinations only (the user's own Nango connection), NEVER the
  // global app-scope account list — a user must not see other users' accounts.
  const destinations =
    credentialsConfigured && connection
      ? await getLinkedInDeps().listDestinations({ scope: "user", userId })
      : [];

  // Suppress a stale "authorization expired" error once reconnected (the client
  // router.refresh() re-renders with the same ?error= URL param still present).
  const visibleError =
    connection && error?.includes("authorization expired") ? undefined : error;

  return (
    <Main className="min-h-screen">
      <PageHeader
        title="LinkedIn"
        description="Connect your LinkedIn account to publish posts to your member feed or an organization page."
        className="max-w-3xl"
      />
      <PageContent className="max-w-3xl flex flex-col gap-6 pb-8">
        {visibleError ? (
          <Alert variant="destructive" className="rounded-control">
            <AlertDescription>{visibleError}</AlertDescription>
          </Alert>
        ) : null}

        {!credentialsConfigured ? (
          <Alert className="rounded-control">
            <AlertDescription>
              LinkedIn app credentials are not configured yet. An administrator must save the
              LinkedIn Client ID and secret in{" "}
              <Link href={OAUTH_SETUP_HREF} className="underline underline-offset-4">
                LinkedIn OAuth
              </Link>{" "}
              before you can connect your account.
            </AlertDescription>
          </Alert>
        ) : null}

        <section className="soft-panel rounded-panel p-5 flex items-center justify-between gap-4">
          <div>
            <p className="text-sm font-medium text-foreground">LinkedIn account</p>
            <p className="mt-1 text-sm text-muted-foreground">
              {connection
                ? `Connected${connection.displayName ? ` as ${connection.displayName}` : connection.email ? ` as ${connection.email}` : ""}`
                : "Not connected"}
            </p>
          </div>
          <NangoUserConnectButton
            connectorKey="linkedin"
            reconnectConnectionId={connection?.connectionId}
            connected={Boolean(connection)}
            connectLabel="Connect LinkedIn"
            reconnectLabel="Reconnect"
            nangoFrontendConfig={nangoFrontendConfig}
            prerequisiteErrorMessage={
              credentialsConfigured
                ? undefined
                : "Configure the LinkedIn app credentials in LinkedIn OAuth first."
            }
          />
        </section>

        {connection ? (
          <section className="soft-panel rounded-panel p-5 flex flex-col gap-4">
            <div>
              <p className="text-sm font-medium text-foreground">Publishing destinations</p>
              <p className="mt-1 text-sm text-muted-foreground">
                Member feed and organization pages available from your connected account.
              </p>
            </div>
            {destinations.length > 0 ? (
              <div className="flex flex-wrap gap-2">
                {destinations.map((destination) => (
                  <span
                    key={`${destination.destinationType}-${destination.destinationId}`}
                    className="rounded-full border border-line bg-surface-strong px-3 py-1 text-xs text-muted-foreground"
                  >
                    {destination.destinationType === "organization" ? "Company page" : "Profile"}:{" "}
                    {destination.destinationName}
                  </span>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">
                No publishing destinations are available yet for this connection.
              </p>
            )}
          </section>
        ) : null}
      </PageContent>
    </Main>
  );
}
