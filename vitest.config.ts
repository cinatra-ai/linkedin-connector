import { defineConfig } from "vitest/config";
import * as path from "node:path";
import { createRequire } from "node:module";

// Test-only fallback aliases for packages this repo can't resolve standalone.
//
// This repo declares @cinatra-ai/sdk-extensions + @cinatra-ai/sdk-ui as
// OPTIONAL peerDependencies (see package.json + .github/workflows/ci.yml) —
// they're host-internal packages that live only in the cinatra monorepo,
// which is also where this repo's tests run for real once the monorepo
// workspace-links this package (CI here SKIPS standalone install/test for
// exactly that reason). `sonner` (sdk-ui's own peerDependency) and
// `next/navigation` (the host's router, real only inside a Next app) are
// unresolvable standalone for the same reason.
//
// To let THIS repo's own `vitest run` still exercise the toast-migration
// wiring (linkedin-setup-impl.tsx / linkedin-connect-section.tsx ->
// SearchParamToast) without those installed, each entry below aliases to a
// byte-faithful vendored stub under src/__tests__/__stubs__/ (see that
// directory's file comments for provenance + re-vendor instructions) — but
// ONLY when the real specifier fails to resolve. Inside the cinatra monorepo,
// where every one of these IS resolvable via the workspace, resolution
// succeeds and no alias applies, so the monorepo's test run exercises the
// real host code, never a stub.
const stubs = path.join(__dirname, "src/__tests__/__stubs__");
// `@cinatra-ai/sdk-ui/tabs`'s stub lives under `__tests__/fixtures/`, not
// `__tests__/__stubs__/` — it is the one stub that imports `radix-ui`
// directly (the real primitive's own implementation), which the org
// ui-design-system lint gate bans outside `components/ui`/`src/ui`;
// `__tests__/fixtures/**` is that gate's documented lint-fixture carve-out.
const fixtures = path.join(__dirname, "src/__tests__/fixtures");
const require = createRequire(import.meta.url);

function resolvableOrStub(specifier: string, stubFile: string, stubDir = stubs) {
  try {
    require.resolve(specifier);
    return null;
  } catch {
    return { find: specifier, replacement: path.join(stubDir, stubFile) };
  }
}

// Aliased in BOTH layouts, never conditionally (cinatra#2288). Four of the
// specifiers below are test SEAMS or inert guards, not host code under test,
// and "use the real one when the monorepo resolves it" is wrong for each:
//
//   * `next/navigation` — `useRouter()` throws
//     `invariant expected app router to be mounted` outside a mounted Next App
//     Router. Inside the monorepo the real module resolves, the conditional
//     alias stepped aside, and all 7 DOM assertions in this repo died on that
//     invariant — in the very layout this repo's own CI defers its tests to.
//   * `sonner` — the assertions are
//     `expect(toast.error).toHaveBeenCalledWith(...)` against the vi.fn()
//     spies the TEST imports from `./__stubs__/sonner`. If the component
//     resolves the real `sonner`, it calls a different object and the
//     assertion can only be vacuous or red.
//   * `server-only` — a bare `throw` outside a bundler `react-server`
//     condition; it made src/__tests__/register.test.ts uncollectable
//     ("0 test") in both layouts since the file was added. See
//     __stubs__/server-only.ts.
//   * `@cinatra-ai/sdk-ui/marketplace` — __stubs__/sdk-ui-marketplace.tsx is a
//     behaviour SIMULATOR, not a resolution fallback: its
//     <NangoUserConnectButton> fires `onError("Simulated Nango Connect UI
//     provider error")` on click and carries `data-testid=
//     "nango-connect-button"`. The real button has neither — it opens a real
//     Nango Connect session — so with the real module resolved, the
//     connect-section test could not find its button OR provoke the error path
//     it exists to pin. Note the breadth: this alias covers the WHOLE
//     `marketplace` entrypoint, so `Main` / `PageHeader` / `PageContent` /
//     `StatusPill` resolve to the stub too. A test-local `vi.mock` would be
//     narrower, but it needs the specifier to RESOLVE — which it does not in
//     the standalone layout — so the alias is the only form that works in both.
//
// The code actually exercised is unchanged: the real
// `@cinatra-ai/sdk-ui` <SearchParamToast>, this repo's real
// linkedin-connect-section.tsx, and its real register()/flash config.
function alwaysStub(specifier: string, stubFile: string, stubDir = stubs) {
  return { find: specifier, replacement: path.join(stubDir, stubFile) };
}

const alias = [
  resolvableOrStub("@cinatra-ai/sdk-ui/search-param-toast", "search-param-toast.tsx"),
  alwaysStub("@cinatra-ai/sdk-ui/marketplace", "sdk-ui-marketplace.tsx"),
  resolvableOrStub("@cinatra-ai/sdk-ui/tabs", "tabs.tsx", fixtures),
  alwaysStub("next/navigation", "next-navigation.ts"),
  alwaysStub("sonner", "sonner.ts"),
  alwaysStub("server-only", "server-only.ts"),
].filter((entry): entry is { find: string; replacement: string } => entry !== null);

export default defineConfig({
  test: {
    environment: "jsdom",
    include: ["src/__tests__/**/*.test.ts", "src/__tests__/**/*.test.tsx"],
    exclude: ["**/node_modules/**"],
  },
  resolve: { alias },
});
