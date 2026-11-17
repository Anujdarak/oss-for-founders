import { Suspense } from "react"
import type { Metadata } from "next"
import { notFound } from "next/navigation"
import { SearchXIcon } from "lucide-react"

import { CategoryIcon } from "@/components/category-icon"
import { EmptyState } from "@/components/empty-state"
import { FilterBar } from "@/components/filter-bar"
import { Pagination } from "@/components/pagination"
import { RepoCardGrid } from "@/components/repo-card"
import { Skeleton } from "@/components/ui/skeleton"
import {
  CATEGORIES,
  CATEGORY_META,
  isCategory,
  type Category,
} from "@/lib/categories"
import { getCategoryCount, getReposByCategory, PER_PAGE } from "@/lib/data"
import {
  applyFilters,
  buildHref,
  parseFilters,
  sortRepos,
  type RawSearchParams,
} from "@/lib/filters"

/**
 * This route awaits `params` at the top level rather than inside a
 * `<Suspense>` boundary, so `notFound()` can set a real 404 status before the
 * response starts streaming. Next's instant-navigation check flags that as a
 * blocking read, so the check is switched off here deliberately rather than
 * left as permanent dev-overlay noise that teaches everyone to ignore it.
 *
 * It costs nothing in practice: every valid param is enumerated in
 * `generateStaticParams`, so real navigations are served from a prerendered
 * page. The only params that take the blocking path are the ones that 404.
 */
export const instant = false

type CategoryParams = { slug: string }
type CategorySearchParams = RawSearchParams

/**
 * All 13 slugs are enumerated, so every category page prerenders at build time.
 * Cache Components requires at least one param here -- an empty array is a
 * build error -- and `dynamicParams` cannot be exported alongside it, so an
 * unknown slug is rejected with `notFound()` instead.
 */
export function generateStaticParams(): CategoryParams[] {
  return CATEGORIES.map((slug) => ({ slug }))
}

export async function generateMetadata({
  params,
}: {
  params: Promise<CategoryParams>
}): Promise<Metadata> {
  "use cache"
  const { slug } = await params
  if (!isCategory(slug)) return {}

  const meta = CATEGORY_META[slug]
  return { title: meta.label, description: meta.description }
}

/**
 * `params` is awaited here rather than inside the `<Suspense>` boundary, which
 * is the documented trade-off for a closed param space: every valid slug is
 * listed in `generateStaticParams`, so nothing real loses its prerender, and
 * `notFound()` runs before the response starts streaming. Awaiting it inside
 * the boundary instead returns HTTP 200 with not-found markup, because the
 * shell has already been flushed by the time the slug is known.
 *
 * `?page` cannot be known at build time, so that read stays in the boundary and
 * only the list streams.
 */
export default async function CategoryPage({
  params,
  searchParams,
}: {
  params: Promise<CategoryParams>
  searchParams: Promise<CategorySearchParams>
}) {
  const { slug } = await params
  if (!isCategory(slug)) notFound()

  const meta = CATEGORY_META[slug]
  const total = getCategoryCount(slug)

  return (
    <div className="mx-auto w-full max-w-5xl space-y-6 px-4 py-12">
      <div className="space-y-3">
        <div className="flex items-center gap-2 text-muted-foreground">
          <CategoryIcon category={slug} className="size-4" />
          <span className="text-xs font-medium tracking-wide uppercase">
            Category
          </span>
        </div>
        <h1 className="text-2xl font-semibold tracking-tight">{meta.label}</h1>
        <p className="max-w-prose text-sm text-muted-foreground">
          {meta.description}
        </p>
        <p className="font-mono text-xs text-muted-foreground">
          {total} {total === 1 ? "repo" : "repos"}
        </p>
      </div>

      {total > 0 ? (
        <Suspense fallback={<RepoListSkeleton />}>
          <CategoryRepos slug={slug} searchParams={searchParams} />
        </Suspense>
      ) : (
        <EmptyState
          icon={SearchXIcon}
          title="Nothing in this category yet"
          description="No repositories have been added here. Try another category from the home page."
        />
      )}
    </div>
  )
}

async function CategoryRepos({
  slug,
  searchParams,
}: {
  slug: Category
  searchParams: Promise<CategorySearchParams>
}) {
  const params = await searchParams
  // The category is fixed by the route, so it is forced here rather than read
  // from the query -- otherwise ?category= could contradict the page you are on.
  const filters = { ...parseFilters(params), category: undefined }
  const inCategory = getReposByCategory(slug).items
  const basePath = `/c/${slug}`

  const filtered = applyFilters(inCategory, filters)
  const ordered = sortRepos(filtered, filters.sort)

  const pageCount = Math.max(1, Math.ceil(ordered.length / PER_PAGE))
  const page = Math.min(filters.page, pageCount)
  const items = ordered.slice((page - 1) * PER_PAGE, page * PER_PAGE)

  return (
    <div className="space-y-6">
      <FilterBar basePath={basePath} filters={filters} repos={inCategory} />

      {ordered.length !== inCategory.length ? (
        <p className="font-mono text-xs text-muted-foreground">
          {ordered.length} of {inCategory.length} shown
        </p>
      ) : null}

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
          description="Clear a filter to widen the results."
        />
      )}
    </div>
  )
}

function RepoListSkeleton() {
  return (
    // Reserves roughly the height the real results will occupy. With a short
    // fallback the footer paints high, then jumps when the stream resolves --
    // measured at CLS 0.14, all of it from that one jump.
    <div className="grid min-h-[70vh] auto-rows-min gap-3 lg:grid-cols-2">
      {Array.from({ length: 8 }).map((_, index) => (
        <div key={index} className="space-y-2 rounded-xl border border-border p-4">
          <Skeleton className="h-4 w-40" />
          <Skeleton className="h-3 w-full" />
          <Skeleton className="h-3 w-2/3" />
          <div className="flex gap-1.5 pt-1">
            <Skeleton className="h-4 w-14" />
            <Skeleton className="h-4 w-14" />
            <Skeleton className="h-4 w-14" />
          </div>
        </div>
      ))}
    </div>
  )
}
