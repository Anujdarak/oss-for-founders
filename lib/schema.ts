import { z } from "zod"

import { isSafeHttpUrl } from "./safe-url"

import { CATEGORIES } from "./categories"

export const DIFFICULTIES = ["beginner", "intermediate", "advanced"] as const
export type Difficulty = (typeof DIFFICULTIES)[number]

/** Where an entry came from. `curated` is hand-picked; `auto-discovered` came from the import. */
export const SOURCES = ["curated", "auto-discovered"] as const
export type Source = (typeof SOURCES)[number]

/**
 * A URL that is safe to put in an href.
 *
 * `z.url()` validates syntax, not safety: it accepts `javascript:alert(1)`
 * and `data:text/html,...` as perfectly good URLs. Repo homepages come
 * straight from their owners through the discovery import and are rendered
 * as links, so the scheme has to be constrained at the point data enters,
 * not only at the point it is displayed.
 */
const httpUrl = z.url().refine(isSafeHttpUrl, {
  message: "must be an http(s) URL",
})

const nonEmpty = z.string().trim().min(1)
const isoDate = z.string().refine((value) => !Number.isNaN(Date.parse(value)), {
  message: "must be a parseable date",
})

/**
 * Live numbers read from the GitHub API. `fetchedAt` is required alongside them:
 * a star count committed to a JSON file is wrong the next day, so the only
 * honest way to ship one is to say when it was true.
 *
 * Every field here is reported by the API. Nothing is derived or estimated.
 */
export const statsSchema = z.strictObject({
  stars: z.number().int().nonnegative(),
  forks: z.number().int().nonnegative(),
  language: nonEmpty.optional(),
  license: nonEmpty.optional(),
  openIssues: z.number().int().nonnegative().optional(),
  pushedAt: isoDate,
  createdAt: isoDate.optional(),
  archived: z.boolean().optional(),
  fetchedAt: isoDate,
})

export type RepoStats = z.infer<typeof statsSchema>

/**
 * How the discovery import scored an entry, kept so the number can be explained
 * rather than trusted. Each component is 0-1; `total` is their weighted sum.
 */
export const scoreSchema = z.strictObject({
  total: z.number(),
  activity: z.number(),
  license: z.number(),
  metadata: z.number(),
  readme: z.number(),
  issueHealth: z.number(),
  popularity: z.number(),
})

export type RepoScore = z.infer<typeof scoreSchema>

/**
 * The single source of truth for a repo entry. Types are inferred from this, so
 * the compile-time shape and the runtime validator cannot drift apart.
 *
 * Editorial fields are optional because most entries arrive from the import
 * with none of them. Every surface has to render the empty case.
 */
export const repoSchema = z.strictObject({
  id: z
    .string()
    .regex(/^[a-z0-9][a-z0-9-]*$/, "must be lowercase kebab-case"),
  name: nonEmpty,
  owner: nonEmpty,
  url: httpUrl,
  category: z.enum(CATEGORIES),
  // GitHub-authored descriptions are quoted verbatim and some run long; cards
  // clamp to two lines rather than truncating the text in the data.
  description: nonEmpty.max(350),
  tags: z.array(
    z.string().regex(/^[a-z0-9][a-z0-9+._-]*$/, "must be lowercase")
  ),

  /** Which file/process produced the entry. */
  source: z.enum(SOURCES),
  /** Whether a human has written the editorial fields below. */
  reviewed: z.boolean(),

  addedAt: isoDate,
  isEditorPick: z.boolean(),
  isHiddenGem: z.boolean(),
  stats: statsSchema.optional(),

  // Facts from the API, kept outside `stats` because they are not measurements.
  githubId: z.number().int().positive().optional(),
  avatarUrl: httpUrl.optional(),
  homepage: httpUrl.optional(),
  secondaryCategory: z.enum(CATEGORIES).optional(),
  score: scoreSchema.optional(),

  // Editorial judgment, not facts pulled from the repo. All optional.
  whyFounders: nonEmpty.max(400).optional(),
  problemSolved: nonEmpty.max(400).optional(),
  features: z.array(nonEmpty).optional(),
  useCases: z.array(nonEmpty).optional(),
  techStack: z.array(nonEmpty).optional(),
  docsUrl: httpUrl.optional(),
  difficulty: z.enum(DIFFICULTIES).optional(),
  selfHostable: z.boolean().optional(),
  pros: z.array(nonEmpty).optional(),
  cons: z.array(nonEmpty).optional(),
  alternatives: z.array(nonEmpty).optional(),
  installHint: nonEmpty.optional(),
})

export const reposSchema = z.array(repoSchema)

export type Repo = z.infer<typeof repoSchema>

/** True when a repo carries any hand-written editorial content. */
export function hasEditorialContent(repo: Repo): boolean {
  return Boolean(
    repo.whyFounders ||
      repo.problemSolved ||
      repo.pros?.length ||
      repo.cons?.length ||
      repo.features?.length ||
      repo.useCases?.length
  )
}
