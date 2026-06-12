import Link from "next/link";
// hostInternal pinned-empty sweep (cinatra#172 Stage H4): status reads resolve
// the host-bound deps slot (bound at serverEntry activation by `register(ctx)`
// adapting `@cinatra-ai/host:linkedin-connection`) instead of importing
// `@/lib/linkedin-api`.
import { getLinkedInDeps } from "./deps";
import { Main, PageHeader, PageContent, StatusPill } from "@cinatra-ai/sdk-ui/marketplace";

// Admin LLM/APIs overlay surface for LinkedIn (rendered by the host's
// ?modal=linkedin entry on /configuration/llm). After the connector split
// (cinatra-ai/linkedin-connector#9) this page no longer owns any form:
//   - the Client ID / secret form moved to @cinatra-ai/linkedin-oauth-connector;
//   - the per-user "Connect LinkedIn" flow lives on this connector's setup page
//     (/connectors/cinatra-ai/linkedin-connector/setup).
// This overlay is now a thin pointer to both — and the stale, incorrect
// "Account > Security" pointer is gone.

type SettingsLinkedInPageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

const OAUTH_SETUP_HREF = "/connectors/cinatra-ai/linkedin-oauth-connector/setup";
const CONNECT_SETUP_HREF = "/connectors/cinatra-ai/linkedin-connector/setup";

export async function LinkedInSettingsPage(_props: SettingsLinkedInPageProps) {
  const status = await getLinkedInDeps().getStatus();

  return (
    <Main className="min-h-screen">
      <PageHeader
        title="LinkedIn"
        description="LinkedIn app credentials and per-user account connection are managed on dedicated connector pages."
        actions={
          <StatusPill status={status.status === "connected" ? "approved" : "idle"}>
            {status.status === "connected" ? "Connected" : "Setup required"}
          </StatusPill>
        }
      />
      <PageContent className="flex flex-col gap-6 pb-8">
        <div className="soft-panel rounded-card px-5 py-5 text-sm text-foreground">
          <p className="font-medium">LinkedIn app credentials</p>
          <p className="mt-2 text-muted-foreground">
            Configure the LinkedIn Client ID and secret in{" "}
            <Link href={OAUTH_SETUP_HREF} className="underline underline-offset-4">
              LinkedIn OAuth
            </Link>
            . These app credentials power every user&apos;s account connection.
          </p>
        </div>

        <div className="soft-panel rounded-card px-5 py-5 text-sm text-foreground">
          <p className="font-medium">Connect your LinkedIn account</p>
          <p className="mt-2 text-muted-foreground">
            Connect or reconnect your own LinkedIn account on the{" "}
            <Link href={CONNECT_SETUP_HREF} className="underline underline-offset-4">
              LinkedIn connector
            </Link>{" "}
            setup page.
          </p>
        </div>
      </PageContent>
    </Main>
  );
}
