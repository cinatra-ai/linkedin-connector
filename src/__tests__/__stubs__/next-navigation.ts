// TEST STUB — a minimal controllable stand-in for next/navigation's
// useSearchParams/usePathname/useRouter, aliased in vitest.config.ts so
// linkedin-setup-toast.dom.test.tsx and linkedin-connect-section.dom.test.tsx
// can drive the SearchParamToast island + the connect-button error wiring
// without a real Next.js router context (this repo has no Next runtime
// installed standalone — the cinatra monorepo provides the real one; see
// package.json + .github/workflows/ci.yml).
import { useSyncExternalStore } from "react";

let current = new URLSearchParams();
const pathname = "/connectors/cinatra-ai/linkedin-connector/setup";
let replaceCalls: string[] = [];
const listeners = new Set<() => void>();

function notify() {
  for (const l of listeners) l();
}

export function __setSearchParams(qs: string) {
  current = new URLSearchParams(qs);
  notify();
}

export function __getReplaceCalls(): string[] {
  return replaceCalls;
}

export function __resetNavigationStub() {
  current = new URLSearchParams();
  replaceCalls = [];
}

export function useSearchParams() {
  return useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    () => current,
  );
}

export function usePathname() {
  return pathname;
}

export function useRouter() {
  return {
    replace: (url: string) => {
      replaceCalls.push(url);
      const [, qs] = url.split("?");
      current = new URLSearchParams(qs ?? "");
      notify();
    },
  };
}
