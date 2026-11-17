import { isCategory, type Category } from "./categories"
import type { Repo } from "./schema"

/**
 * Filter and sort state, all of it held in the URL so a filtered view can be
 * linked, bookmarked, and prerendered.
 */
export const SORTS = ["popular", "updated", "gems", "name"] as const
export type Sort = (typeof SORTS)[number]

export const SORT_LABELS: Record<Sort, string> = {
  popular: "Most popular",
  updated: "Recently updated",
  gems: "Hidden gems first",
  name: "Name",
}

export type Filters = {
  q: string
  sort: Sort
  category?: Category
  language?: string
  license?: string
  selfHosted: boolean
  beginner: boolean
  reviewed: boolean
  gemsOnly: boolean
  page: number
}

export const DEFAULT_FILTERS: Filters = {
  q: "",
  sort: "popular",
  selfHosted: false,
  beginner: false,
  reviewed: false,
  gemsOnly: false,
  page: 1,
}

export type RawSearchParams = Record<string, string | string[] | undefined>

function one(value: string | string[] | undefined): string | undefined {
  const raw = Array.isArray(value) ? value[0] : value
  const trimmed = raw?.trim()
  return trimmed ? trimmed : undefined
}

function flag(value: string | string[] | undefined): boolean {
  const raw = one(value)
  return raw === "1" || raw === "true"
}

export function parseFilters(params: RawSearchParams): Filters {
  const sort = one(params.sort)
  const category = one(params.category)
  const page = Number.parseInt(one(params.page) ?? "1", 10)

  return {
    q: one(params.q) ?? "",
    sort: (SORTS as readonly string[]).includes(sort ?? "")
      ? (sort as Sort)
      : "popular",
    ...(category && isCategory(category) ? { category } : {}),
    ...(one(params.lang) ? { language: one(params.lang) } : {}),
    ...(one(params.license) ? { license: one(params.license) } : {}),
    selfHosted: flag(params.selfhost),
    beginner: flag(params.beginner),
    reviewed: flag(params.reviewed),
    gemsOnly: flag(params.gems),
    page: Number.isFinite(page) && page > 0 ? page : 1,
  }
}

/** Serialises back to a query string, omitting anything at its default. */
export function filtersToQuery(filters: Partial<Filters>): string {
  const params = new URLSearchParams()
  if (filters.q) params.set("q", filters.q)
  if (filters.sort && filters.sort !== "popular") params.set("sort", filters.sort)
  if (filters.category) params.set("category", filters.category)
  if (filters.language) params.set("lang", filters.language)
  if (filters.license) params.set("license", filters.license)
  if (filters.selfHosted) params.set("selfhost", "1")
  if (filters.beginner) params.set("beginner", "1")
  if (filters.reviewed) params.set("reviewed", "1")
  if (filters.gemsOnly) params.set("gems", "1")
  if (filters.page && filters.page > 1) params.set("page", String(filters.page))

  const query = params.toString()
  return query ? `?${query}` : ""
}

export function buildHref(
  basePath: string,
  filters: Filters,
  overrides: Partial<Filters>
): string {
  // Any change to the filter set returns to page 1; staying on page 7 of a
  // narrower result set is never what someone means.
  const next = { ...filters, ...overrides }
  if (!("page" in overrides)) next.page = 1
  return `${basePath}${filtersToQuery(next)}`
}

export function hasActiveFilters(filters: Filters): boolean {
  return Boolean(
    filters.q ||
      filters.language ||
      filters.license ||
      filters.selfHosted ||
      filters.beginner ||
      filters.reviewed ||
      filters.gemsOnly ||
      filters.sort !== "popular"
  )
}

export function applyFilters(repos: Repo[], filters: Filters): Repo[] {
  return repos.filter((repo) => {
    if (filters.category && repo.category !== filters.category) {
      // Secondary category still counts as being in the category.
      if (repo.secondaryCategory !== filters.category) return false
    }
    if (filters.language && repo.stats?.language !== filters.language) return false
    if (filters.license && repo.stats?.license !== filters.license) return false
    if (filters.selfHosted && repo.selfHostable !== true) return false
    if (filters.beginner && repo.difficulty !== "beginner") return false
    if (filters.reviewed && !repo.reviewed) return false
    if (filters.gemsOnly && !repo.isHiddenGem) return false
    return true
  })
}

export function sortRepos(repos: Repo[], sort: Sort): Repo[] {
  const copy = [...repos]

  switch (sort) {
    case "popular":
      return copy.sort(
        (a, b) => (b.stats?.stars ?? -1) - (a.stats?.stars ?? -1) || byName(a, b)
      )
    case "updated":
      return copy.sort(
        (a, b) =>
          Date.parse(b.stats?.pushedAt ?? "1970-01-01") -
            Date.parse(a.stats?.pushedAt ?? "1970-01-01") || byName(a, b)
      )
    case "gems":
      return copy.sort(
        (a, b) =>
          Number(b.isHiddenGem) - Number(a.isHiddenGem) ||
          (b.score?.total ?? 0) - (a.score?.total ?? 0) ||
          (b.stats?.stars ?? -1) - (a.stats?.stars ?? -1) ||
          byName(a, b)
      )
    case "name":
      return copy.sort(byName)
  }
}

function byName(a: Repo, b: Repo): number {
  return `${a.owner}/${a.name}`.localeCompare(`${b.owner}/${b.name}`)
}

export type Facet = { value: string; count: number }

/**
 * Facet counts are computed against the other active filters, so a count is
 * what you would actually get by clicking it -- never a zero-result option
 * presented as if it had results.
 */
export function facetsFor(
  repos: Repo[],
  filters: Filters,
  field: "language" | "license"
): Facet[] {
  const base = applyFilters(repos, { ...filters, [field]: undefined })
  const counts = new Map<string, number>()

  for (const repo of base) {
    const value = repo.stats?.[field]
    if (!value) continue
    counts.set(value, (counts.get(value) ?? 0) + 1)
  }

  return [...counts.entries()]
    .map(([value, count]) => ({ value, count }))
    .sort((a, b) => b.count - a.count || a.value.localeCompare(b.value))
}

export function toggleCounts(repos: Repo[], filters: Filters) {
  const count = (override: Partial<Filters>) =>
    applyFilters(repos, { ...filters, ...override }).length

  return {
    selfHosted: count({ selfHosted: true }),
    beginner: count({ beginner: true }),
    reviewed: count({ reviewed: true }),
    gemsOnly: count({ gemsOnly: true }),
  }
}
