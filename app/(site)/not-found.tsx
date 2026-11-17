import Link from "next/link"
import { CompassIcon } from "lucide-react"

import { Button } from "@/components/ui/button"
import { CATEGORIES, CATEGORY_META } from "@/lib/categories"

/**
 * Inside the (site) group, so a 404 keeps the header, footer, and theme rather
 * than dropping the reader onto a bare page.
 */
export default function NotFound() {
  return (
    <div className="mx-auto w-full max-w-3xl space-y-8 px-4 py-20">
      <div className="space-y-3">
        <p className="font-mono text-xs text-muted-foreground">404</p>
        <h1 className="text-2xl font-semibold tracking-tight">
          That page is not here
        </h1>
        <p className="max-w-prose text-sm text-muted-foreground">
          The link may be out of date, or a repo may have been renamed upstream —
          projects do get renamed, and this catalogue follows the canonical name
          GitHub reports.
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Button asChild>
          <Link href="/explore">
            <CompassIcon />
            Browse everything
          </Link>
        </Button>
        <Button variant="outline" asChild>
          <Link href="/">Home</Link>
        </Button>
        <Button variant="ghost" asChild>
          <Link href="/submit">Suggest a repo</Link>
        </Button>
      </div>

      <section className="space-y-3 border-t border-border pt-6">
        <h2 className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
          Categories
        </h2>
        <div className="flex flex-wrap gap-x-4 gap-y-1.5 text-sm">
          {CATEGORIES.map((category) => (
            <Link
              key={category}
              href={`/c/${category}`}
              className="text-muted-foreground transition-colors hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
            >
              {CATEGORY_META[category].label}
            </Link>
          ))}
        </div>
      </section>
    </div>
  )
}
