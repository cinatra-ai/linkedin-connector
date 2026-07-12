// @vitest-environment jsdom
//
// Component test for the setup-page tab restructure (cinatra-ai/linkedin-connector#54,
// connector-setup-tabs epic cinatra-ai/cinatra#1101). `linkedin-setup-impl.tsx`
// is a `server-only` async server component (reads `ctx.authSession` /
// `ctx.nango` / the host-bound deps slot) — importing it directly in a plain
// jsdom vitest run trips the `server-only` package's client-import guard, the
// same reason no other test in this repo renders it directly (see
// linkedin-setup-page-tabs.test.ts for the source-text pin covering that
// file's actual wiring).
//
// This test instead mounts the REAL `@cinatra-ai/sdk-ui/tabs` primitive (via
// the byte-faithful vendored stub, __stubs__/tabs.tsx — real Radix roles/aria/
// keyboard roving focus, not a hand-rolled mock) with the EXACT tab
// declarations `linkedin-setup-impl.tsx` renders — same `value`s, same order,
// same trigger labels — giving real DOM/a11y coverage of tab presence, order,
// content mapping, and keyboard semantics for this connector's actual tablist.
// No jest-dom matchers (not installed in this repo — see the plain assertions
// used by the sibling *.dom.test.tsx files) — plain attribute/DOM checks only.
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import React from "react";

import { Tabs, TabsContent, TabsListRow, TabsTrigger } from "@cinatra-ai/sdk-ui/tabs";

// Mirrors the exact tablist `linkedin-setup-impl.tsx` renders: Setup, then
// the reserved Help tab, ALWAYS last — this connector holds a single
// per-user connection and declares no other custom config tab.
function LinkedInSetupTabsHarness() {
  return (
    <Tabs defaultValue="setup" className="w-full">
      <TabsListRow aria-label="LinkedIn connector setup">
        <TabsTrigger value="setup">Setup</TabsTrigger>
        <TabsTrigger value="help">Help</TabsTrigger>
      </TabsListRow>
      <TabsContent value="setup" forceMount className="data-[state=inactive]:hidden">
        <div data-testid="setup-connect-section">LinkedIn account — connect UI</div>
        <div data-testid="setup-destinations-section">Publishing destinations</div>
      </TabsContent>
      <TabsContent value="help" forceMount className="data-[state=inactive]:hidden">
        <div data-testid="help-content">Setup how-to — read only, no Save.</div>
      </TabsContent>
    </Tabs>
  );
}

describe("LinkedIn connector setup — tabbed layout (Help last)", () => {
  afterEach(() => {
    cleanup();
  });

  it("renders exactly two tabs, in order Setup then Help", () => {
    render(<LinkedInSetupTabsHarness />);
    const tabs = screen.getAllByRole("tab");
    expect(tabs).toHaveLength(2);
    expect(tabs.map((tab) => tab.textContent)).toEqual(["Setup", "Help"]);
  });

  it("Help is always the LAST tab", () => {
    render(<LinkedInSetupTabsHarness />);
    const tabs = screen.getAllByRole("tab");
    expect(tabs.at(-1)?.textContent).toBe("Help");
  });

  it("carries full accessible tab semantics: tablist/tab/tabpanel roles, aria-selected, tab order", () => {
    render(<LinkedInSetupTabsHarness />);
    const tablist = screen.getByRole("tablist", { name: "LinkedIn connector setup" });
    const tabs = within(tablist).getAllByRole("tab");
    expect(tabs).toHaveLength(2);

    const setupTab = screen.getByRole("tab", { name: "Setup" });
    const helpTab = screen.getByRole("tab", { name: "Help" });
    expect(setupTab.getAttribute("aria-selected")).toBe("true");
    expect(helpTab.getAttribute("aria-selected")).toBe("false");

    // Default-active panel is Setup's, addressed by the active tab's
    // aria-controls. Both panels are `forceMount`ed (present in the DOM,
    // inactive one hidden only via the `data-[state=inactive]:hidden` CSS
    // class jsdom does not compute), so query by `data-state="active"`
    // rather than the ambiguous `getByRole("tabpanel")`.
    const activePanel = document.querySelector('[role="tabpanel"][data-state="active"]');
    expect(activePanel).not.toBeNull();
    expect(activePanel!.getAttribute("id")).toBe(setupTab.getAttribute("aria-controls"));
    expect(within(activePanel as HTMLElement).getByTestId("setup-connect-section")).toBeTruthy();
    expect(within(activePanel as HTMLElement).getByTestId("setup-destinations-section")).toBeTruthy();
  });

  it("maps each tab to its own content — Setup shows the connect UI, Help shows the read-only how-to", () => {
    render(<LinkedInSetupTabsHarness />);
    const setupTab = screen.getByRole("tab", { name: "Setup" });
    const setupPanelId = setupTab.getAttribute("aria-controls");
    const setupPanel = document.getElementById(setupPanelId!);
    expect(setupPanel).not.toBeNull();
    expect(within(setupPanel as HTMLElement).getByTestId("setup-connect-section")).toBeTruthy();
    expect(within(setupPanel as HTMLElement).queryByTestId("help-content")).toBeNull();
  });

  it("keyboard ArrowRight roves focus from Setup and lands on Help, updating aria-selected", async () => {
    render(<LinkedInSetupTabsHarness />);
    const setupTab = screen.getByRole("tab", { name: "Setup" });
    const helpTab = screen.getByRole("tab", { name: "Help" });

    setupTab.focus();
    expect(document.activeElement).toBe(setupTab);

    fireEvent.keyDown(setupTab, { key: "ArrowRight", code: "ArrowRight" });

    // Radix's roving-focus-group moves focus in a `setTimeout(0)` (not
    // synchronously within the keydown handler) — wait a tick for it to run.
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(document.activeElement).toBe(helpTab);
    // Default `activationMode="automatic"`: focusing a tab also activates it
    // (Tabs.Trigger's onFocus), so the selected panel follows focus.
    expect(helpTab.getAttribute("aria-selected")).toBe("true");
    expect(setupTab.getAttribute("aria-selected")).toBe("false");
    expect(helpTab.getAttribute("tabIndex")).toBe("0");
    expect(setupTab.getAttribute("tabIndex")).toBe("-1");
  });
});
