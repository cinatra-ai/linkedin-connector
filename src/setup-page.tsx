// Connector setup dispatch-route entry.
import { LinkedInSettingsPage } from "./settings-page";

type ConnectorSetupPageProps = {
  packageId: string;
  slug: string;
  searchParams: Record<string, string | string[] | undefined>;
};

export default async function LinkedInConnectorSetupPage({
  searchParams,
}: ConnectorSetupPageProps) {
  return LinkedInSettingsPage({ searchParams: Promise.resolve(searchParams) });
}
