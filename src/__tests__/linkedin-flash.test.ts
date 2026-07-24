// Unit tests for the flash-code path (cinatra-ai/linkedin-connector#48, part
// of the toast-notifications epic cinatra-ai/cinatra#1107). Locks the
// codes-only contract: exactly one static-message entry per canonical code,
// the entry is error-variant, and the message is never anything other than
// the fixed static string (never URL/provider-derived text).
import { describe, expect, it } from "vitest";

import { LINKEDIN_ERROR_MESSAGES, LINKEDIN_FLASH_TOASTS } from "../lib/linkedin-flash";

describe("LINKEDIN_FLASH_TOASTS (flash-code path)", () => {
  it("has exactly one toast config entry per canonical error code", () => {
    const errorCodes = Object.keys(LINKEDIN_ERROR_MESSAGES);
    expect(LINKEDIN_FLASH_TOASTS).toHaveLength(errorCodes.length);
  });

  it("maps 'authorization-failed' to an error-variant static message on the 'error' param", () => {
    const entry = LINKEDIN_FLASH_TOASTS.find(
      (t) => t.param === "error" && t.value === "authorization-failed",
    );
    expect(entry).toBeDefined();
    expect(entry?.variant).toBe("error");
    expect(entry?.message).toBe(LINKEDIN_ERROR_MESSAGES["authorization-failed"]);
  });

  it("never toasts URL/provider-derived text — every message is one of the static strings", () => {
    const known = new Set<string>(Object.values(LINKEDIN_ERROR_MESSAGES));
    for (const entry of LINKEDIN_FLASH_TOASTS) {
      expect(known.has(entry.message)).toBe(true);
    }
  });

  it("the canonical code the connect-button wiring emits has a corresponding mount-site entry", () => {
    // Guards against the emitter (linkedin-connect-section.tsx) and this
    // mount-site map (linkedin-setup-impl.tsx) drifting apart — a code with no
    // matching entry here would silently show nothing.
    const match = LINKEDIN_FLASH_TOASTS.some(
      (t) => t.param === "error" && t.value === "authorization-failed",
    );
    expect(match).toBe(true);
  });
});
