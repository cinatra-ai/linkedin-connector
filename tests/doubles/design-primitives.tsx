// TEST-ONLY local double of the HOST-SHARED design primitives module
// (`@cinatra-ai/design-primitives`, cinatra-ai/cinatra#3510).
//
// The module id is VIRTUAL: the contract
// (docs/internals/contracts/host-shared-primitives-contract.md) fixes it as
// host-neutral and says no package is published under it — "the id is VIRTUAL:
// the host serves it at run time and no package is published under it, so *any*
// specifier — optional peer included — makes the install fail". The host
// resolves it for this connector's source-COMPILED setup page through its own
// `compilerOptions.paths` entry onto `src/lib/artifacts/host-shared-primitives.ts`
// (the contract's BUILD-TIME road). Outside the host there is nothing to
// resolve, so this repo's standalone `vitest run` aliases the id here
// (vitest.config.ts, `resolvableOrStub`) — the same shape the other
// host-internal specifiers take, and only while the specifier does not resolve:
// where the id IS resolvable the real module is used and this file is inert.
//
// DELIBERATELY NOT A COPY of the product primitive. It carries no variant
// table, no class strings and no `cn` call — copying those back would
// reintroduce, under another name, exactly the byte copy #3510 removes. It
// implements ONLY the two frozen-list names this package uses (`Alert`,
// `AlertDescription` — the `alert` row of the contract's frozen export list
// also carries `AlertTitle`, which this package does not use), with the
// `data-slot` / `role` hooks the page's own DOM tests reach for.
//
// It lives OUTSIDE src/ so it can never be mistaken for package source, and
// outside the package's published `files` set.

import * as React from "react";

export function Alert({ className, ...props }: React.ComponentProps<"div">) {
  return <div data-slot="alert" role="alert" className={className} {...props} />;
}

export function AlertDescription({ className, ...props }: React.ComponentProps<"div">) {
  return <div data-slot="alert-description" className={className} {...props} />;
}
