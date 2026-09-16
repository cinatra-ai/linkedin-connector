// Types for the HOST-SHARED design primitives module
// (`@cinatra-ai/design-primitives`, cinatra-ai/cinatra#3510, slice 3 of
// cinatra-ai/cinatra#3471).
//
// WHY THIS FILE EXISTS. The module id is VIRTUAL: the contract
// (docs/internals/contracts/host-shared-primitives-contract.md) publishes no
// package under it, and its own "What this slice does NOT do" section fixes the
// boundary this file lands on — "The typed contract names the exports, not
// their component types. The contract module is React-free by design (importing
// it must never pull a second copy of anything), so `HostDesignPrimitivesModule`
// is `unknown`-valued: a migrating package types the values against its own
// React types." So the package declares the shapes it consumes, here, against
// the `@types/react` of its OWN devDependencies, for its standalone
// `tsc --noEmit` only.
//
// WHY IT LIVES UNDER `src/__tests__/fixtures/` AND NOWHERE ELSE. An ambient
// `declare module` wins over a tsconfig `paths` mapping for every file of the
// program that reads it. Inside the host this file must therefore never be part
// of the program, or it would shadow the host's REAL module
// (`src/lib/artifacts/host-shared-primitives.ts`, which serves the whole frozen
// export list) and the host build would fail with TS2305 on every name this
// package does not declare — measured on cinatra main:
// tests/fixtures/design-primitives-build-time-import.tsx imports `AlertTitle`
// and `Button` from the id. cinatra main's tsconfig includes `**/*.ts` and
// excludes `**/__tests__/fixtures/**`, and the extension tree is materialised at
// `extensions/cinatra-ai/linkedin-connector/`, so THIS path is inside this
// package's own include (`src/**/*.ts`) and outside the host's program. It is
// also outside the published `files` set (`!src/__tests__`), so no consumer
// installing this package from the registry receives the declaration at all. A
// consumer reading a SOURCE checkout could still pull it into a program of its
// own — by a `files` entry, an import, a triple-slash reference or a config
// that drops the fixtures exclude — and there it would shadow the id the same
// way; `exclude` filters file discovery, it is not a wall against a reference.
// src/__tests__/no-product-primitive-copies.test.ts pins the placement so the
// file cannot drift into a directory the host DOES compile.
//
// WHAT THIS FILE IS NOT.
//   * Not a copy of the product primitive: it carries no implementation, no
//     variant table and no class strings — the byte copy this migration deleted
//     (`src/components/ui/alert.tsx`) never comes back under another name.
//   * Not a dependency on the virtual id: a type-only ambient declaration adds
//     no specifier to package.json, which the contract forbids ("any specifier —
//     optional peer included — makes the install fail").
//   * Not a tsconfig `paths` entry: pointing the id at a local file would turn
//     the contract's BUILD-TIME road into a local copy. Inside the host, the
//     host's own generated path map resolves the id and serves the real module.
//
// ONLY the two frozen-list names this package uses are declared. The contract's
// `alert` row also carries `AlertTitle`; this package does not import it, and an
// export nobody uses is not declared here.
//
// This file is a global script (no top-level import/export) on purpose: a
// top-level import would make it a module, and `declare module` would then be
// read as an augmentation of a module that does not resolve. React types are
// reached through inline `import("react")` types instead.

declare module "@cinatra-ai/design-primitives" {
  /**
   * The `alert` region. The setup page renders it with `className` and
   * children (`<Alert className="rounded-control">…</Alert>`), the props a
   * `div` carries.
   */
  export const Alert: (
    props: import("react").ComponentProps<"div">,
  ) => import("react").ReactElement | null;

  /**
   * The `alert` body. The setup page renders it with children only
   * (`<AlertDescription>…</AlertDescription>`).
   */
  export const AlertDescription: (
    props: import("react").ComponentProps<"div">,
  ) => import("react").ReactElement | null;
}
