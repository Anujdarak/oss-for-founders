import type { Repo } from "./schema"
import type { SearchDoc } from "./search"

/**
 * The canonical detail URL. Owner/name rather than our internal id, so the URL
 * says what the repo is and matches how people refer to it on GitHub.
 *
 * `/r/[id]` still resolves and redirects here, so older links keep working.
 */
export function repoHref(repo: Pick<Repo, "owner" | "name">): string {
  return `/r/${encodeURIComponent(repo.owner)}/${encodeURIComponent(repo.name)}`
}

export function docHref(doc: Pick<SearchDoc, "owner" | "name">): string {
  return repoHref(doc)
}

export function categoryHref(slug: string): string {
  return `/c/${slug}`
}
