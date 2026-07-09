"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { NangoUserConnectButton, type NangoFrontendConfig } from "@cinatra-ai/sdk-ui/marketplace";

// Client wrapper around NangoUserConnectButton (cinatra-ai/linkedin-connector#48,
// part of the toast-notifications epic cinatra-ai/cinatra#1107). The Nango
// Connect UI's `onError` event fires client-side (no server redirect), so this
// converts it into the codes-only flash protocol: write the CANONICAL error
// code onto `?error=<code>` via a client-side `router.replace` (preserving any
// other existing query params) and let the <SearchParamToast> island mounted in
// linkedin-setup-impl.tsx map the code to its static message. The raw provider
// error text is deliberately dropped — never toast URL/provider-derived text
// (see ./lib/linkedin-flash.ts).
export type LinkedInConnectSectionProps = {
  connected: boolean;
  reconnectConnectionId?: string;
  nangoFrontendConfig?: NangoFrontendConfig;
  credentialsConfigured: boolean;
};

export function LinkedInConnectSection({
  connected,
  reconnectConnectionId,
  nangoFrontendConfig,
  credentialsConfigured,
}: LinkedInConnectSectionProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  function emitAuthorizationFailed() {
    const next = new URLSearchParams(searchParams.toString());
    next.set("error", "authorization-failed");
    router.replace(`${pathname}?${next.toString()}`, { scroll: false });
  }

  return (
    <NangoUserConnectButton
      connectorKey="linkedin"
      reconnectConnectionId={reconnectConnectionId}
      connected={connected}
      connectLabel="Connect LinkedIn"
      reconnectLabel="Reconnect"
      nangoFrontendConfig={nangoFrontendConfig}
      disabled={!credentialsConfigured}
      prerequisiteErrorMessage={
        credentialsConfigured
          ? undefined
          : "Configure the LinkedIn app credentials in LinkedIn OAuth first."
      }
      onError={emitAuthorizationFailed}
    />
  );
}
