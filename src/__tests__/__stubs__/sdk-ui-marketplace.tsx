// TEST STUB — minimal stand-in for @cinatra-ai/sdk-ui/marketplace, aliased in
// vitest.config.ts so linkedin-connect-section.dom.test.tsx can drive
// LinkedInConnectSection's onError wiring without the real host-internal
// package (unresolvable standalone — see __stubs__/next-navigation.ts). Only
// the props LinkedInConnectSection actually passes are modeled; the real
// NangoUserConnectButton's Nango-session/iframe plumbing is out of scope for
// this repo's own connect-code-emission test — the cinatra monorepo exercises
// the real button against the real Nango Connect UI.
"use client";

import type { ReactNode } from "react";

export type NangoFrontendConfig = {
  apiURL?: string;
  baseURL?: string;
};

export type NangoUserConnectButtonProps = {
  connectorKey: string;
  reconnectConnectionId?: string;
  connected?: boolean;
  connectLabel?: string;
  reconnectLabel?: string;
  nangoFrontendConfig?: NangoFrontendConfig;
  className?: string;
  prerequisiteErrorMessage?: string;
  disabled?: boolean;
  onError?: (message: string) => void;
  onClickOverride?: () => void | Promise<void>;
};

export function NangoUserConnectButton({
  connected,
  connectLabel = "Connect",
  reconnectLabel = "Reconnect",
  disabled,
  onError,
}: NangoUserConnectButtonProps) {
  return (
    <button
      type="button"
      disabled={disabled}
      data-testid="nango-connect-button"
      // Simulates the real button's Connect-UI "error" event (redirect_uri
      // mismatch, provider rejection, etc.) firing onError with a raw
      // provider message — the exact shape linkedin-connect-section.tsx must
      // convert into the canonical `authorization-failed` code.
      onClick={() => onError?.("Simulated Nango Connect UI provider error")}
    >
      {connected ? reconnectLabel : connectLabel}
    </button>
  );
}

export function Main({ children, className }: { children?: ReactNode; className?: string }) {
  return <main className={className}>{children}</main>;
}

export function PageHeader({ title, description, className }: { title?: ReactNode; description?: ReactNode; className?: string }) {
  return (
    <header className={className}>
      {title}
      {description}
    </header>
  );
}

export function PageContent({ children, className }: { children?: ReactNode; className?: string }) {
  return <div className={className}>{children}</div>;
}
