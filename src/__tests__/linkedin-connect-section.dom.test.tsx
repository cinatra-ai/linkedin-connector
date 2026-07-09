// @vitest-environment jsdom
//
// DOM render test of the OAuth-callback error path (cinatra-ai/linkedin-connector#48):
// a failed Nango Connect UI attempt fires NangoUserConnectButton's `onError`
// with a raw provider message (simulated by the stubbed button — see
// __stubs__/sdk-ui-marketplace.tsx); LinkedInConnectSection must convert that
// into the CANONICAL `?error=authorization-failed` code via a client-side
// router.replace — never reflect the raw provider text onto the URL (codes-only
// protocol; see ../lib/linkedin-flash.ts).
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import React from "react";

import { LinkedInConnectSection } from "../linkedin-connect-section";
import { __getReplaceCalls, __resetNavigationStub, __setSearchParams } from "./__stubs__/next-navigation";

describe("LinkedInConnectSection — canonical error-code emission", () => {
  afterEach(() => {
    cleanup();
    __resetNavigationStub();
  });

  it("emits ?error=authorization-failed (never the raw provider message) when the connect attempt errors", () => {
    render(
      <LinkedInConnectSection
        connected={false}
        nangoFrontendConfig={{}}
        credentialsConfigured
      />,
    );

    fireEvent.click(screen.getByTestId("nango-connect-button"));

    const calls = __getReplaceCalls();
    expect(calls).toHaveLength(1);
    expect(calls[0]).toContain("error=authorization-failed");
    // The raw simulated provider message must never reach the URL.
    expect(calls[0]).not.toContain("Simulated");
    expect(calls[0]).not.toContain("provider");
  });

  it("preserves any other existing query params when writing the error code", () => {
    __setSearchParams("tab=advanced");
    render(
      <LinkedInConnectSection
        connected={true}
        reconnectConnectionId="conn-123"
        nangoFrontendConfig={{}}
        credentialsConfigured
      />,
    );

    fireEvent.click(screen.getByTestId("nango-connect-button"));

    const calls = __getReplaceCalls();
    expect(calls).toHaveLength(1);
    expect(calls[0]).toContain("tab=advanced");
    expect(calls[0]).toContain("error=authorization-failed");
  });

  it("disables the button and passes the prerequisite message when credentials aren't configured", () => {
    render(
      <LinkedInConnectSection
        connected={false}
        nangoFrontendConfig={{}}
        credentialsConfigured={false}
      />,
    );

    expect((screen.getByTestId("nango-connect-button") as HTMLButtonElement).disabled).toBe(true);
  });
});
