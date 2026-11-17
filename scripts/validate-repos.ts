import { readFileSync } from "node:fs"
import path from "node:path"
import { z } from "zod"

import { CATEGORIES } from "../lib/categories"
import { hasEditorialContent, reposSchema, type Repo } from "../lib/schema"
import { stacksSchema } from "../lib/stacks"

const FILES = [
  { rel: "data/repos.json", label: "curated" },
  { rel: "data/discovered.json", label: "discovered" },
] as const

function die(heading: string, body?: string): never {
  console.error(`\n${heading}`)
  if (body) console.error(body)
  process.exit(1)
}

function load(rel: string): Repo[] {
  const abs = path.join(process.cwd(), rel)

  let raw: string
  try {
    raw = readFileSync(abs, "utf8")
  } catch {
    die(`Cannot read ${rel} at ${abs}`)
  }

  let json: unknown
  try {
    json = JSON.parse(raw)
  } catch (error) {
    die(
      `${rel} is not valid JSON.`,
      error instanceof Error ? error.message : String(error)
    )
  }

  const result = reposSchema.safeParse(json)
  if (!result.success) {
    die(`${rel} does not match repoSchema:\n`, z.prettifyError(result.error))
  }

  return result.data
}

const errors: string[] = []
const loaded = FILES.map((file) => ({ ...file, repos: load(file.rel) }))

/** Ids address detail pages and GitHub paths identify repos; both must be unique across files. */
const idOwner = new Map<string, string>()
const keyOwner = new Map<string, string>()

for (const { rel, repos } of loaded) {
  repos.forEach((repo, index) => {
    const where = `${rel}[${index}] (${repo.id})`

    const idSeen = idOwner.get(repo.id)
    if (idSeen) {
      errors.push(`duplicate id "${repo.id}": ${idSeen} and ${where}`)
    } else {
      idOwner.set(repo.id, where)
    }

    const key = `${repo.owner}/${repo.name}`.toLowerCase()
    const keySeen = keyOwner.get(key)
    if (keySeen) {
      // Not fatal across files -- the merge resolves curated over discovered --
      // but two entries for one repo inside a single file is a mistake.
      if (keySeen.startsWith(rel)) {
        errors.push(`duplicate repo "${key}": ${keySeen} and ${where}`)
      }
    } else {
      keyOwner.set(key, where)
    }

    // Catches the common copy-paste error of cloning an entry and updating the
    // url but not owner/name, or the reverse.
    if (repo.url.startsWith("https://github.com/")) {
      const expected = `https://github.com/${repo.owner}/${repo.name}`
      if (repo.url !== expected) {
        errors.push(`${where}: url is "${repo.url}" but owner/name imply "${expected}"`)
      }
    }

    const duplicateTags = [
      ...new Set(repo.tags.filter((tag, i) => repo.tags.indexOf(tag) !== i)),
    ]
    if (duplicateTags.length > 0) {
      errors.push(`${where}: duplicate tags ${duplicateTags.join(", ")}`)
    }

    // An entry claiming editorial review with nothing written is mislabelled.
    if (repo.reviewed && !hasEditorialContent(repo)) {
      errors.push(`${where}: marked reviewed but has no editorial content`)
    }

    if (repo.stats && Date.parse(repo.stats.pushedAt) > Date.parse(repo.stats.fetchedAt) + 86_400_000) {
      errors.push(`${where}: stats.pushedAt is later than stats.fetchedAt`)
    }
  })
}

const allRepos = loaded.flatMap((file) => file.repos)

/**
 * Stacks reference repos by owner/name. A reference to something that is not in
 * the catalogue renders as a gap on the page, so it fails here instead.
 */
const stacksPath = path.join(process.cwd(), "data", "stacks.json")
try {
  const stacksRaw: unknown = JSON.parse(readFileSync(stacksPath, "utf8"))
  const parsedStacks = stacksSchema.safeParse(stacksRaw)

  if (!parsedStacks.success) {
    die("data/stacks.json does not match stackSchema:\n", z.prettifyError(parsedStacks.error))
  }

  const repoKeys = new Set(
    allRepos.map((repo) => `${repo.owner}/${repo.name}`.toLowerCase())
  )
  const slugs = new Set<string>()

  for (const stack of parsedStacks.data) {
    if (slugs.has(stack.slug)) {
      errors.push(`data/stacks.json: duplicate slug "${stack.slug}"`)
    }
    slugs.add(stack.slug)

    for (const item of stack.items) {
      if (!repoKeys.has(item.repo.toLowerCase())) {
        errors.push(
          `data/stacks.json: "${stack.slug}" references "${item.repo}", which is not in the catalogue`
        )
      }
    }
  }
} catch (error) {
  if (error instanceof Error && "code" in error && error.code === "ENOENT") {
    errors.push("data/stacks.json is missing")
  } else if (error instanceof SyntaxError) {
    errors.push(`data/stacks.json is not valid JSON: ${error.message}`)
  } else {
    throw error
  }
}

/** A category with no entries renders an empty page the nav still links to. */
const empty = CATEGORIES.filter(
  (category) => !allRepos.some((repo) => repo.category === category)
)
if (empty.length > 0) {
  errors.push(`categories with no entries: ${empty.join(", ")}`)
}

if (errors.length > 0) {
  die(
    `Found ${errors.length} integrity problem(s):\n`,
    errors.map((error) => `  - ${error}`).join("\n")
  )
}

const counts = loaded
  .map(({ label, repos }) => `${repos.length} ${label}`)
  .join(", ")
const reviewed = allRepos.filter((r) => r.reviewed).length
const withStats = allRepos.filter((r) => r.stats).length

console.log(
  `Data is valid: ${allRepos.length} repo(s) (${counts}), ` +
    `${reviewed} editor-reviewed, ${withStats} with stats, ` +
    `${allRepos.filter((r) => r.isEditorPick).length} editor pick(s), ` +
    `${allRepos.filter((r) => r.isHiddenGem).length} hidden gem(s), ` +
    `${CATEGORIES.length} categories in use.`
)
