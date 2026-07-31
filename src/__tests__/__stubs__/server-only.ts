// TEST STUB — replaces the real `server-only` package, aliased in
// vitest.config.ts.
//
// `server-only`'s default export condition is a module whose only statement is
// a `throw` ("This module cannot be imported from a Client Component module").
// It is inert ONLY under a bundler's `react-server` condition, which vitest
// does not set — so any test that imports a module carrying the
// `import "server-only"` guard (here: ../register, via src/register.ts) dies at
// COLLECTION, in both layouts:
//   * standalone — `server-only` is not a dependency of this repo at all
//     ("Cannot find package 'server-only'");
//   * inside the cinatra monorepo — it resolves through hoisting, and throws.
// That is why src/__tests__/register.test.ts reported "0 test" and a failed
// suite everywhere it ran (cinatra#2288).
//
// Same shape as the host's own tests/__stubs__/server-only.ts, which
// sibling connectors (openai-connector, twenty-connector) alias for exactly
// this reason. Kept repo-local so it works in BOTH layouts.
export {};
