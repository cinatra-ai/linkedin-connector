// @vitest-environment jsdom
//
// DOM render test of the toast state (toast-notifications epic, S6): mounts
// the real <SearchParamToast> island with THIS connector's real
// LINKEDIN_FLASH_TOASTS config, and asserts the exact toast variant + static
// message fires for the "authorization-failed" code the OAuth connect-button
// wiring emits, with zero toast calls when no flash code is present and a
// crafted/unknown code never toasted (codes-only protocol).
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render } from "@testing-library/react";
import React from "react";

import { SearchParamToast } from "@cinatra-ai/sdk-ui/search-param-toast";
import { toast, __resetSonnerStub } from "./__stubs__/sonner";
import { __resetNavigationStub, __setSearchParams } from "./__stubs__/next-navigation";
import { LINKEDIN_ERROR_MESSAGES, LINKEDIN_FLASH_TOASTS } from "../lib/linkedin-flash";

function renderIsland() {
  return render(<SearchParamToast toasts={LINKEDIN_FLASH_TOASTS} />);
}

describe("LinkedIn setup — SearchParamToast DOM render", () => {
  afterEach(() => {
    cleanup();
    __resetSonnerStub();
    __resetNavigationStub();
  });

  it("renders nothing visible (island is a null-rendering effect component)", () => {
    const { container } = renderIsland();
    expect(container.innerHTML).toBe("");
  });

  it("fires no toast when the URL carries no flash code", () => {
    __setSearchParams("");
    renderIsland();
    expect(toast.error).not.toHaveBeenCalled();
    expect(toast.success).not.toHaveBeenCalled();
    expect(toast.warning).not.toHaveBeenCalled();
  });

  it("?error=authorization-failed fires an error toast with the static message", () => {
    __setSearchParams("error=authorization-failed");
    renderIsland();
    expect(toast.error).toHaveBeenCalledWith(
      LINKEDIN_ERROR_MESSAGES["authorization-failed"],
      expect.objectContaining({ id: "search-param-toast:error:authorization-failed" }),
    );
    expect(toast.success).not.toHaveBeenCalled();
    expect(toast.warning).not.toHaveBeenCalled();
  });

  it("a crafted/unknown error code is ignored — never toasted (codes-only protocol)", () => {
    __setSearchParams("error=some-spoofed-link-text");
    renderIsland();
    expect(toast.error).not.toHaveBeenCalled();
    expect(toast.success).not.toHaveBeenCalled();
    expect(toast.warning).not.toHaveBeenCalled();
  });
});
