import { CATEGORIES, type Category } from "@/lib/categories"
import type { Repo } from "@/lib/schema"

import { compareByAddedAt, mergeRepos } from "./merge"
import { curatedRepos, discoveredRepos } from "./sources"

export const PER_PAGE = 24

/** Merged once at module load; the data is static JSON, so there is nothing to invalidate. */
const allRepos = mergeRepos(curatedRepos, discoveredRepos)

const byId = new Map(allRepos.map((repo) => [repo.id, repo]))

const byCategory = new Map<Category, Repo[]>(
  CATEGORIES.map((category) => [
    category,
    allRepos.filter((repo) => repo.category === category),
  ])
)

export function getAllRepos(): Repo[] {
  return allRepos
}

export function getRepoById(id: string): Repo | undefined {
  return byId.get(id)
}

export function getAllRepoIds(): string[] {
  return allRepos.map((repo) => repo.id)
}

const byOwnerName = new Map(
  allRepos.map((repo) => [`${repo.owner}/${repo.name}`.toLowerCase(), repo])
)

/** Case-insensitive, because GitHub treats owner/name that way and people type it either way. */
export function getRepoByOwnerName(owner: string, name: string): Repo | undefined {
  return byOwnerName.get(`${owner}/${name}`.toLowerCase())
}

/**
 * Other repos worth looking at next to this one: same category first, then
 * overlapping topics, ranked by how many topics they share. Never includes the
 * repo itself.
 */
export function getSimilarRepos(repo: Repo, limit = 4): Repo[] {
  const topics = new Set(repo.tags)

  const scored = allRepos
    .filter((other) => other.id !== repo.id)
    .map((other) => {
      const shared = other.tags.filter((tag) => topics.has(tag)).length
      const sameCategory =
        other.category === repo.category ||
        other.secondaryCategory === repo.category ||
        other.category === repo.secondaryCategory
      if (!sameCategory && shared === 0) return undefined
      return {
        repo: other,
        // Category match is the stronger signal; shared topics refine within it.
        rank: (sameCategory ? 100 : 0) + shared * 10 + (other.reviewed ? 1 : 0),
      }
    })
    .filter((entry): entry is { repo: Repo; rank: number } => entry !== undefined)

  return scored
    .sort(
      (a, b) =>
        b.rank - a.rank || (b.repo.stats?.stars ?? 0) - (a.repo.stats?.stars ?? 0)
    )
    .slice(0, limit)
    .map((entry) => entry.repo)
}

export function getCategoryCount(category: Category): number {
  return byCategory.get(category)?.length ?? 0
}

export function getCategoryCounts(): Record<Category, number> {
  return Object.fromEntries(
    CATEGORIES.map((category) => [category, getCategoryCount(category)])
  ) as Record<Category, number>
}

export type Page<T> = {
  items: T[]
  total: number
  page: number
  pageCount: number
  perPage: number
}

/**
 * Categories will hold hundreds of entries once the import runs, so the
 * category route pages rather than rendering everything. `page` is clamped so a
 * hand-typed `?page=99` shows the last page instead of an empty list.
 */
export function getReposByCategory(
  category: Category,
  { page = 1, perPage = PER_PAGE }: { page?: number; perPage?: number } = {}
): Page<Repo> {
  const items = byCategory.get(category) ?? []
  const total = items.length
  const pageCount = Math.max(1, Math.ceil(total / perPage))
  const current = Math.min(Math.max(1, Math.trunc(page) || 1), pageCount)
  const start = (current - 1) * perPage

  return {
    items: items.slice(start, start + perPage),
    total,
    page: current,
    pageCount,
    perPage,
  }
}

export function getRecentlyAdded(limit = 6): Repo[] {
  return [...allRepos].sort(compareByAddedAt).slice(0, limit)
}

export function getHiddenGems(): Repo[] {
  return allRepos.filter((repo) => repo.isHiddenGem)
}

/**
 * The newest `stats.fetchedAt` in the data, which is what the UI means by
 * "stats updated". Derived rather than stored so it cannot disagree with the
 * entries, and clock-free so it is safe in a prerendered path.
 */
export function getStatsUpdatedAt(): string | undefined {
  let newest: string | undefined
  for (const repo of allRepos) {
    const fetchedAt = repo.stats?.fetchedAt
    if (!fetchedAt) continue
    if (!newest || Date.parse(fetchedAt) > Date.parse(newest)) newest = fetchedAt
  }
  return newest
}

export { repoKey } from "./merge"
