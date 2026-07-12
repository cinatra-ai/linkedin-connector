// Regression pins for the setup-page tab restructure (cinatra-ai/linkedin-connector#54,
// connector-setup-tabs epic cinatra-ai/cinatra#1101). `linkedin-setup-impl.tsx`
// is an async `server-only` server component composed from `@cinatra-ai/sdk-ui/*`
// primitives this package does not resolve in isolation (host-provided at
// build time) and that import a `server-only` guard which throws when
// evaluated outside a real server bundler condition — the same reason a DOM
// render test can't mount it directly here (see the sibling
// linkedin-setup-tabs.dom.test.tsx, which instead exercises the REAL Tabs
// primitive against this connector's exact tab declarations). Matching the
// established pattern for this class of file in the connector-setup-tabs
// epic (e.g. google-calendar-connector's setup-page-review.test.ts), these
// pins assert against the authored source of ../linkedin-setup-impl.tsx so a
// regression names the exact acceptance item it breaks.
import { describe, it, expect } from "vitest";
import { readFileSync, existsSync } from "node:fs";
import * as path from "node:path";

// `path.join(__dirname, ...)` rather than `new URL(..., import.meta.url)` +
// `fileURLToPath` — under this repo's jsdom test environment the global
// `URL` is jsdom's browser implementation, not Node's, and
// `fileURLToPath` rejects it ("The URL must be of scheme file").
const THIS_DIR = __dirname;
const SETUP_IMPL_PATH = path.join(THIS_DIR, "..", "linkedin-setup-impl.tsx");

const src = readFileSync(SETUP_IMPL_PATH, "utf8");

// Collapse insignificant JSX whitespace so multi-line elements match as text.
const flat = src.replace(/\s+/g, " ");

describe("linkedin-setup-impl — tabbed setup page (issue #54)", () => {
  it("imports the shared sdk-ui Tabs primitive, not a hand-rolled or copied tablist", () => {
    expect(src).toContain('from "@cinatra-ai/sdk-ui/tabs"');
    expect(src).toContain("TabsListRow");
    // The boundary-respect + no-copied-tabs.tsx acceptance items: this repo
    // must not vendor a product copy of the primitive (the __tests__ stub is
    // test-only infra, not a product file).
    expect(existsSync(path.join(THIS_DIR, "..", "components", "ui", "tabs.tsx"))).toBe(false);
    expect(existsSync(path.join(THIS_DIR, "..", "ui", "tabs.tsx"))).toBe(false);
  });

  it("declares exactly two tab triggers, in order Setup then Help", () => {
    const triggerOrder = [...flat.matchAll(/<TabsTrigger value="([^"]+)">/g)].map((m) => m[1]);
    expect(triggerOrder).toEqual(["setup", "help"]);
  });

  it("the Help tab is always LAST", () => {
    const triggerOrder = [...flat.matchAll(/<TabsTrigger value="([^"]+)">/g)].map((m) => m[1]);
    expect(triggerOrder.at(-1)).toBe("help");
  });

  it("single-connection layout: no Connections tab (this connector is per-user single-connection, not multi-instance)", () => {
    expect(src).not.toContain('value="connections"');
    expect(src).not.toContain(">Connections<");
  });

  it("the Setup tab content maps to the connect section and the destinations section", () => {
    const setupPanelMatch = flat.match(
      /<TabsContent value="setup"[^>]*>(.*?)<\/TabsContent>/,
    );
    expect(setupPanelMatch).not.toBeNull();
    const setupPanel = setupPanelMatch![1];
    expect(setupPanel).toContain("<LinkedInConnectSection");
    expect(setupPanel).toContain("Publishing destinations");
  });

  it("the Help tab content is read-only setup how-to (no form, no Save action) and does not repeat the connect button", () => {
    const helpPanelMatch = flat.match(
      /<TabsContent value="help"[^>]*>(.*?)<\/TabsContent>\s*<\/Tabs>/,
    );
    expect(helpPanelMatch).not.toBeNull();
    const helpPanel = helpPanelMatch![1];
    expect(helpPanel).not.toContain("<form");
    expect(helpPanel).not.toContain(">Save<");
    expect(helpPanel).not.toContain("<LinkedInConnectSection");
  });

  it("the tab row draws the section rule (TabsListRow), so the page header renders no divider (never stack two rules)", () => {
    expect(flat).toContain('<PageHeader title="LinkedIn"');
    const headerMatch = flat.match(/<PageHeader title="LinkedIn"[^>]*\/>/);
    expect(headerMatch).not.toBeNull();
    expect(headerMatch![0]).toContain("divider={false}");
  });
});
