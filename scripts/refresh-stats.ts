/**
 * Stage 3 Part A: refresh the GitHub facts for every curated repo.
 *
 * Writes two things:
 *   data/github-cache.json  the raw API snapshot, keyed by owner/name
 *   data/repos.json         the `stats` block of each entry, updated in place
 *
 * The cache is the fallback: if the API is down, rate limited, or the token is
 * missing, the committed cache is reused and nothing is invented. A repo that
 * 404s or has been archived is reported rather than silently dropped, because
 * both are editorial decisions.
 *
 * Usage:  npm run refresh-stats [-- --force] [-- --dry-run]
 */
import { readFileSync, writeFileSync, existsSync } from "node:fs"
import path from "node:path"

import { loadEnv } from "../lib/env"
import {
  GitHubClient,
  GitHubError,
  MissingTokenError,
  requireToken,
  spdxId,
  type GitHubRepo,
} from "../lib/github"
import { reposSchema, type Repo } from "../lib/schema"

loadEnv()

const ROOT = process.cwd()
const REPOS_PATH = path.join(ROOT, "data", "repos.json")
const CACHE_PATH = path.join(ROOT, "data", "github-cache.json")
const REPORT_PATH = path.join(ROOT, "data", "stats-report.md")

const REVALIDATE_MS = 24 * 60 * 60 * 1000

const force = process.argv.includes("--force")
const dryRun = process.argv.includes("--dry-run")

type CacheEntry = {
  fetchedAt: string
  githubId: number
  fullName: string
  owner: string
  name: string
  url: string
  description: string | null
  homepage: string | null
  language: string | null
  license: string | null
  stars: number
  forks: number
  openIssues: number
  pushedAt: string
  createdAt: string
  archived: boolean
  avatarUrl: string
  topics: string[]
}

type Cache = {
  /** When the whole cache was last refreshed. Drives the 24h revalidation. */
  refreshedAt: string | null
  entries: Record<string, CacheEntry>
}

function readCache(): Cache {
  if (!existsSync(CACHE_PATH)) return { refreshedAt: null, entries: {} }
  try {
    const parsed = JSON.parse(readFileSync(CACHE_PATH, "utf8")) as Cache
    return { refreshedAt: parsed.refreshedAt ?? null, entries: parsed.entries ?? {} }
  } catch {
    console.warn("github-cache.json is unreadable; starting a fresh cache")
    return { refreshedAt: null, entries: {} }
  }
}

function cacheIsFresh(cache: Cache): boolean {
  if (!cache.refreshedAt) return false
  const age = Date.now() - Date.parse(cache.refreshedAt)
  return Number.isFinite(age) && age >= 0 && age < REVALIDATE_MS
}

function key(repo: { owner: string; name: string }): string {
  return `${repo.owner}/${repo.name}`.toLowerCase()
}

function toCacheEntry(payload: GitHubRepo, fetchedAt: string): CacheEntry {
  return {
    fetchedAt,
    githubId: payload.id,
    fullName: payload.full_name,
    owner: payload.owner.login,
    name: payload.name,
    url: payload.html_url,
    description: payload.description,
    homepage: payload.homepage?.trim() ? payload.homepage.trim() : null,
    language: payload.language,
    license: spdxId(payload) ?? null,
    stars: payload.stargazers_count,
    forks: payload.forks_count,
    openIssues: payload.open_issues_count,
    pushedAt: payload.pushed_at,
    createdAt: payload.created_at,
    archived: payload.archived,
    avatarUrl: payload.owner.avatar_url,
    topics: payload.topics ?? [],
  }
}

async function main() {
  const raw: unknown = JSON.parse(readFileSync(REPOS_PATH, "utf8"))
  const parsed = reposSchema.safeParse(raw)
  if (!parsed.success) {
    console.error("data/repos.json does not match repoSchema; fix it before refreshing.")
    console.error("Run `npm run validate` for the details.")
    process.exit(1)
  }

  const repos = parsed.data
  const cache = readCache()

  const problems: { repo: string; issue: string }[] = []
  const renames: { from: string; to: string }[] = []
  let fetched = 0
  let fromCache = 0

  if (!force && cacheIsFresh(cache)) {
    console.log(
      `Cache is less than 24h old (refreshed ${cache.refreshedAt}). ` +
        `Use --force to refetch anyway.`
    )
    return
  }

  let client: GitHubClient | null = null
  try {
    client = new GitHubClient(requireToken(), (message) => console.log(`  ${message}`))
  } catch (error) {
    if (!(error instanceof MissingTokenError)) throw error

    // The whole point of the cache: a missing token degrades to the committed
    // snapshot instead of failing the build or writing made-up numbers.
    if (Object.keys(cache.entries).length === 0) {
      console.error(error.message)
      console.error("\nThere is no cache to fall back on, so nothing can be refreshed.")
      process.exit(1)
    }
    console.warn(error.message)
    console.warn("\nFalling back to data/github-cache.json. Stats will not be updated.")
  }

  const nowIso = new Date().toISOString()
  const updated: Repo[] = []

  for (const repo of repos) {
    const cacheKey = key(repo)
    let entry = cache.entries[cacheKey]

    if (client) {
      try {
        const payload = await client.request<GitHubRepo>(
          `/repos/${repo.owner}/${repo.name}`
        )
        entry = toCacheEntry(payload, nowIso)
        cache.entries[cacheKey] = entry
        fetched += 1

        if (payload.full_name.toLowerCase() !== cacheKey) {
          renames.push({ from: `${repo.owner}/${repo.name}`, to: payload.full_name })
          problems.push({
            repo: `${repo.owner}/${repo.name}`,
            issue: `renamed to ${payload.full_name} -- update owner/name/url in repos.json`,
          })
        }
        if (payload.archived) {
          problems.push({ repo: payload.full_name, issue: "archived upstream" })
        }
        if (payload.disabled) {
          problems.push({ repo: payload.full_name, issue: "disabled upstream" })
        }
      } catch (error) {
        if (error instanceof GitHubError && (error.status === 404 || error.status === 451)) {
          problems.push({
            repo: `${repo.owner}/${repo.name}`,
            issue:
              error.status === 404
                ? "404 -- repo is gone, renamed, or private"
                : "451 -- unavailable for legal reasons",
          })
        } else {
          problems.push({
            repo: `${repo.owner}/${repo.name}`,
            issue: `fetch failed (${error instanceof Error ? error.message : String(error)}); kept cached stats`,
          })
        }
      }
    }

    if (!entry) {
      problems.push({
        repo: `${repo.owner}/${repo.name}`,
        issue: "no API data and no cache entry; stats left as they were",
      })
      updated.push(repo)
      continue
    }

    if (!client) fromCache += 1

    updated.push({
      ...repo,
      githubId: entry.githubId,
      avatarUrl: entry.avatarUrl,
      ...(entry.homepage && isHttpUrl(entry.homepage)
        ? { homepage: entry.homepage }
        : {}),
      stats: {
        stars: entry.stars,
        forks: entry.forks,
        ...(entry.language ? { language: entry.language } : {}),
        ...(entry.license ? { license: entry.license } : {}),
        openIssues: entry.openIssues,
        pushedAt: entry.pushedAt,
        createdAt: entry.createdAt,
        ...(entry.archived ? { archived: true } : {}),
        fetchedAt: entry.fetchedAt,
      },
    })
  }

  // Prove the result still matches the schema before touching the data file.
  const check = reposSchema.safeParse(updated)
  if (!check.success) {
    console.error("Refreshed data would not match repoSchema; nothing written.")
    console.error(JSON.stringify(check.error.issues.slice(0, 10), null, 2))
    process.exit(1)
  }

  if (dryRun) {
    console.log("--dry-run: nothing written")
  } else {
    if (client) {
      cache.refreshedAt = nowIso
      writeFileSync(CACHE_PATH, JSON.stringify(cache, null, 2) + "\n", "utf8")
    }
    writeFileSync(REPOS_PATH, JSON.stringify(updated, null, 2) + "\n", "utf8")
    writeReport({ repos: updated, problems, renames, fetched, fromCache, client })
  }

  console.log(
    `\n${updated.length} repos: ${fetched} refreshed from the API, ${fromCache} from cache.`
  )
  if (client) {
    console.log(
      `Rate limit: ${client.rate.remaining}/${client.rate.limit} remaining, ` +
        `${client.rate.used} requests used.`
    )
  }
  if (problems.length > 0) {
    console.log(`\n${problems.length} repo(s) need attention:`)
    for (const { repo, issue } of problems) console.log(`  - ${repo}: ${issue}`)
    console.log(`\nFull report: data/stats-report.md`)
  }
}

function isHttpUrl(value: string): boolean {
  try {
    const url = new URL(value)
    return url.protocol === "http:" || url.protocol === "https:"
  } catch {
    return false
  }
}

function writeReport({
  repos,
  problems,
  renames,
  fetched,
  fromCache,
  client,
}: {
  repos: Repo[]
  problems: { repo: string; issue: string }[]
  renames: { from: string; to: string }[]
  fetched: number
  fromCache: number
  client: GitHubClient | null
}) {
  const lines: string[] = [
    "# Stats refresh report",
    "",
    `Generated: ${new Date().toISOString()}`,
    "",
    "## Summary",
    "",
    `- Curated repos: ${repos.length}`,
    `- Refreshed from the GitHub API: ${fetched}`,
    `- Served from cache: ${fromCache}`,
    `- Archived upstream: ${repos.filter((r) => r.stats?.archived).length}`,
    `- Missing a recognised licence: ${repos.filter((r) => r.stats && !r.stats.license).length}`,
  ]

  if (client) {
    lines.push(
      `- Rate limit remaining: ${client.rate.remaining}/${client.rate.limit} (${client.rate.used} requests used)`
    )
  }

  lines.push("", "## Needs attention", "")
  if (problems.length === 0) {
    lines.push("Nothing. Every curated repo resolved cleanly.")
  } else {
    lines.push("| Repo | Issue |", "| --- | --- |")
    for (const { repo, issue } of problems) lines.push(`| \`${repo}\` | ${issue} |`)
  }

  if (renames.length > 0) {
    lines.push("", "## Renames detected", "")
    for (const { from, to } of renames) lines.push(`- \`${from}\` -> \`${to}\``)
  }

  lines.push(
    "",
    "## Note on the numbers",
    "",
    "Stars, forks, issue counts, and last-push dates are a snapshot, not a live",
    "read. Each entry records its own `stats.fetchedAt`, and the UI shows that",
    "date. The site makes no network calls at runtime.",
    ""
  )

  writeFileSync(REPORT_PATH, lines.join("\n"), "utf8")
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error)
  process.exit(1)
})
