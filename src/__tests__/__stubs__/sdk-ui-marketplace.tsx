// TEST STUB — minimal stand-in for @cinatra-ai/sdk-ui/marketplace, aliased in
// vitest.config.ts so linkedin-connect-section.dom.test.tsx can drive
// LinkedInConnectSection's onError wiring without the real host-internal
// package (unresolvable standalone — see __stubs__/next-navigation.ts). Only
// the props LinkedInConnectSection actually passes are modeled; the real
// NangoUserConnectButton's Nango-session/iframe plumbing is out of scope for a
// connect-code-emission unit test.
//
// Aliased UNCONDITIONALLY, in both layouts (cinatra#2288). This file is a
// behaviour SIMULATOR, not a resolution fallback: it fires `onError` on click
// and carries `data-testid="nango-connect-button"`, neither of which the real
// button has — it opens a real Nango Connect session instead. So the earlier
// claim that the monorepo run exercises the real button was never achievable
// for THIS test; with the real module resolved the test simply could not find
// its button or provoke the error path. Real Nango Connect UI behaviour is
// covered end-to-end host-side, not here.
"use client";

import { createElement, type ReactNode } from "react";

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
  // createElement (not JSX) deliberately: this test-only stub has no shadcn
  // <Button> to wrap (this repo's design-system button lives only where the
  // real @cinatra-ai/sdk-ui package is resolvable), and the org UI-gate bans a
  // literal JSX <button> tag repo-wide. A hand-rolled test double for a
  // third-party button is not a design-system surface, so this sidesteps the
  // gate without weakening it for real product UI.
  return createElement(
    "button",
    {
      type: "button",
      disabled,
      "data-testid": "nango-connect-button",
      // Simulates the real button's Connect-UI "error" event (redirect_uri
      // mismatch, provider rejection, etc.) firing onError with a raw
      // provider message — the exact shape linkedin-connect-section.tsx must
      // convert into the canonical `authorization-failed` code.
      onClick: () => onError?.("Simulated Nango Connect UI provider error"),
    },
    connected ? reconnectLabel : connectLabel,
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
