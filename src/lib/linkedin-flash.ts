// -----------------------------------------------------------------------------
// LinkedIn setup page codes-only flash protocol (cinatra-ai/linkedin-connector#48,
// part of cinatra-ai/cinatra#1107).
//
// The OAuth connect flow (NangoUserConnectButton's `onError` event, wired in
// ./linkedin-connect-section.tsx) reports a failed connect attempt by writing a
// canonical CODE onto `?error=<code>` (client-side `router.replace`, no server
// round trip). The <SearchParamToast> island mounted in linkedin-setup-impl.tsx
// maps that code to a STATIC message here — it NEVER toasts the raw provider
// error text, so a crafted `?error=<spoofed link>` maps to no entry and is never
// toasted (same codes-only stance as the host setup wizard's setup-flash.ts).
//
// SearchParamToast's one-shot param-strip ALSO retires the old
// "suppress the stale authorization-expired error once reconnected" hack: once
// the toast fires, the param is gone from the URL, so a subsequent
// router.refresh() after a successful reconnect has nothing stale to replay.
// -----------------------------------------------------------------------------

import type { SearchParamToastConfig } from "@cinatra-ai/sdk-ui/search-param-toast";

export const LINKEDIN_ERROR_MESSAGES = {
  "authorization-failed": "LinkedIn authorization failed. Please try connecting your account again.",
} as const;

export type LinkedInErrorCode = keyof typeof LINKEDIN_ERROR_MESSAGES;

// One <SearchParamToast> config entry per code: all on the `error` param,
// rendered as an error-variant toast, with the STATIC message above. Passed to
// the island mounted in linkedin-setup-impl.tsx.
export const LINKEDIN_FLASH_TOASTS: SearchParamToastConfig[] = Object.entries(
  LINKEDIN_ERROR_MESSAGES,
).map(([code, message]) => ({
  param: "error",
  value: code,
  message,
  variant: "error" as const,
}));
