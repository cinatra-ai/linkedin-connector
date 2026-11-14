import { describe, it, expect } from "vitest";

import { registerLinkedInPrimitives } from "../mcp/registry";

// cinatra#3745: a tool that publishes on a person's behalf declares `outward` on
// its registration, so the host holds each call of it in an agent run for the
// person's recorded decision. `linkedin_post_publish` takes free text and no stored item, so its declaration names no
// subject: it is exactly `{}`. No other tool of this connector acts outward,
// and none declares it.
describe("linkedin_post_publish declares that it acts outward (cinatra#3745)", () => {
  function registeredConfigs(): Map<string, Record<string, unknown>> {
    const configs = new Map<string, Record<string, unknown>>();
    const server = {
      registerTool: (name: string, config: Record<string, unknown>) => {
        configs.set(name, config);
      },
    } as unknown as Parameters<typeof registerLinkedInPrimitives>[0];
    registerLinkedInPrimitives(server);
    return configs;
  }

  it("registers linkedin_post_publish with outward: {}", () => {
    const config = registeredConfigs().get("linkedin_post_publish");
    expect(config).toBeDefined();
    expect("outward" in config!).toBe(true);
    expect(config!.outward).toEqual({});
  });

  it("declares outward on linkedin_post_publish only", () => {
    const declared = [...registeredConfigs()]
      .filter(([, config]) => "outward" in config)
      .map(([name]) => name);
    expect(declared).toEqual(["linkedin_post_publish"]);
  });
});
