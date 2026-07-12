import "server-only";
import { Suspense } from "react";
import Link from "next/link";
import type { Metadata } from "next";
import type { ExtensionHostContext } from "@cinatra-ai/sdk-extensions";
import { Main, PageHeader, PageContent } from "@cinatra-ai/sdk-ui/marketplace";
import { SearchParamToast } from "@cinatra-ai/sdk-ui/search-param-toast";
import { Tabs, TabsContent, TabsListRow, TabsTrigger } from "@cinatra-ai/sdk-ui/tabs";
import { getLinkedInDeps } from "./deps";
import { Alert, AlertDescription } from "./components/ui/alert";
import { LinkedInConnectSection } from "./linkedin-connect-section";
import { LINKEDIN_FLASH_TOASTS } from "./lib/linkedin-flash";

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
//
// Tabbed setup page (cinatra-ai/linkedin-connector#54, connector-setup-tabs
// epic cinatra-ai/cinatra#1101, per the extended design/specs/app-connectors.html
// §II design). This connector holds a SINGLE per-user connection (not
// multiple instances, unlike e.g. the A2A Server connector) and declares no
// extra config-beyond-connecting tab, so the tablist is just Setup, then the
// reserved Help tab — ALWAYS LAST. Uses the shared, connector-agnostic
// `@cinatra-ai/sdk-ui/tabs` primitive (Tabs/TabsListRow/TabsTrigger/
// TabsContent) — no vendored `tabs.tsx` copy in this repo. `TabsListRow`
// draws the etched section rule to the right of the last tab, so the header
// renders `divider={false}` to avoid stacking two rules.

export type LinkedInConnectorPageImplProps = {
  searchParams?: Promise<SearchParams>;
  ctx: ExtensionHostContext;
};

export const metadata: Metadata = { title: "LinkedIn | Cinatra" };
export const dynamic = "force-dynamic";

type SearchParams = Record<string, string | string[] | undefined>;

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

  return (
    <Main className="min-h-screen">
      {/* Codes-only flash island: a failed Nango OAuth connect attempt writes a
          canonical ?error=<code> (client-side, no server redirect — see
          ./linkedin-connect-section.tsx) that this maps to a STATIC toast
          message (./lib/linkedin-flash.ts). Its one-shot param-strip also
          retires the old "suppress the stale error after reconnect" hack. */}
      <Suspense fallback={null}>
        <SearchParamToast toasts={LINKEDIN_FLASH_TOASTS} />
      </Suspense>
      <PageHeader
        title="LinkedIn"
        description="Connect your LinkedIn account to publish posts to your member feed or an organization page."
        className="max-w-3xl"
        divider={false}
      />
      <PageContent className="max-w-3xl pb-8">
        <Tabs defaultValue="setup" className="w-full">
          <TabsListRow aria-label="LinkedIn connector setup">
            <TabsTrigger value="setup">Setup</TabsTrigger>
            {/* Help is RESERVED and ALWAYS LAST (design/specs/app-connectors.html
                §II) — this single-connection connector declares no other
                config-beyond-connecting tab, so Setup + Help is the full
                tablist. */}
            <TabsTrigger value="help">Help</TabsTrigger>
          </TabsListRow>

          {/* SETUP — the single-connection body. Stays Wide (max-w-3xl,
              inherited from PageContent above); this is the primary tab, not
              a "custom" config tab, so it does not narrow. */}
          <TabsContent value="setup" forceMount className="mt-6 flex flex-col gap-6 data-[state=inactive]:hidden">
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
              <LinkedInConnectSection
                connected={Boolean(connection)}
                reconnectConnectionId={connection?.connectionId}
                nangoFrontendConfig={nangoFrontendConfig}
                credentialsConfigured={credentialsConfigured}
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
          </TabsContent>

          {/* HELP — reserved, always LAST, read-only (no form, no Save).
              Narrows to max-w-xl per the custom-tab content-width rule. */}
          <TabsContent
            value="help"
            forceMount
            className="mt-6 flex max-w-xl flex-col gap-5 data-[state=inactive]:hidden"
          >
            <p className="text-sm leading-6 text-muted-foreground">
              Cinatra publishes posts to LinkedIn on your behalf — to your own member
              feed or to an organization page you administer — through your connected
              LinkedIn account. It does not read your LinkedIn feed or messages.
            </p>
            <div>
              <h3 className="mb-1 text-sm font-semibold text-foreground">Prerequisite</h3>
              <p className="text-sm leading-6 text-muted-foreground">
                Connecting requires a shared LinkedIn app. An administrator saves its
                Client ID and secret in{" "}
                <Link href={OAUTH_SETUP_HREF} className="underline underline-offset-4">
                  LinkedIn OAuth
                </Link>{" "}
                first.
              </p>
            </div>
            <div>
              <h3 className="mb-1 text-sm font-semibold text-foreground">Connect your account</h3>
              <p className="text-sm leading-6 text-muted-foreground">
                On the Setup tab, sign in with LinkedIn. This authorizes Cinatra to
                publish on your behalf. Use Reconnect if your authorization expires or
                is revoked.
              </p>
            </div>
            <div>
              <h3 className="mb-1 text-sm font-semibold text-foreground">Publishing destinations</h3>
              <p className="text-sm leading-6 text-muted-foreground">
                Once connected, your member feed and any organization pages you
                administer appear as publishing destinations on the Setup tab.
              </p>
            </div>
          </TabsContent>
        </Tabs>
      </PageContent>
    </Main>
  );
}
