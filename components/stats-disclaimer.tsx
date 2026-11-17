import { cn } from "cn"

import { formatDate } from "@/lib/format"

/**
 * Says plainly where the numbers come from and when they were true. Stars and
 * issue counts committed to a JSON file start aging immediately, so the date is
 * part of the claim rather than a footnote.
 */
export function StatsDisclaimer({
  updatedAt,
  className,
}: {
  updatedAt: string | undefined
  className?: string
}) {
  return (
    <p className={cn("text-xs text-muted-foreground", className)}>
      {updatedAt ? (
        <>
          Stats updated{" "}
          <span className="font-mono">{formatDate(updatedAt)}</span>.{" "}
        </>
      ) : null}
      Stars, forks, issue counts, and dates are a snapshot read from the GitHub
      REST API, not a live figure. This site makes no requests to GitHub when you
      load a page.
    </p>
  )
}
