import { Suspense } from "react"
import type { Metadata } from "next"
import { SearchXIcon } from "lucide-react"

import { EmptyState } from "@/components/empty-state"
import { FilterBar } from "@/components/filter-bar"
import { Pagination } from "@/components/pagination"
import { RepoCardGrid } from "@/components/repo-card"
import { SearchForm } from "@/components/search-form"
import { Skeleton } from "@/components/ui/skeleton"
import { CATEGORIES, CATEGORY_META } from "@/lib/categories"
import { getAllRepos, PER_PAGE } from "@/lib/data"
import {
  applyFilters,
  buildHref,
  parseFilters,
  sortRepos,
  type RawSearchParams,
} from "@/lib/filters"
import { getIndex, search, toSearchDoc } from "@/lib/search"

export const metadata: Metadata = {
  title: "Explore",
  description:
    "Every repo in the catalogue, filterable by category, language, licence, and review status.",
}

/**
 * Built once at module load and handed to `getIndex`, which caches the Fuse
 * index against this exact array. Rebuilding per request was the slowest thing
 * on the page once the catalogue grew past a few hundred entries.
 */
const searchDocs = getAllRepos().map(toSearchDoc)

export default function ExplorePage({
  searchParams,
}: {
  searchParams: Promise<RawSearchParams>
}) {
  return (
    <div className="mx-auto w-full max-w-5xl space-y-6 px-4 py-12">
      <div className="space-y-3">
        <h1 className="text-2xl font-semibold tracking-tight">Explore</h1>
        <p className="max-w-prose text-sm text-muted-foreground">
          Everything in the catalogue. Filters and sort live in the URL, so any
          view here can be linked or bookmarked.
        </p>
      </div>

      {/* Filters come from searchParams, which is request-time data, so the
          whole result area lives behind one boundary and the heading above it
          stays in the static shell. */}
      <Suspense fallback={<ExploreSkeleton />}>
        <ExploreResults searchParams={searchParams} />
      </Suspense>
    </div>
  )
}

async function ExploreResults({
  searchParams,
}: {
  searchParams: Promise<RawSearchParams>
}) {
  const params = await searchParams
  const filters = parseFilters(params)
  const all = getAllRepos()

  // Text search first, so the facet counts below describe the searched set.
  let matched = all
  if (filters.q.trim().length >= 2) {
    const index = getIndex(searchDocs)
    const ranked = search(index, filters.q, 500)
    const order = new Map(ranked.map((hit, position) => [hit.doc.id, position]))
    matched = all
      .filter((repo) => order.has(repo.id))
      .sort((a, b) => order.get(a.id)! - order.get(b.id)!)
  }

  const filtered = applyFilters(matched, filters)
  // A text query already ranks by relevance; re-sorting would throw that away
  // unless the reader explicitly asked for a different order.
  const ordered =
    filters.q.trim().length >= 2 && filters.sort === "popular"
      ? filtered
      : sortRepos(filtered, filters.sort)

  const pageCount = Math.max(1, Math.ceil(ordered.length / PER_PAGE))
  const page = Math.min(filters.page, pageCount)
  const items = ordered.slice((page - 1) * PER_PAGE, page * PER_PAGE)

  const basePath = "/explore"

  return (
    <div className="space-y-6">
      <SearchForm action={basePath} defaultValue={filters.q} filters={filters} />

      <FilterBar basePath={basePath} filters={filters} repos={matched} />

      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <p className="font-mono text-xs text-muted-foreground">
          {ordered.length} {ordered.length === 1 ? "repo" : "repos"}
          {filters.q ? ` matching "${filters.q}"` : ""}
        </p>
        <nav className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
          {CATEGORIES.map((category) => (
            <a
              key={category}
              href={buildHref(basePath, filters, {
                category: filters.category === category ? undefined : category,
              })}
              aria-current={filters.category === category ? "true" : undefined}
              /**
               * `min-h-6` is the WCAG 2.2 target-size minimum (24px). These
               * were 16px tall with 4px between wrapped rows, which axe failed
               * on both counts — the text size is unchanged, the hit area just
               * reaches the floor now.
               */
              className={
                "inline-flex min-h-6 items-center " +
                (filters.category === category
                  ? "text-primary"
                  : "text-muted-foreground transition-colors hover:text-foreground")
              }
            >
              {CATEGORY_META[category].label}
            </a>
          ))}
        </nav>
      </div>

      {items.length > 0 ? (
        <>
          <RepoCardGrid repos={items} />
          <Pagination
            hrefFor={(target) => buildHref(basePath, filters, { page: target })}
            page={page}
            pageCount={pageCount}
            total={ordered.length}
          />
        </>
      ) : (
        <EmptyState
          icon={SearchXIcon}
          title="Nothing matches those filters"
          description={
            filters.q
              ? `No repo matched "${filters.q}" with the current filters. Clearing a filter or searching a broader term is usually the fix.`
              : "No repo matched the current filters. Clear one to widen the results."
          }
        />
      )}
    </div>
  )
}

function ExploreSkeleton() {
  return (
    <div className="space-y-6">
      <Skeleton className="h-9 w-full max-w-md" />
      <div className="space-y-2 border-y border-border py-3">
        <Skeleton className="h-6 w-full max-w-lg" />
        <Skeleton className="h-6 w-full max-w-md" />
      </div>
      <div className="grid min-h-[70vh] auto-rows-min gap-3 lg:grid-cols-2">
        {Array.from({ length: 8 }).map((_, index) => (
          <div key={index} className="space-y-2 rounded-xl border border-border p-4">
            <Skeleton className="h-4 w-40" />
            <Skeleton className="h-3 w-full" />
            <Skeleton className="h-3 w-2/3" />
          </div>
        ))}
      </div>
    </div>
  )
}
