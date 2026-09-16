// The migration onto the HOST-SHARED design primitives
// (cinatra-ai/cinatra#3510, slice 3 of cinatra-ai/cinatra#3471, epic #2926 —
// decision 407 of 2026-09-13: "the host shares its primitives with extension
// bundles at run time like React does").
//
// The contract's recipe ("How a package migrates — the three lines a package
// changes") is what this file pins, for this package's ONE frozen-list copy,
// `alert`:
//
//   1. package.json — "do not declare `@cinatra-ai/design-primitives` as a
//      dependency or a peer. The id is VIRTUAL". Any specifier (an optional
//      peer included) makes the install 404.
//   2. the imports — "replace every `from "./ui/<item>"` /
//      `from "../components/ui/<item>"` with
//      `from "@cinatra-ai/design-primitives"`".
//   3. the copies — "delete `src/components/ui/<item>.tsx` for every primitive
//      in the frozen list".
//
// This connector's setup page is source-COMPILED by the host (the build-time
// road of the contract's "Two roads" section: the host's own tsconfig path maps
// the id onto `src/lib/artifacts/host-shared-primitives.ts`), so the import line
// is the whole package-side change; there is no client renderer bundle here and
// therefore no preamble field to declare.
//
// A regression here is silent in this repo's own CI (a standalone extension
// mirror skips install/typecheck/test), which is exactly why the copy and the
// copy-shaped import are pinned as SOURCE facts rather than left to a type
// error in the monorepo.

import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import * as path from "node:path";
import { describe, expect, it } from "vitest";

const PACKAGE_NAME = "@cinatra-ai/linkedin-connector";

/**
 * This package's root, found by walking up from the working directory to the
 * package.json that names it. `import.meta.url` is not a file URL under this
 * repo's jsdom test environment, and the run directory is not guaranteed, so
 * the manifest's own name is what anchors the walk.
 */
function packageRoot(): string {
  let dir = process.cwd();
  for (;;) {
    const manifest = path.join(dir, "package.json");
    if (existsSync(manifest)) {
      const parsed = JSON.parse(readFileSync(manifest, "utf8")) as { name?: string };
      if (parsed.name === PACKAGE_NAME) return dir;
    }
    const parent = path.dirname(dir);
    if (parent === dir) throw new Error(`${PACKAGE_NAME} root not found above ${process.cwd()}`);
    dir = parent;
  }
}

const REPO_ROOT = packageRoot();
const SRC = path.join(REPO_ROOT, "src");

/** The host-neutral module id the contract fixes (`HOST_DESIGN_PRIMITIVES_MODULE`). */
const SHARED_MODULE = "@cinatra-ai/design-primitives";

/** Every `.ts`/`.tsx` file under src/, excluding this package's own tests. */
function sourceFiles(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = path.join(dir, entry);
    if (statSync(full).isDirectory()) {
      if (entry === "__tests__") continue;
      out.push(...sourceFiles(full));
      continue;
    }
    if (entry.endsWith(".ts") || entry.endsWith(".tsx")) out.push(full);
  }
  return out;
}

/** Relative import specifiers of a source file, in source order. */
function relativeImports(contents: string): string[] {
  return [...contents.matchAll(/from\s+["'](\.[^"']*)["']/g)].map((m) => m[1]);
}

describe("host-shared design primitives (cinatra#3510)", () => {
  it("keeps no byte copy of a product primitive under src/components/ui/", () => {
    const uiDir = path.join(SRC, "components", "ui");
    const remaining = existsSync(uiDir) ? readdirSync(uiDir) : [];
    expect(remaining).toEqual([]);
    expect(existsSync(uiDir)).toBe(false);
  });

  it("imports no product-primitive copy from any source file", () => {
    const offenders: string[] = [];
    for (const file of sourceFiles(SRC)) {
      for (const specifier of relativeImports(readFileSync(file, "utf8"))) {
        if (/(^|\/)(components\/)?ui\//.test(specifier)) {
          offenders.push(`${path.relative(REPO_ROOT, file)} -> ${specifier}`);
        }
      }
    }
    expect(offenders).toEqual([]);
  });

  it("takes Alert and AlertDescription from the host-shared module", () => {
    const impl = readFileSync(path.join(SRC, "linkedin-setup-impl.tsx"), "utf8");
    const line = impl
      .split("\n")
      .find((candidate) => candidate.includes(`from "${SHARED_MODULE}"`));
    expect(line).toBeDefined();
    expect(line).toContain("Alert");
    expect(line).toContain("AlertDescription");
  });

  it("declares the virtual module id neither as a dependency nor as a peer", () => {
    const manifest = JSON.parse(
      readFileSync(path.join(REPO_ROOT, "package.json"), "utf8"),
    ) as Record<string, Record<string, unknown> | undefined>;
    const declared = [
      "dependencies",
      "devDependencies",
      "optionalDependencies",
      "peerDependencies",
      "peerDependenciesMeta",
    ].filter((field) => Object.keys(manifest[field] ?? {}).includes(SHARED_MODULE));
    expect(declared).toEqual([]);
  });
});
