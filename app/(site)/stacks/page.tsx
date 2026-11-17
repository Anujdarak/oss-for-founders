import type { Metadata } from "next"
import Link from "next/link"
import { LayersIcon } from "lucide-react"

import { resolveStack, stacks } from "@/lib/stacks"
import { SITE } from "@/lib/site"

export const metadata: Metadata = {
  title: "Stacks",
  description:
    "Curated sets of open-source tools that work together, one pick per layer.",
  openGraph: {
    title: `Stacks · ${SITE.name}`,
    description: "Curated sets of open-source tools that work together.",
    url: `${SITE.url}/stacks`,
    siteName: SITE.name,
  },
}

export default function StacksPage() {
  return (
    <div className="mx-auto w-full max-w-3xl space-y-6 px-4 py-12">
      <div className="space-y-3">
        <div className="flex items-center gap-2 text-muted-foreground">
          <LayersIcon className="size-4" aria-hidden />
          <span className="text-xs font-medium tracking-wide uppercase">Stacks</span>
        </div>
        <h1 className="text-2xl font-semibold tracking-tight">
          Sets that work together
        </h1>
        <p className="max-w-prose text-sm text-muted-foreground">
          Hand-picked groupings, one tool per layer, drawn from the entries in
          this catalogue. These are opinions about what fits together, not
          benchmarks.
        </p>
      </div>

      <ul className="divide-y divide-border border-y border-border">
        {stacks.map((stack) => {
          const items = resolveStack(stack)
          const available = items.filter((item) => item.repo).length

          return (
            <li key={stack.slug}>
              <Link
                href={`/stacks/${stack.slug}`}
                className="block space-y-1.5 px-1 py-4 transition-colors hover:bg-muted/50 focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
              >
                <div className="flex items-baseline gap-2">
                  <span className="text-sm font-medium">{stack.title}</span>
                  <span className="font-mono text-xs text-muted-foreground">
                    {available} {available === 1 ? "repo" : "repos"}
                  </span>
                </div>
                <p className="max-w-prose text-sm text-muted-foreground">
                  {stack.summary}
                </p>
                <p className="font-mono text-xs text-muted-foreground">
                  {items.map((item) => item.role).join(" · ")}
                </p>
              </Link>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
