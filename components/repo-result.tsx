import Link from "next/link"
import { ExternalLinkIcon } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { CATEGORY_META } from "@/lib/categories"
import { formatCount, formatMonthYear } from "@/lib/format"
import { docHref } from "@/lib/links"
import { docRepoUrl } from "@/lib/search"
import type { SearchDoc } from "@/lib/search"

/**
 * The compact result row used by the assistant and by search results. Denser
 * than RepoCard on purpose: a recommendation list is scanned, not browsed.
 *
 * `why` is passed in rather than derived here, because only the caller knows
 * what actually matched.
 */
export function RepoResult({
  doc,
  why,
}: {
  doc: SearchDoc
  why?: string
}) {
  return (
    <li className="flex flex-col gap-2 border-t border-border py-3 first:border-t-0">
      <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
        <Link
          href={docHref(doc)}
          className="font-mono text-sm transition-colors hover:text-muted-foreground focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
        >
          {doc.owner}/{doc.name}
        </Link>
        {doc.reviewed ? <Badge>Editor-reviewed</Badge> : null}
        {doc.isHiddenGem ? <Badge variant="secondary">Hidden gem</Badge> : null}
      </div>

      <p className="text-sm text-muted-foreground">{doc.description}</p>

      {why ? (
        <p className="text-xs text-foreground/80">
          <span className="font-medium">Why this matches: </span>
          {why}
        </p>
      ) : null}

      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 font-mono text-xs text-muted-foreground">
        {doc.stars !== undefined ? <span>{formatCount(doc.stars)} stars</span> : null}
        {doc.language ? <span>{doc.language}</span> : null}
        {doc.license ? <span>{doc.license}</span> : null}
        {doc.pushedAt ? <span>updated {formatMonthYear(doc.pushedAt)}</span> : null}
        {/* Inherits `text-muted-foreground` from the row. It used to dim that
            another 30%, which measured 2.71:1 against the page at 12px —
            under the 4.5 AA floor for normal text. */}
        <span>{CATEGORY_META[doc.category].label}</span>
      </div>

      <div className="flex items-center gap-3 text-xs">
        <Link
          href={docHref(doc)}
          className="text-primary transition-colors hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
        >
          Details
        </Link>
        <a
          href={docRepoUrl(doc)}
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-1 text-muted-foreground transition-colors hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
        >
          GitHub
          <ExternalLinkIcon className="size-3" />
        </a>
      </div>
    </li>
  )
}
