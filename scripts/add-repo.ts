/**
 * Adds one curated repo to data/repos.json, with every fact read from the
 * GitHub API rather than typed by hand.
 *
 * This exists because the failure mode when adding repos manually is always the
 * same: a name typed from memory that was renamed last year, or a star count
 * invented to fill a field. One API read removes both.
 *
 * Usage:
 *   npm run add-repo -- <owner/name|github url> <category> [flags]
 *
 *   --gem        mark as a hidden gem (editorial judgment)
 *   --pick       mark as an editor's pick
 *   --force      add it even if it fails a quality check
 *   --dry-run    print the entry without writing
 *
 * Works without GITHUB_TOKEN (one request fits the unauthenticated budget),
 * but uses the token when present.
 */
import { readFileSync, writeFileSync } from "node:fs"
import path from "node:path"

import { CATEGORIES, CATEGORY_META, isCategory } from "../lib/categories"
import { loadEnv } from "../lib/env"
import { spdxId, type GitHubRepo } from "../lib/github"
import { reposSchema, type Repo } from "../lib/schema"
import { scoreRepo } from "../lib/scoring"
import { cleanDescription } from "../lib/text"

loadEnv()

const REPOS_PATH = path.join(process.cwd(), "data", "repos.json")
const MAX_PUSHED_AGE_DAYS = 365

const args = process.argv.slice(2)
const flags = new Set(args.filter((arg) => arg.startsWith("--")))
const positional = args.filter((arg) => !arg.startsWith("--"))

function die(message: string, detail?: string): never {
  console.error(`\n${message}`)
  if (detail) console.error(detail)
  process.exit(1)
}

function usage(): never {
  die(
    "Usage: npm run add-repo -- <owner/name> <category> [--gem] [--pick] [--force] [--dry-run]",
    `\nCategories:\n${CATEGORIES.map((c) => `  ${c.padEnd(26)} ${CATEGORY_META[c].label}`).join("\n")}`
  )
}

/** Accepts `owner/name`, a full GitHub URL, or a URL with extra path segments. */
function parseTarget(input: string): { owner: string; name: string } {
  const cleaned = input
    .trim()
    .replace(/^https?:\/\/(www\.)?github\.com\//i, "")
    .replace(/\.git$/, "")
    .replace(/^\/+|\/+$/g, "")

  const [owner, name] = cleaned.split("/")
  if (!owner || !name) die(`Could not read "owner/name" from "${input}".`)
  return { owner, name }
}

async function main() {
  if (positional.length < 2) usage()

  const { owner, name } = parseTarget(positional[0])
  const category = positional[1]

  if (!isCategory(category)) {
    die(
      `"${category}" is not a category.`,
      CATEGORIES.map((c) => `  ${c.padEnd(26)} ${CATEGORY_META[c].label}`).join("\n")
    )
  }

  const existing: Repo[] = reposSchema.parse(
    JSON.parse(readFileSync(REPOS_PATH, "utf8"))
  )

  const token = process.env.GITHUB_TOKEN?.trim()
  const response = await fetch(`https://api.github.com/repos/${owner}/${name}`, {
    headers: {
      accept: "application/vnd.github+json",
      "user-agent": "oss-for-founders-add",
      ...(token ? { authorization: `Bearer ${token}` } : {}),
    },
  })

  if (response.status === 404) {
    die(
      `GitHub returned 404 for ${owner}/${name}.`,
      "It may be private, deleted, or renamed. Open it in a browser and use the name it redirects to."
    )
  }
  if (response.status === 403) {
    die(
      "GitHub returned 403 (rate limited).",
      "Unauthenticated requests are capped at 60/hour. Set GITHUB_TOKEN or wait for the window to reset."
    )
  }
  if (!response.ok) die(`GitHub returned HTTP ${response.status}.`)

  const payload = (await response.json()) as GitHubRepo

  // The canonical name after any rename. This is the whole reason the script
  // reads the API instead of trusting what you typed.
  if (payload.full_name.toLowerCase() !== `${owner}/${name}`.toLowerCase()) {
    console.log(`note: ${owner}/${name} redirects to ${payload.full_name} -- using that.`)
  }

  const canonicalOwner = payload.owner.login
  const canonicalName = payload.name
  const key = `${canonicalOwner}/${canonicalName}`.toLowerCase()

  if (existing.some((repo) => `${repo.owner}/${repo.name}`.toLowerCase() === key)) {
    die(`${payload.full_name} is already in data/repos.json.`)
  }

  // The same bar the discovery import applies, so hand-added entries cannot be
  // held to a lower standard than imported ones.
  const license = spdxId(payload)
  const description = cleanDescription(payload.description?.trim() ?? "")
  const pushedDaysAgo = (Date.now() - Date.parse(payload.pushed_at)) / 86_400_000

  const problems: string[] = []
  if (payload.archived) problems.push("archived upstream")
  if (payload.disabled) problems.push("disabled upstream")
  if (payload.fork) problems.push("is a fork")
  if (!description) problems.push("no description on GitHub")
  if (pushedDaysAgo > MAX_PUSHED_AGE_DAYS) {
    problems.push(`no push in ${Math.round(pushedDaysAgo)} days`)
  }

  /**
   * No LICENSE file at all means all rights reserved by default -- nobody can
   * legally run it, so it has no place in a catalogue of tools you can run.
   *
   * A LICENSE file GitHub cannot map to an SPDX id is a different thing: it is
   * almost always open-core or a source-available licence, which is how a lot
   * of the most useful founder tooling ships (PostHog, Sentry, n8n). Refusing
   * those would contradict the catalogue, which already carries a dozen of
   * them, and the detail page already tells the reader to check the licence.
   */
  if (payload.license === null) {
    problems.push("no LICENSE file at all -- all rights reserved by default")
  }

  if (problems.length > 0) {
    const list = problems.map((p) => `  - ${p}`).join("\n")
    if (!flags.has("--force")) {
      die(
        `${payload.full_name} does not meet the catalogue's bar:\n${list}`,
        "\nAdd --force if you want it anyway, and say why in the commit message."
      )
    }
    console.log(`warning: adding despite:\n${list}`)
  }

  if (!license) {
    console.log(
      `note: GitHub cannot resolve ${payload.full_name}'s licence to an SPDX id ` +
        `(usually open-core or source-available).\n` +
        `      The entry will show no licence and the detail page will say to check the repo.\n` +
        `      Read it yourself before recommending this one.`
    )
  }

  const nowIso = new Date().toISOString()
  const stats = {
    stars: payload.stargazers_count,
    forks: payload.forks_count,
    ...(payload.language ? { language: payload.language } : {}),
    ...(license ? { license } : {}),
    openIssues: payload.open_issues_count,
    pushedAt: payload.pushed_at,
    createdAt: payload.created_at,
    ...(payload.archived ? { archived: true } : {}),
    fetchedAt: nowIso,
  }

  const homepage = payload.homepage?.trim()
  const entry: Repo = {
    id: uniqueId(payload.full_name, new Set(existing.map((r) => r.id))),
    name: canonicalName,
    owner: canonicalOwner,
    url: payload.html_url,
    category,
    description: description.slice(0, 350),
    tags: (payload.topics ?? [])
      .filter((topic) => /^[a-z0-9][a-z0-9+._-]*$/.test(topic))
      .slice(0, 8),
    source: "curated",
    // Facts are in; the write-up is not. Flipping this to true is a human act.
    reviewed: false,
    addedAt: nowIso.slice(0, 10),
    isEditorPick: flags.has("--pick"),
    isHiddenGem: flags.has("--gem"),
    githubId: payload.id,
    avatarUrl: payload.owner.avatar_url,
    ...(homepage && isHttpUrl(homepage) ? { homepage } : {}),
    score: scoreRepo(
      {
        stars: payload.stargazers_count,
        openIssues: payload.open_issues_count,
        pushedAt: payload.pushed_at,
        description,
        topics: payload.topics ?? [],
        homepage: homepage || null,
        license: license ?? null,
        hasReadme: true,
      },
      Date.parse(nowIso)
    ),
    stats,
  }

  const next = [...existing, entry]
  const check = reposSchema.safeParse(next)
  if (!check.success) {
    die(
      "The generated entry does not match repoSchema; nothing written.",
      JSON.stringify(check.error.issues.slice(0, 5), null, 2)
    )
  }

  if (flags.has("--dry-run")) {
    console.log(JSON.stringify(entry, null, 2))
    console.log("\n--dry-run: nothing written")
    return
  }

  writeFileSync(REPOS_PATH, JSON.stringify(next, null, 2) + "\n", "utf8")

  console.log(`\nAdded ${payload.full_name} to ${CATEGORY_META[category].label}.`)
  console.log(`  id:     ${entry.id}`)
  console.log(`  stars:  ${stats.stars}`)
  console.log(`  licence:${license ?? " none resolved"}`)
  console.log(`  score:  ${entry.score?.total}`)
  console.log(`  page:   /r/${canonicalOwner}/${canonicalName}`)
  console.log(
    [
      "",
      "It will show as 'Not reviewed yet' until someone writes it up. To review it,",
      "open data/repos.json, find the entry, and add:",
      "",
      '  "reviewed": true,',
      '  "whyFounders": "What it saves a founder, in one or two plain sentences.",',
      '  "difficulty": "beginner" | "intermediate" | "advanced",',
      '  "selfHostable": true,',
      '  "installHint": "The command you actually ran.",',
      '  "pros": ["..."],',
      '  "cons": ["..."],',
      '  "alternatives": ["..."]',
      "",
      "Then run: npm run validate",
    ].join("\n")
  )
}

function uniqueId(fullName: string, used: Set<string>): string {
  const base = fullName
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
  let id = base
  let n = 2
  while (used.has(id)) id = `${base}-${n++}`
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

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error)
  process.exit(1)
})
