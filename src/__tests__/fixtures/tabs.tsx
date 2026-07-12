// TEST FIXTURE — byte-faithful vendored copy of @cinatra-ai/sdk-ui's
// src/ui/tabs.tsx (cinatra main, commit 994868d2f0b1d93b459985e94a05cf39b14f5749),
// aliased in vitest.config.ts so this repo's own `vitest run` can exercise the
// REAL accessible Tabs semantics (Radix roles/aria/keyboard roving focus) for
// the setup-page tab restructure (cinatra-ai/linkedin-connector#54) without the
// real host-internal package installed. See __stubs__/next-navigation.ts for
// why this repo vendors stubs of host-internal packages for its own standalone
// test run rather than importing the real one. Inside the cinatra monorepo,
// where `@cinatra-ai/sdk-ui/tabs` IS resolvable via the workspace, this alias
// never applies and the monorepo's test run exercises the real package.
//
// Lives under `__tests__/fixtures/` (not `__tests__/__stubs__/`, where the
// repo's other stubs live) deliberately: this is the one stub that needs a
// direct `radix-ui` import (the real primitive's own implementation), which
// the org ui-design-system lint gate bans outside `components/ui`/`src/ui` —
// `__tests__/fixtures/**` is that gate's documented escape valve for a
// repo's own deliberately-violating lint fixtures (tools/ui-design-system.flat.mjs).
// The product code never imports from here.
//
// Only the relative import below is adjusted from the source file's
// `../lib/utils` (packages/sdk-ui/src/lib/utils.ts) to this repo's own
// `../../lib/utils` (src/lib/utils.ts) — both export the same `cn` shape
// (clsx + tailwind-merge). No other line differs from the vendored source.
"use client"

import * as React from "react"
import { Tabs as TabsPrimitive } from "radix-ui"
import { cn } from "../../lib/utils"

function Tabs({
  className,
  ...props
}: React.ComponentProps<typeof TabsPrimitive.Root>) {
  return (
    <TabsPrimitive.Root
      data-slot="tabs"
      className={cn("flex flex-col gap-2", className)}
      {...props}
    />
  )
}

// Underline tabs only; no pill tabs. The list carries the bottom hairline the
// active 2px indigo underline sits on.
function TabsList({
  className,
  ...props
}: React.ComponentProps<typeof TabsPrimitive.List>) {
  return (
    <TabsPrimitive.List
      data-slot="tabs-list"
      className={cn(
        "inline-flex w-fit items-center justify-start gap-4 border-b border-line text-muted-foreground",
        className,
      )}
      {...props}
    />
  )
}

// Active uses a 2px indigo (--primary) underline; inactive labels are slate
// (--muted-foreground). 13px medium sans per the design-system Tabs spec.
function TabsTrigger({
  className,
  ...props
}: React.ComponentProps<typeof TabsPrimitive.Trigger>) {
  return (
    <TabsPrimitive.Trigger
      data-slot="tabs-trigger"
      className={cn(
        "relative inline-flex items-center gap-1.5 whitespace-nowrap px-1 py-2 text-[13px] font-medium text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40 disabled:pointer-events-none disabled:opacity-50",
        // 2px indigo underline on the active state (offset to live just below
        // the row baseline so the click target stays compact).
        "data-[state=active]:text-primary after:pointer-events-none after:absolute after:inset-x-0 after:-bottom-px after:h-[2px] after:bg-transparent data-[state=active]:after:bg-primary",
        "[&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
        className,
      )}
      {...props}
    />
  )
}

function TabsContent({
  className,
  ...props
}: React.ComponentProps<typeof TabsPrimitive.Content>) {
  return (
    <TabsPrimitive.Content
      data-slot="tabs-content"
      className={cn("flex-1 outline-none", className)}
      {...props}
    />
  )
}

// design spec §Tabs + §Dividers — when the tablist sits directly under a
// PageHeader, the etched paired-line rule begins to the RIGHT of the last tab
// and stretches to the page edge: the tablist takes the left portion of the
// row, the rule the right (never overlap the rule with a tab, never stack two
// rules). Use TabsListRow in place of TabsList for that row, and pair it with a
// header that renders no divider so the rule does not stack with a header rule
// above.
//
// Host parity: `src/components/ui/tabs.tsx` composes this from a Separator
// (`major`) component. To keep the primitive dependency-light (no host
// Separator import, no `@/`
// app-local alias — portability is a hard contract for bundled-react
// connectors), the etched rule here is the decorative `.divider-etched` utility
// (from `@cinatra-ai/design/utilities.css`, already imported by every Cinatra
// surface) on a `role="none"` element — the identical rendered paired-line.
function TabsListRow({
  className,
  children,
  ...props
}: React.ComponentProps<typeof TabsPrimitive.List>) {
  return (
    <div className="grid grid-cols-[auto_1fr] items-end gap-7">
      <TabsList className={cn("border-b-0", className)} {...props}>
        {children}
      </TabsList>
      <div
        role="none"
        aria-hidden
        data-slot="separator"
        data-major
        className="divider-etched mb-[11px] self-end bg-transparent"
      />
    </div>
  )
}

export { Tabs, TabsList, TabsListRow, TabsTrigger, TabsContent }
