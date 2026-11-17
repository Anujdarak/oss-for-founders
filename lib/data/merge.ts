import type { Repo } from "@/lib/schema"

/** A repo's identity is its GitHub path, not its id — the id is ours, the path is the repo's. */
export function repoKey(repo: Pick<Repo, "owner" | "name">): string {
  return `${repo.owner}/${repo.name}`.toLowerCase()
}

/**
 * Newest-first by `addedAt`, then by stars, then by path. Entries with no stats
 * sort after ones that have them rather than being treated as zero-star.
 */
export function compareByStars(a: Repo, b: Repo): number {
  if (a.stats && b.stats) {
    const byStars = b.stats.stars - a.stats.stars
    if (byStars !== 0) return byStars
  } else if (a.stats !== undefined || b.stats !== undefined) {
    return a.stats ? -1 : 1
  }
  return repoKey(a).localeCompare(repoKey(b))
}

export function compareByAddedAt(a: Repo, b: Repo): number {
  const byDate = Date.parse(b.addedAt) - Date.parse(a.addedAt)
  if (byDate !== 0) return byDate
  return compareByStars(a, b)
}

/**
 * Merges the curated file over the auto-imported one. Curated wins on conflict,
 * matched on the GitHub path so a re-import cannot duplicate a hand-written
 * entry under a different id. A duplicate id is dropped too, since ids address
 * detail pages and two entries cannot share one.
 */
export function mergeRepos(curated: Repo[], discovered: Repo[]): Repo[] {
  const byKey = new Map<string, Repo>()
  const seenIds = new Set<string>()

  for (const repo of [...curated, ...discovered]) {
    const key = repoKey(repo)
    if (byKey.has(key) || seenIds.has(repo.id)) continue
    byKey.set(key, repo)
    seenIds.add(repo.id)
  }

  return [...byKey.values()].sort(compareByStars)
}
