import Link from "next/link";
import { deleteLinkedInAccountAction, saveLinkedInConnectionAction } from "./actions";
import { getLinkedInAPISettings, getLinkedInAPIStatus, listLinkedInAccounts } from "@/lib/linkedin-api";
import { Button } from "./components/ui/button";
import { Input } from "./components/ui/input";
import { Label } from "./components/ui/label";
import { Main, PageHeader, PageContent, StatusPill } from "@cinatra-ai/sdk-ui/marketplace";

type SettingsLinkedInPageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

function pickSearchParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

const SETUP_HREF = "/connectors/cinatra-ai/linkedin-connector/setup";

export async function LinkedInSettingsPage({ searchParams }: SettingsLinkedInPageProps) {
  const [accounts, settings, status, resolvedSearchParams] = await Promise.all([
    listLinkedInAccounts(),
    getLinkedInAPISettings(),
    getLinkedInAPIStatus(),
    (searchParams ?? Promise.resolve({})) as Promise<Record<string, string | string[] | undefined>>,
  ]);

  const errorMessage = pickSearchParam(resolvedSearchParams.error);
  const saved = pickSearchParam(resolvedSearchParams.saved) === "1";

  return (
    <Main className="min-h-screen">
      <PageHeader
        title="LinkedIn"
        description="Manage the LinkedIn app administration Cinatra uses for connection setup and review the LinkedIn accounts that are currently available for syndication."
        actions={
          <StatusPill status={status.status === "connected" ? "approved" : "idle"}>
            {status.status === "connected" ? `${accounts.length} connected` : "Setup required"}
          </StatusPill>
        }
      />
      <PageContent className="flex flex-col gap-6 pb-8">
        {errorMessage ? (
          <div className="rounded-control border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">{errorMessage}</div>
        ) : null}

        {saved ? (
          <div className="rounded-control border border-success/30 bg-success/10 px-4 py-3 text-sm text-success">
            LinkedIn app administration saved.
          </div>
        ) : null}

        <div className="soft-panel rounded-card px-4 py-4 text-sm text-foreground">
          Use <Link href="/account/security" className="underline underline-offset-4">Account &gt; Security</Link> to connect or reconnect LinkedIn accounts. This page is for app setup and account management.
        </div>

        <div>
          <h3 className="text-lg font-semibold text-foreground">LinkedIn app administration</h3>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-muted-foreground">
            Save the LinkedIn client credentials that power the account connection flow. Cinatra derives the callback URL from the configured Nango connection service.
          </p>
        </div>

        <form action={saveLinkedInConnectionAction} className="grid gap-4 sm:grid-cols-2">
          <input type="hidden" name="redirectTo" value={SETUP_HREF} />
          <Label className="grid gap-2">
            Client ID
            <Input name="clientId" defaultValue={settings.clientId ?? ""} />
          </Label>
          <Label className="grid gap-2">
            Client secret
            <Input name="clientSecret" type="password" defaultValue={settings.clientSecret ?? ""} />
          </Label>
          <div className="rounded-control border border-line bg-surface-muted px-4 py-4 text-sm text-muted-foreground sm:col-span-2">
            Redirect URI is managed automatically from the configured Nango server URL when you save these settings.
          </div>
          <div className="sm:col-span-2 flex flex-wrap gap-3">
            <Button type="submit">Save LinkedIn administration</Button>
          </div>
        </form>

        <div>
          <h3 className="text-lg font-semibold text-foreground">Connected accounts</h3>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-muted-foreground">
            These LinkedIn users and destinations are currently available when creating syndication drafts.
          </p>
        </div>

        <div className="grid gap-4">
          {accounts.length === 0 ? (
            <div className="soft-panel rounded-card border border-dashed border-line px-5 py-5 text-sm text-muted-foreground">
              No LinkedIn accounts are connected yet.
            </div>
          ) : (
            accounts.map((account) => (
              <article key={account.id} className="soft-panel rounded-card px-5 py-5">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div>
                    <h3 className="text-lg font-semibold text-foreground">{account.name}</h3>
                    {account.email ? <p className="mt-2 text-sm text-muted-foreground">{account.email}</p> : null}
                    <p className="mt-3 text-xs font-medium uppercase tracking-[0.2em] text-muted-foreground">Available destinations</p>
                    <div className="mt-2 flex flex-wrap gap-2">
                      {account.destinations.map((destination) => (
                        <span key={`${destination.type}-${destination.id}`} className="rounded-full border border-line bg-surface-strong px-3 py-1 text-xs text-muted-foreground">
                          {destination.type === "organization" ? "Company page" : "Profile"}: {destination.name}
                        </span>
                      ))}
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-3">
                    <form action={deleteLinkedInAccountAction}>
                      <input type="hidden" name="redirectTo" value={SETUP_HREF} />
                      <input type="hidden" name="accountId" value={account.id} />
                      <Button variant="destructive" formNoValidate>Remove</Button>
                    </form>
                  </div>
                </div>
              </article>
            ))
          )}
        </div>
      </PageContent>
    </Main>
  );
}
