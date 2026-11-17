import Link from "next/link"
import { ChevronLeftIcon, ChevronRightIcon } from "lucide-react"

import { Button } from "@/components/ui/button"

/**
 * Link-based so pages stay shareable and prefetchable.
 *
 * `hrefFor` is supplied by the caller rather than built here: the category page
 * has only `?page`, while /explore has to carry the whole filter set through,
 * and string-patching a query in this component got fiddly fast.
 */
export function Pagination({
  hrefFor,
  page,
  pageCount,
  total,
}: {
  hrefFor: (page: number) => string
  page: number
  pageCount: number
  total: number
}) {
  if (pageCount <= 1) return null

  return (
    <nav
      className="flex flex-wrap items-center justify-between gap-3 border-t border-border pt-4"
      aria-label="Pagination"
    >
      <p className="font-mono text-xs text-muted-foreground">
        Page {page} of {pageCount} · {total} repos
      </p>

      <div className="flex items-center gap-2">
        {page > 1 ? (
          <Button variant="outline" size="sm" asChild>
            <Link href={hrefFor(page - 1)} rel="prev">
              <ChevronLeftIcon />
              Previous
            </Link>
          </Button>
        ) : (
          <Button variant="outline" size="sm" disabled>
            <ChevronLeftIcon />
            Previous
          </Button>
        )}

        {page < pageCount ? (
          <Button variant="outline" size="sm" asChild>
            <Link href={hrefFor(page + 1)} rel="next">
              Next
              <ChevronRightIcon />
            </Link>
          </Button>
        ) : (
          <Button variant="outline" size="sm" disabled>
            Next
            <ChevronRightIcon />
          </Button>
        )}
      </div>
    </nav>
  )
}
