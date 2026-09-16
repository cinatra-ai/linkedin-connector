// The host-shared primitives module id must RESOLVE for this repo's own test
// run (cinatra-ai/cinatra#3510, slice 3 of cinatra-ai/cinatra#3471).
//
// `@cinatra-ai/design-primitives` is VIRTUAL: the contract
// (docs/internals/contracts/host-shared-primitives-contract.md) publishes no
// package under it — inside the host it resolves through the host's own
// `compilerOptions.paths` entry onto `src/lib/artifacts/host-shared-primitives.ts`
// (the contract's BUILD-TIME road, which this connector's source-compiled setup
// page takes). Outside the host nothing resolves it, so `linkedin-setup-impl.tsx`
// could not be loaded in a standalone run at all; this repo's vitest alias
// (vitest.config.ts) points the id at the test-only double under tests/doubles/.
// The SDK publishes no double of its own, which is why this repo keeps one.
//
// This file is deliberately separate from no-product-primitive-copies.test.ts:
// an unresolvable specifier fails at transform time and would take that file's
// source-fact assertions down with it instead of reporting them one by one.
import { describe, expect, it } from "vitest";

describe("@cinatra-ai/design-primitives (cinatra#3510)", () => {
  it("resolves outside the host and serves the names the setup page imports", async () => {
    const shared = (await import("@cinatra-ai/design-primitives")) as Record<string, unknown>;
    expect(typeof shared.Alert).toBe("function");
    expect(typeof shared.AlertDescription).toBe("function");
  });
});
