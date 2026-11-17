import Link from "next/link"
import { XIcon } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  buildHref,
  facetsFor,
  hasActiveFilters,
  SORT_LABELS,
  SORTS,
  toggleCounts,
  type Filters,
} from "@/lib/filters"
import type { Repo } from "@/lib/schema"

/**
 * Entirely `<Link>`-based: every control is a URL, so filtered views are
 * shareable and prerenderable and no filter state lives in the client. The cost
 * is a navigation per click, which on a static site is cheap.
 */
export function FilterBar({
  basePath,
  filters,
  repos,
  showSort = true,
}: {
  basePath: string
  filters: Filters
  /** The set the facet counts are computed against. */
  repos: Repo[]
  showSort?: boolean
}) {
  const languages = facetsFor(repos, filters, "language").slice(0, 8)
  const licenses = facetsFor(repos, filters, "license").slice(0, 6)
  const counts = toggleCounts(repos, filters)

  const toggles = [
    { key: "selfHosted" as const, label: "Self-hosted", count: counts.selfHosted },
    { key: "beginner" as const, label: "Beginner-friendly", count: counts.beginner },
    { key: "reviewed" as const, label: "Reviewed", count: counts.reviewed },
    { key: "gemsOnly" as const, label: "Hidden gems", count: counts.gemsOnly },
  ]

  return (
    <div className="space-y-3 border-y border-border py-3">
      {showSort ? (
        <Row label="Sort">
          {SORTS.map((sort) => (
            <Chip
              key={sort}
              href={buildHref(basePath, filters, { sort })}
              active={filters.sort === sort}
            >
              {SORT_LABELS[sort]}
            </Chip>
          ))}
        </Row>
      ) : null}

      <Row label="Show">
        {toggles.map((toggle) => (
          <Chip
            key={toggle.key}
            href={buildHref(basePath, filters, { [toggle.key]: !filters[toggle.key] })}
            active={filters[toggle.key]}
            // A count of zero is shown rather than hidden: an empty facet is
            // information about the data, not a broken control.
            count={toggle.count}
            disabled={toggle.count === 0 && !filters[toggle.key]}
          >
            {toggle.label}
          </Chip>
        ))}
      </Row>

      {languages.length > 0 ? (
        <Row label="Language">
          {languages.map((facet) => (
            <Chip
              key={facet.value}
              href={buildHref(basePath, filters, {
                language: filters.language === facet.value ? undefined : facet.value,
              })}
              active={filters.language === facet.value}
              count={facet.count}
              mono
            >
              {facet.value}
            </Chip>
          ))}
        </Row>
      ) : null}

      {licenses.length > 0 ? (
        <Row label="Licence">
          {licenses.map((facet) => (
            <Chip
              key={facet.value}
              href={buildHref(basePath, filters, {
                license: filters.license === facet.value ? undefined : facet.value,
              })}
              active={filters.license === facet.value}
              count={facet.count}
              mono
            >
              {facet.value}
            </Chip>
          ))}
        </Row>
      ) : null}

      {hasActiveFilters(filters) ? (
        <div className="flex items-center gap-2 pt-1">
          <Button variant="ghost" size="xs" asChild>
            <Link href={filters.q ? `${basePath}?q=${encodeURIComponent(filters.q)}` : basePath}>
              <XIcon />
              Clear filters
            </Link>
          </Button>
        </div>
      ) : null}
    </div>
  )
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5 sm:flex-row sm:items-baseline sm:gap-3">
      <span className="w-20 shrink-0 text-xs font-medium tracking-wide text-muted-foreground uppercase">
        {label}
      </span>
      <div className="flex flex-wrap items-center gap-1.5">{children}</div>
    </div>
  )
}

function Chip({
  href,
  active,
  count,
  disabled,
  mono,
  children,
}: {
  href: string
  active?: boolean
  count?: number
  disabled?: boolean
  mono?: boolean
  children: React.ReactNode
}) {
  const base =
    "inline-flex items-center gap-1.5 rounded-sm border px-2 py-1 text-xs transition-colors focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
  const state = active
    ? "border-primary bg-primary text-primary-foreground"
    : "border-border text-muted-foreground hover:border-foreground/30 hover:text-foreground"

  if (disabled) {
    return (
      <span
        className={`${base} border-border text-muted-foreground/50`}
        aria-disabled="true"
      >
        <span className={mono ? "font-mono" : undefined}>{children}</span>
        {count !== undefined ? <span className="font-mono">0</span> : null}
      </span>
    )
  }

  return (
    /**
     * `aria-current`, not `aria-pressed`. These look like toggles but they are
     * links that rewrite the URL, and `aria-pressed` is only allowed on
     * something with a button role — axe failed every chip in the bar for it.
     * `aria-current` is the attribute for "this is the active one in a set".
     */
    <Link
      href={href}
      className={`${base} ${state}`}
      aria-current={active ? "true" : undefined}
    >
      <span className={mono ? "font-mono" : undefined}>{children}</span>
      {count !== undefined ? (
        <span className={active ? "font-mono" : "font-mono text-muted-foreground"}>
          {count}
        </span>
      ) : null}
    </Link>
  )
}

export function ActiveFilterSummary({ filters }: { filters: Filters }) {
  const active: string[] = []
  if (filters.language) active.push(filters.language)
  if (filters.license) active.push(filters.license)
  if (filters.selfHosted) active.push("self-hosted")
  if (filters.beginner) active.push("beginner-friendly")
  if (filters.reviewed) active.push("reviewed")
  if (filters.gemsOnly) active.push("hidden gems")

  if (active.length === 0) return null

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {active.map((label) => (
        <Badge key={label} variant="secondary">
          {label}
        </Badge>
      ))}
    </div>
  )
}
