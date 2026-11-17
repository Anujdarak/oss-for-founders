/**
 * Discovery import: finds candidate repos through the official GitHub API.
 *
 * GraphQL first, REST search as a fallback. GraphQL returns 100 repos per
 * request with every field this project stores, including whether a README
 * exists -- over several thousand candidates that saves the same number of
 * extra REST calls, which is most of the runtime.
 *
 * Only real API data is stored. Descriptions are copied verbatim and never
 * rewritten or generated. Everything written is `source: "auto-discovered"`,
 * `reviewed: false`.
 *
 * Usage:
 *   npm run discover                  full run
 *   npm run discover -- --test        a few terms per category, then stop
 *   npm run discover -- --resume      continue from data/.discover-state.json
 *   npm run discover -- --rest        skip GraphQL, use REST search
 *   npm run discover -- --max 5000    override the cap
 */
import { existsSync, readFileSync, writeFileSync, rmSync } from "node:fs"
import path from "node:path"

import { CATEGORIES, CATEGORY_META, type Category } from "../lib/categories"
import { loadEnv } from "../lib/env"
import {
  BadTokenError,
  GitHubClient,
  MissingTokenError,
  requireToken,
  searchPath,
  spdxId,
  verifyToken,
  type GitHubRepo,
  type SearchResult,
} from "../lib/github"
import {
  GraphQLClient,
  GraphQLUnavailable,
  gqlHasReadme,
  gqlSpdx,
  gqlTopics,
  type GqlRepo,
} from "../lib/github-graphql"
import {
  isDisqualified,
  MIN_RELEVANCE,
  scoreRelevance,
  type Relevance,
} from "../lib/founder-relevance"
import {
  HIDDEN_GEM_MIN_SCORE,
  HIDDEN_GEM_STARS,
  MIN_SCORE,
  scoreRepo,
} from "../lib/scoring"
import { reposSchema, type Repo, type RepoScore } from "../lib/schema"
import { cleanDescription } from "../lib/text"

loadEnv()

const ROOT = process.cwd()
const MAP_PATH = path.join(ROOT, "data", "category-map.json")
const OUT_PATH = path.join(ROOT, "data", "discovered.json")
const CURATED_PATH = path.join(ROOT, "data", "repos.json")
const STATE_PATH = path.join(ROOT, "data", ".discover-state.json")
const REPORT_PATH = path.join(ROOT, "data", "discover-report.md")

const argv = process.argv.slice(2)
const flag = (name: string) => argv.includes(`--${name}`)
const option = (name: string) => {
  const index = argv.indexOf(`--${name}`)
  return index >= 0 ? argv[index + 1] : undefined
}

const testMode = flag("test")
const resume = flag("resume")
const forceRest = flag("rest")
const MAX_REPOS = Number(option("max") ?? 6_000)
/**
 * Wall-clock budget for the collection phase. GitHub's search is slow enough
 * that the full term list would take many hours; with categories interleaved,
 * stopping on a timer leaves balanced coverage rather than a partial alphabet.
 */
const TIME_BUDGET_MS = Number(option("minutes") ?? 45) * 60_000

/**
 * How many queries run at once.
 *
 * The limiting factor is latency, not quota. A measured sequential run managed
 * 1.3 queries a minute while using 80 of 5,000 GraphQL points an hour: almost
 * all of that time was spent waiting on GitHub, which takes 5-10 seconds to
 * answer a search page. The requests are independent, so running a handful
 * concurrently converts dead waiting into throughput.
 *
 * Six is deliberately modest. GitHub's secondary limits punish aggressive
 * concurrency, and the point is to stop idling, not to hammer the API.
 */
const CONCURRENCY = Number(option("concurrency") ?? 6)

/** The general floor. Below this a project rarely has enough users to be a safe bet. */
const MIN_STARS = 500
/** Hidden gems are the one exception: small is the point, if quality is high. */
const GEM_MIN_STARS = HIDDEN_GEM_STARS.min
const MAX_PUSHED_AGE_DAYS = 365
const MIN_AGE_DAYS = 180
const MIN_LATIN_RATIO = 0.7
const TEST_TOPICS_PER_CATEGORY = 3
/**
 * Pages per slice. Deliberately shallow.
 *
 * Breadth beats depth here, and that is a measured conclusion rather than a
 * preference: at 45 pages a single broad term like `topic:llm` spent nine
 * minutes paging through twelve date windows, which would have put the full
 * 1,510-query run into the many-hours range. GitHub returns search results
 * best-match first, so the early pages of 300 different queries are worth far
 * more than the tail of one -- and with heavy overlap between terms, the deep
 * pages were mostly repeats anyway.
 *
 * Tightened again after timing the real thing: GitHub's GraphQL search takes
 * 5-10 seconds per page on a large result set, so a capped query at 6 pages x
 * 4 windows cost three to four minutes on its own.
 */
const MAX_PAGES = 3
/** Date windows a capped query is split into. */
const DATE_WINDOWS = 2

/**
 * Star ranges keep each query under the search index's 1,000-result ceiling.
 * The lowest band is gem territory and is only kept when quality and relevance
 * are both high; everything else needs MIN_STARS.
 */
const STAR_RANGES = [
  { range: `${GEM_MIN_STARS}..499`, gemBand: true },
  { range: "500..1000", gemBand: false },
  { range: "1001..3000", gemBand: false },
  { range: "3001..10000", gemBand: false },
  { range: ">10000", gemBand: false },
] as const

type CategoryMap = {
  categories: Record<string, { topics: string[]; keywords: string[] }>
  exclude: {
    nameFragments: string[]
    descriptionFragments: string[]
    topics: string[]
  }
}

/** The normalised shape both GraphQL and REST results are mapped into. */
type Found = {
  githubId: number
  owner: string
  name: string
  fullName: string
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
  disabled: boolean
  fork: boolean
  avatarUrl: string
  topics: string[]
  hasReadme: boolean | null
}

type Candidate = { repo: Found; votes: Record<string, number> }

type State = {
  startedAt: string
  completedQueries: string[]
  candidates: Candidate[]
}

type DropReason =
  | "fork" | "archived" | "disabled" | "no-license" | "no-description"
  | "stale" | "too-new" | "non-latin-description" | "too-few-stars"
  | "excluded-name" | "excluded-description" | "excluded-topic"
  | "not-a-founder-tool" | "low-relevance" | "low-score"
  | "already-curated" | "cap-reached"

const DROP_LABELS: Record<DropReason, string> = {
  fork: "is a fork",
  archived: "archived upstream",
  disabled: "disabled upstream",
  "no-license": "no licence GitHub can resolve",
  "no-description": "no description",
  stale: `no push in ${MAX_PUSHED_AGE_DAYS} days`,
  "too-new": `created less than ${MIN_AGE_DAYS} days ago`,
  "non-latin-description": "description is not mostly Latin script",
  "too-few-stars": `under ${MIN_STARS} stars, and not a gem candidate`,
  "excluded-name": "name looks like a list, course, template, or SDK",
  "excluded-description": "description looks like a list, course, template, or SDK",
  "excluded-topic": "carries an excluded topic",
  "not-a-founder-tool": "reads as something you study, not something you run",
  "low-relevance": `founder relevance below ${MIN_RELEVANCE}`,
  "low-score": `quality score below ${MIN_SCORE}`,
  "already-curated": "already in repos.json",
  "cap-reached": `beyond the ${MAX_REPOS} cap`,
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

function loadMap(): CategoryMap {
  const map = JSON.parse(readFileSync(MAP_PATH, "utf8")) as CategoryMap
  for (const category of Object.keys(map.categories)) {
    if (!(CATEGORIES as readonly string[]).includes(category)) {
      throw new Error(`category-map.json has unknown category "${category}"`)
    }
  }
  return map
}

function loadState(): State {
  if (resume && existsSync(STATE_PATH)) {
    try {
      const state = JSON.parse(readFileSync(STATE_PATH, "utf8")) as State
      console.log(
        `Resuming: ${state.completedQueries.length} queries done, ` +
          `${state.candidates.length} candidates collected.`
      )
      return state
    } catch {
      console.warn("state file unreadable; starting fresh")
    }
  }
  return { startedAt: new Date().toISOString(), completedQueries: [], candidates: [] }
}

function saveState(state: State): void {
  writeFileSync(STATE_PATH, JSON.stringify(state, null, 2) + "\n", "utf8")
}

/**
 * Query order, round-robin across categories.
 *
 * This matters more than it looks. Grouped by category, the run does every
 * ai-ml term before touching saas-development -- so any early stop, rate-limit
 * pause, or Ctrl-C leaves a catalogue that is entirely AI tools. Interleaving
 * means the first pass covers all thirteen categories, the second pass deepens
 * each, and stopping at any point still leaves something balanced.
 */
function buildTerms(map: CategoryMap): { category: Category; term: string }[] {
  const perCategory = CATEGORIES.map((category) => {
    const entry = map.categories[category]
    if (!entry) return []

    const topics = testMode
      ? entry.topics.slice(0, TEST_TOPICS_PER_CATEGORY)
      : entry.topics
    const keywords = testMode ? entry.keywords.slice(0, 1) : entry.keywords

    return [
      ...topics.map((topic) => ({ category, term: `topic:${topic}` })),
      ...keywords.map((keyword) => ({ category, term: `"${keyword}"` })),
    ]
  })

  const terms: { category: Category; term: string }[] = []
  const longest = Math.max(0, ...perCategory.map((list) => list.length))
  for (let round = 0; round < longest; round++) {
    for (const list of perCategory) {
      if (list[round]) terms.push(list[round])
    }
  }

  return terms
}

const isoDay = (date: Date) => date.toISOString().slice(0, 10)
const daysAgo = (days: number) => new Date(Date.now() - days * 86_400_000)

/** Pushed-date windows a query is split into when it exceeds the result cap. */
function pushedWindows(count: number): string[] {
  const windows: string[] = []
  const span = MAX_PUSHED_AGE_DAYS / count

  for (let i = 0; i < count; i++) {
    const from = isoDay(daysAgo(MAX_PUSHED_AGE_DAYS - i * span))
    const to = isoDay(daysAgo(Math.max(0, MAX_PUSHED_AGE_DAYS - (i + 1) * span)))
    windows.push(`${from}..${to}`)
  }

  return windows
}

function fromGql(node: GqlRepo): Found | undefined {
  if (!node.databaseId || !node.pushedAt) return undefined
  return {
    githubId: node.databaseId,
    owner: node.owner.login,
    name: node.name,
    fullName: node.nameWithOwner,
    url: node.url,
    description: node.description,
    homepage: node.homepageUrl?.trim() || null,
    language: node.primaryLanguage?.name ?? null,
    license: gqlSpdx(node) ?? null,
    stars: node.stargazerCount,
    forks: node.forkCount,
    openIssues: node.issues.totalCount,
    pushedAt: node.pushedAt,
    createdAt: node.createdAt,
    archived: node.isArchived,
    disabled: node.isDisabled,
    fork: node.isFork || node.isMirror,
    avatarUrl: node.owner.avatarUrl,
    topics: gqlTopics(node),
    hasReadme: gqlHasReadme(node),
  }
}

function fromRest(repo: GitHubRepo): Found {
  return {
    githubId: repo.id,
    owner: repo.owner.login,
    name: repo.name,
    fullName: repo.full_name,
    url: repo.html_url,
    description: repo.description,
    homepage: repo.homepage?.trim() || null,
    language: repo.language,
    license: spdxId(repo) ?? null,
    stars: repo.stargazers_count,
    forks: repo.forks_count,
    openIssues: repo.open_issues_count,
    pushedAt: repo.pushed_at,
    createdAt: repo.created_at,
    archived: repo.archived,
    disabled: Boolean(repo.disabled),
    fork: repo.fork,
    avatarUrl: repo.owner.avatar_url,
    topics: repo.topics ?? [],
    // REST search does not report README presence; scored as unverified.
    hasReadme: null,
  }
}

async function main() {
  let token: string
  try {
    token = requireToken()
  } catch (error) {
    if (error instanceof MissingTokenError) {
      console.error(error.message)
      process.exit(1)
    }
    throw error
  }

  // Step one, always: prove the token works and show the budget.
  console.log("Checking the token against /rate_limit ...")
  let limits
  try {
    limits = await verifyToken(token)
  } catch (error) {
    if (error instanceof BadTokenError) {
      console.error(error.message)
      process.exit(1)
    }
    throw error
  }

  console.log(
    `  authenticated OK\n` +
      `  core    ${limits.core.remaining}/${limits.core.limit}\n` +
      `  search  ${limits.search.remaining}/${limits.search.limit} per minute\n` +
      `  graphql ${limits.graphql.remaining}/${limits.graphql.limit} points per hour\n`
  )

  const map = loadMap()
  const state = loadState()
  const rest = new GitHubClient(token, (m) => console.log(`  ${m}`))
  const gql = new GraphQLClient(token, (m) => console.log(`  ${m}`))
  let useGraphQL = !forceRest

  const curated: Repo[] = reposSchema.parse(
    JSON.parse(readFileSync(CURATED_PATH, "utf8"))
  )
  const curatedKeys = new Set(curated.map((r) => `${r.owner}/${r.name}`.toLowerCase()))

  const byId = new Map<number, Candidate>()
  for (const candidate of state.candidates) byId.set(candidate.repo.githubId, candidate)
  const done = new Set(state.completedQueries)

  const terms = buildTerms(map)
  const since = isoDay(daysAgo(MAX_PUSHED_AGE_DAYS))
  const totalQueries = terms.length * STAR_RANGES.length

  console.log(
    `${terms.length} terms x ${STAR_RANGES.length} star ranges = ${totalQueries} base queries` +
      (testMode ? " (test mode)" : "") +
      `\nengine: ${useGraphQL ? "GraphQL (REST fallback)" : "REST search"}\n`
  )

  async function collect(
    base: string,
    dateQualifier: string,
    maxPages: number
  ): Promise<{ repos: Found[]; total: number }> {
    const q = `${base} ${dateQualifier}`
    const repos: Found[] = []
    let total = 0

    if (useGraphQL) {
      let cursor: string | null = null
      for (let page = 0; page < maxPages; page++) {
        const result = await gql.search(q, cursor)
        total = result.repositoryCount
        for (const node of result.nodes) {
          const found = fromGql(node)
          if (found) repos.push(found)
        }
        cursor = result.endCursor
        if (!result.hasNextPage) break
        await sleep(90)
      }
      return { repos, total }
    }

    for (let page = 1; page <= maxPages; page++) {
      const result = await rest.request<SearchResult>(searchPath(q, { page }))
      total = result.total_count
      repos.push(...result.items.map(fromRest))
      if (result.items.length < 100) break
      // REST search allows only 30 requests a minute.
      await sleep(2_100)
    }
    return { repos, total }
  }

  function absorb(repos: Found[], category: Category): number {
    let added = 0
    for (const repo of repos) {
      const existing = byId.get(repo.githubId)
      if (existing) {
        existing.votes[category] = (existing.votes[category] ?? 0) + 1
      } else {
        byId.set(repo.githubId, { repo, votes: { [category]: 1 } })
        added += 1
      }
    }
    return added
  }

  const startedAt = Date.now()

  // Flattened so a pool of workers can pull from one list. Order comes from
  // buildTerms(), which interleaves categories, so whatever the workers get
  // through stays balanced across the catalogue.
  const jobs: { category: Category; term: string; range: string; key: string }[] = []
  for (const { category, term } of terms) {
    for (const { range } of STAR_RANGES) {
      const key = `${category}|${term}|${range}`
      if (!done.has(key)) jobs.push({ category, term, range, key })
    }
  }

  console.log(`${jobs.length} queries to run, ${CONCURRENCY} at a time\n`)

  let cursor = 0
  let completed = 0
  let stop = false

  async function runJob(job: (typeof jobs)[number]): Promise<void> {
    const base = [
      job.term,
      `stars:${job.range}`,
      "is:public",
      "archived:false",
      "fork:false",
    ].join(" ")
    let added = 0

    try {
      // One probe decides whether this query needs splitting by date.
      const probe = await collect(base, `pushed:>=${since}`, 1)
      added += absorb(probe.repos, job.category)

      if (probe.total > 1_000) {
        for (const window of pushedWindows(DATE_WINDOWS)) {
          const slice = await collect(base, `pushed:${window}`, MAX_PAGES)
          added += absorb(slice.repos, job.category)
        }
      } else if (probe.total > 50) {
        const more = await collect(base, `pushed:>=${since}`, MAX_PAGES)
        added += absorb(more.repos, job.category)
      }
    } catch (error) {
      if (error instanceof GraphQLUnavailable && useGraphQL) {
        console.warn(`  graphql unavailable (${error.message}); falling back to REST`)
        useGraphQL = false
      } else {
        console.warn(
          `  ! ${base}: ${error instanceof Error ? error.message : String(error)}`
        )
      }
    }

    done.add(job.key)
    completed += 1

    if (added > 0 || completed % 25 === 0) {
      console.log(
        `  [${String(completed).padStart(4)}/${jobs.length}] ${job.category.padEnd(24)}` +
          `${job.term.slice(0, 30).padEnd(32)} ${job.range.padEnd(11)} ` +
          `+${String(added).padStart(4)}  total ${byId.size}`
      )
    }

    if (completed % 10 === 0) {
      state.completedQueries = [...done]
      state.candidates = [...byId.values()]
      saveState(state)
    }

    if (byId.size >= MAX_REPOS * 2) {
      if (!stop) console.log("\nCollected enough candidates; moving on to filtering.")
      stop = true
    }
    if (Date.now() - startedAt > TIME_BUDGET_MS) {
      if (!stop) {
        console.log(
          `\nTime budget reached after ${completed} queries ` +
            `(${Math.round((Date.now() - startedAt) / 60000)} min). ` +
            `Filtering what was collected; --resume continues from here.`
        )
      }
      stop = true
    }
  }

  async function worker(): Promise<void> {
    while (!stop) {
      const index = cursor++
      if (index >= jobs.length) return
      await runJob(jobs[index])
      // A small stagger keeps the pool from arriving in lockstep bursts.
      await sleep(60)
    }
  }

  await Promise.all(Array.from({ length: Math.max(1, CONCURRENCY) }, () => worker()))

  state.completedQueries = [...done]
  state.candidates = [...byId.values()]
  saveState(state)

  console.log(`\nCollected ${byId.size} unique repos. Filtering...\n`)

  // ---- filtering ---------------------------------------------------------

  const drops = new Map<DropReason, string[]>()
  const drop = (reason: DropReason, name: string) => {
    if (!drops.has(reason)) drops.set(reason, [])
    drops.get(reason)!.push(name)
  }

  const excludeName = map.exclude.nameFragments.map((f) => f.toLowerCase())
  const excludeDesc = map.exclude.descriptionFragments.map((f) => f.toLowerCase())
  const excludeTopics = new Set(map.exclude.topics.map((t) => t.toLowerCase()))
  const staleBefore = Date.now() - MAX_PUSHED_AGE_DAYS * 86_400_000
  const newerThan = Date.now() - MIN_AGE_DAYS * 86_400_000

  type Kept = {
    candidate: Candidate
    score: RepoScore
    relevance: Relevance
    description: string
  }
  const kept: Kept[] = []

  for (const candidate of byId.values()) {
    const r = candidate.repo
    const full = r.fullName
    const lowerName = r.name.toLowerCase()
    const description = cleanDescription(r.description?.trim() ?? "")
    const topics = r.topics.map((t) => t.toLowerCase())

    if (curatedKeys.has(full.toLowerCase())) { drop("already-curated", full); continue }
    if (r.fork) { drop("fork", full); continue }
    if (r.archived) { drop("archived", full); continue }
    if (r.disabled) { drop("disabled", full); continue }
    if (!description) { drop("no-description", full); continue }
    if (!r.license) { drop("no-license", full); continue }
    if (Date.parse(r.pushedAt) < staleBefore) { drop("stale", full); continue }
    if (Date.parse(r.createdAt) > newerThan) { drop("too-new", full); continue }
    if (latinRatio(description) < MIN_LATIN_RATIO) {
      drop("non-latin-description", full); continue
    }
    if (excludeName.some((f) => lowerName.includes(f))) { drop("excluded-name", full); continue }

    const lowerDesc = description.toLowerCase()
    if (excludeDesc.some((f) => lowerDesc.includes(f))) {
      drop("excluded-description", full); continue
    }
    if (topics.some((t) => excludeTopics.has(t))) { drop("excluded-topic", full); continue }

    const relevance = scoreRelevance({
      name: r.name,
      description,
      topics: r.topics,
      homepage: r.homepage,
    })

    if (isDisqualified(relevance)) { drop("not-a-founder-tool", full); continue }
    if (relevance.score < MIN_RELEVANCE) { drop("low-relevance", full); continue }

    const score = scoreRepo({
      stars: r.stars,
      openIssues: r.openIssues,
      pushedAt: r.pushedAt,
      description,
      topics: r.topics,
      homepage: r.homepage,
      license: r.license,
      hasReadme: r.hasReadme,
    })

    if (score.total < MIN_SCORE) { drop("low-score", full); continue }

    // The star floor, with the gem exception applied last so a small project
    // survives only on the strength of its quality and relevance.
    if (r.stars < MIN_STARS) {
      const isGem =
        r.stars >= GEM_MIN_STARS &&
        score.total >= HIDDEN_GEM_MIN_SCORE &&
        relevance.score >= 0.6
      if (!isGem) { drop("too-few-stars", full); continue }
    }

    kept.push({ candidate, score, relevance, description })
  }

  /**
   * Ranking for the cap.
   *
   * Relevance leads and the quality score is only a tie-breaker, which is the
   * opposite of what seems natural. The reason is measured: because the hard
   * filters already require a licence, a description, recent activity and a
   * README, quality lands between 0.85 and 0.89 for almost everything that
   * reaches this point and cannot separate anything. In a test run that let
   * `locally-uncensored` and an AI-shorts generator into the top 25.
   *
   * Adoption breaks the remaining ties on a log scale, so a widely used tool
   * outranks an obscure one without a 40k-star project burying a good 600-star
   * one.
   */
  const rank = (k: Kept) =>
    k.relevance.score * 3 +
    k.score.total +
    Math.log10(Math.max(1, k.candidate.repo.stars)) / 5

  kept.sort((a, b) => rank(b) - rank(a))

  const capped = kept.slice(0, MAX_REPOS)
  for (const { candidate } of kept.slice(MAX_REPOS)) {
    drop("cap-reached", candidate.repo.fullName)
  }

  // ---- build entries -----------------------------------------------------

  const nowIso = new Date().toISOString()
  const addedAt = nowIso.slice(0, 10)
  const usedIds = new Set(curated.map((r) => r.id))
  const entries: Repo[] = []

  for (const { candidate, score, description } of capped) {
    const r = candidate.repo
    const ranked = Object.entries(candidate.votes).sort((a, b) => b[1] - a[1])
    const primary = ranked[0][0] as Category
    const secondary = ranked[1]?.[0] as Category | undefined

    const isGem =
      r.stars >= HIDDEN_GEM_STARS.min &&
      r.stars <= HIDDEN_GEM_STARS.max &&
      score.total >= HIDDEN_GEM_MIN_SCORE

    entries.push({
      id: uniqueId(r.fullName, usedIds),
      name: r.name,
      owner: r.owner,
      url: r.url,
      category: primary,
      ...(secondary && secondary !== primary ? { secondaryCategory: secondary } : {}),
      description: description.slice(0, 350),
      tags: r.topics.filter((t) => /^[a-z0-9][a-z0-9+._-]*$/.test(t)).slice(0, 8),
      source: "auto-discovered",
      reviewed: false,
      addedAt,
      isEditorPick: false,
      isHiddenGem: isGem,
      githubId: r.githubId,
      avatarUrl: r.avatarUrl,
      ...(r.homepage && isHttpUrl(r.homepage) ? { homepage: r.homepage } : {}),
      score,
      stats: {
        stars: r.stars,
        forks: r.forks,
        ...(r.language ? { language: r.language } : {}),
        ...(r.license ? { license: r.license } : {}),
        openIssues: r.openIssues,
        pushedAt: r.pushedAt,
        createdAt: r.createdAt,
        fetchedAt: nowIso,
      },
    })
  }

  const parsed = reposSchema.safeParse(entries)
  if (!parsed.success) {
    console.error("Generated entries do not match repoSchema; nothing written.")
    console.error(JSON.stringify(parsed.error.issues.slice(0, 10), null, 2))
    process.exit(1)
  }

  writeFileSync(OUT_PATH, JSON.stringify(entries, null, 2) + "\n", "utf8")
  writeReport({ entries, drops, collected: byId.size, gql, rest, useGraphQL })
  if (existsSync(STATE_PATH)) rmSync(STATE_PATH)

  console.log(`\nWrote ${entries.length} entries to data/discovered.json`)
  console.log(`  hidden gems: ${entries.filter((e) => e.isHiddenGem).length}`)
  console.log(`  report:      data/discover-report.md`)
  console.log(
    `  graphql:     ${gql.requests} requests, ${gql.pointsUsed} points, ${gql.remaining} left`
  )
  console.log(`  rest:        ${rest.rate.used} requests`)
}

function latinRatio(text: string): number {
  const letters = text.match(/\p{L}/gu)
  if (!letters || letters.length === 0) return 1
  return letters.filter((char) => /\p{Script=Latin}/u.test(char)).length / letters.length
}

function uniqueId(fullName: string, used: Set<string>): string {
  const base = fullName.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "")
  let id = base
  let n = 2
  while (used.has(id)) id = `${base}-${n++}`
  used.add(id)
  return id
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
  entries,
  drops,
  collected,
  gql,
  rest,
  useGraphQL,
}: {
  entries: Repo[]
  drops: Map<DropReason, string[]>
  collected: number
  gql: GraphQLClient
  rest: GitHubClient
  useGraphQL: boolean
}) {
  const perCategory = CATEGORIES.map((category) => ({
    label: CATEGORY_META[category].label,
    count: entries.filter((e) => e.category === category).length,
    secondary: entries.filter((e) => e.secondaryCategory === category).length,
    gems: entries.filter((e) => e.category === category && e.isHiddenGem).length,
  }))

  const totalDropped = [...drops.values()].reduce((sum, list) => sum + list.length, 0)
  const stars = entries.map((e) => e.stats?.stars ?? 0).sort((a, b) => a - b)
  const median = stars.length ? stars[Math.floor(stars.length / 2)] : 0

  const lines: string[] = [
    "# Discovery report",
    "",
    `Generated: ${new Date().toISOString()}`,
    "",
    "## Results",
    "",
    `- Unique repos seen: **${collected}**`,
    `- Written to \`data/discovered.json\`: **${entries.length}**`,
    `- Dropped: ${totalDropped}`,
    `- Hidden gem candidates: ${entries.filter((e) => e.isHiddenGem).length}`,
    `- Median stars: ${median.toLocaleString()}`,
    `- Engine: ${useGraphQL ? "GraphQL" : "REST search (GraphQL unavailable or disabled)"}`,
    `- GraphQL: ${gql.requests} requests, ${gql.pointsUsed} points used`,
    `- REST: ${rest.rate.used} requests`,
    "",
    "## Filters applied",
    "",
    `- Stars >= ${MIN_STARS}, or >= ${GEM_MIN_STARS} for a hidden gem scoring >= ${HIDDEN_GEM_MIN_SCORE}`,
    `- Not a fork, not archived, not disabled`,
    `- Has a licence GitHub can resolve to an SPDX id, and a description`,
    `- Pushed within ${MAX_PUSHED_AGE_DAYS} days, created more than ${MIN_AGE_DAYS} days ago`,
    `- Quality score >= ${MIN_SCORE}, founder relevance >= ${MIN_RELEVANCE}`,
    `- Excluded: awesome-lists, tutorials, courses, books, dotfiles, interview prep,`,
    `  research, demos, boilerplates, and vendor SDKs`,
    "",
    "## Per category",
    "",
    "| Category | Primary | Also tagged | Gems |",
    "| --- | --- | --- | --- |",
    ...perCategory.map((c) => `| ${c.label} | ${c.count} | ${c.secondary} | ${c.gems} |`),
    "",
    "## Drops by reason",
    "",
    "| Reason | Count |",
    "| --- | --- |",
    ...[...drops.entries()]
      .sort((a, b) => b[1].length - a[1].length)
      .map(([reason, list]) => `| ${DROP_LABELS[reason]} | ${list.length} |`),
    "",
    "## Sample of what was dropped",
    "",
  ]

  for (const [reason, list] of [...drops.entries()].sort(
    (a, b) => b[1].length - a[1].length
  )) {
    lines.push(`### ${DROP_LABELS[reason]} (${list.length})`, "")
    lines.push(list.slice(0, 12).map((r) => `- \`${r}\``).join("\n"))
    if (list.length > 12) lines.push(`- ...and ${list.length - 12} more`)
    lines.push("")
  }

  lines.push(
    "## Highest ranked entries kept",
    "",
    "| Repo | Stars | Score | Category |",
    "| --- | --- | --- | --- |",
    ...entries
      .slice(0, 30)
      .map(
        (e) =>
          `| \`${e.owner}/${e.name}\` | ${(e.stats?.stars ?? 0).toLocaleString()} | ` +
          `${e.score?.total.toFixed(2) ?? "-"} | ${CATEGORY_META[e.category].label} |`
      ),
    "",
    "## What is stored",
    "",
    "Only data the GitHub API returned: id, owner, name, url, avatar, description,",
    "stars, forks, language, licence, topics, open issues, and the push/create",
    "dates. Descriptions are verbatim apart from stripped emoji. No description,",
    "review, pro, con, or difficulty is generated for a discovered repo -- those",
    "stay empty and the UI labels the entry unreviewed.",
    ""
  )

  writeFileSync(REPORT_PATH, lines.join("\n"), "utf8")
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error)
  process.exit(1)
})
