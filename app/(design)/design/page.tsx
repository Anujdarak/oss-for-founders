import Link from "next/link"

import { Gallery } from "@/components/design/gallery"

export default function DesignPage() {
  return (
    <div className="mx-auto w-full max-w-[100rem] px-4 py-10">
      <header className="space-y-2 pb-8">
        <h1 className="text-xl font-semibold tracking-tight">Design system</h1>
        <p className="max-w-prose text-sm text-muted-foreground">
          Every base component, rendered twice. This document is pinned to the
          light theme so the dark panel can be nested inside it.
        </p>
        <Link
          href="/"
          className="inline-block text-sm text-primary underline-offset-4 hover:underline focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
        >
          Back to the site
        </Link>
      </header>

      <div className="grid items-start gap-6 xl:grid-cols-2">
        <section className="overflow-hidden rounded-lg border border-border">
          <div className="bg-background p-5">
            <p className="pb-5 text-xs font-medium tracking-wide text-muted-foreground uppercase">
              Light
            </p>
            <Gallery />
          </div>
        </section>

        <section className="overflow-hidden rounded-lg border border-border">
          <div className="dark bg-background p-5 text-foreground">
            <p className="pb-5 text-xs font-medium tracking-wide text-muted-foreground uppercase">
              Dark
            </p>
            <Gallery />
          </div>
        </section>
      </div>
    </div>
  )
}
