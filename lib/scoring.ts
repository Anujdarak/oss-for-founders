import type { RepoScore } from "./schema"

/**
 * The discovery quality score. Every component is 0-1 and every input is a fact
 * the GitHub API reports, so a score can always be explained rather than
 * trusted. The breakdown is stored on each entry and shown in the UI.
 *
 * Note what is deliberately *not* here: nothing rewards or punishes a repo for
 * being small. Popularity is one log-scaled component out of six, so a 200-star
 * project with good docs and recent commits outscores a 40k-star project that
 * has not been touched in two years.
 */
export const SCORE_WEIGHTS = {
  activity: 0.3,
  popularity: 0.2,
  metadata: 0.15,
  readme: 0.15,
  license: 0.1,
  issueHealth: 0.1,
} as const

export const SCORE_LABELS: Record<keyof typeof SCORE_WEIGHTS, string> = {
  activity: "Recent activity",
  popularity: "Adoption",
  metadata: "Description and topics",
  readme: "README present",
  license: "Licence clarity",
  issueHealth: "Issue health",
}

export const SCORE_EXPLANATIONS: Record<keyof typeof SCORE_WEIGHTS, string> = {
  activity: "How recently the default branch was pushed to.",
  popularity: "Stars on a log scale, so adoption counts without dominating.",
  metadata: "Whether the repo describes itself: description, topics, homepage.",
  readme: "Whether the repository has a README at all.",
  license: "Whether GitHub can resolve the licence to a recognised SPDX id.",
  issueHealth: "Open issues relative to adoption, as a rough maintenance signal.",
}

/**
 * Entries scoring below this are dropped by the import.
 *
 * Calibrated against a real test import rather than guessed. The hard filters
 * in `discover.ts` already require a licence, a description, and a push in the
 * last 12 months, so `activity` and `license` are near 1 for everything that
 * reaches scoring and observed totals cluster between 0.79 and 0.95. The score
 * therefore does most of its work ranking survivors, not rejecting them; this
 * floor only removes entries that are thin on several axes at once.
 */
export const MIN_SCORE = 0.55

/**
 * A hidden gem is a high scorer that few people have found yet.
 *
 * Both numbers are set against the real distribution of a 4,900-repo import,
 * and both have been wrong before. Measured across that catalogue:
 *
 *   score   p50 0.905   p75 0.937   p90 0.964   p95 0.981
 *   stars   p25 610     p50 1,434   p75 4,634   p90 13,563
 *
 * That makes the two earlier settings obviously broken in hindsight. A 0.80
 * score floor sits *below the median*, and a 200-2,000 star band straddles the
 * median star count — together they flagged 2,535 of 4,906 entries, which is
 * not a shortlist, it is the catalogue.
 *
 * At 200-1,000 stars and 0.92 the label lands on ~4.7% of entries: clearly
 * below median adoption, clearly above median quality. The star floor is also
 * lower than the catalogue's general 500-star minimum, because a gem is the one
 * case where being small is the point.
 */
export const HIDDEN_GEM_STARS = { min: 200, max: 1_000 } as const
export const HIDDEN_GEM_MIN_SCORE = 0.92

const DAY_MS = 24 * 60 * 60 * 1000

export type ScoreInput = {
  stars: number
  openIssues: number
  pushedAt: string
  description: string | null
  topics: string[]
  homepage: string | null
  license: string | null
  hasReadme: boolean | null
}

function activityScore(pushedAt: string, now: number): number {
  const days = (now - Date.parse(pushedAt)) / DAY_MS
  if (!Number.isFinite(days)) return 0
  if (days <= 30) return 1
  if (days <= 90) return 0.85
  if (days <= 180) return 0.7
  if (days <= 365) return 0.4
  return 0
}

/** log10 scaled so 50 stars ~ 0.18 and 50k stars = 1. */
function popularityScore(stars: number): number {
  if (stars <= 0) return 0
  const scaled = Math.log10(stars) / Math.log10(50_000)
  return Math.min(1, Math.max(0, scaled))
}

function metadataScore(input: ScoreInput): number {
  let score = 0
  if (input.description && input.description.trim().length >= 20) score += 0.5
  if (input.topics.length >= 3) score += 0.3
  else if (input.topics.length >= 1) score += 0.15
  if (input.homepage) score += 0.2
  return Math.min(1, score)
}

function issueHealthScore(stars: number, openIssues: number): number {
  // Open issues are only meaningful relative to how many people use the thing.
  const ratio = openIssues / Math.max(stars, 1)
  if (ratio <= 0.02) return 1
  if (ratio <= 0.05) return 0.8
  if (ratio <= 0.1) return 0.6
  if (ratio <= 0.2) return 0.4
  return 0.2
}

export function scoreRepo(input: ScoreInput, now = Date.now()): RepoScore {
  const parts = {
    activity: activityScore(input.pushedAt, now),
    popularity: popularityScore(input.stars),
    metadata: metadataScore(input),
    // An unchecked README is treated as present-but-unverified rather than
    // scored as if the repo had none.
    readme: input.hasReadme === null ? 0.5 : input.hasReadme ? 1 : 0,
    license: input.license ? 1 : 0,
    issueHealth: issueHealthScore(input.stars, input.openIssues),
  }

  const total = Object.entries(SCORE_WEIGHTS).reduce(
    (sum, [component, weight]) =>
      sum + parts[component as keyof typeof SCORE_WEIGHTS] * weight,
    0
  )

  return { ...parts, total: round(total) }
}

export function isHiddenGemCandidate(score: RepoScore, stars: number): boolean {
  return (
    stars >= HIDDEN_GEM_STARS.min &&
    stars <= HIDDEN_GEM_STARS.max &&
    score.total >= HIDDEN_GEM_MIN_SCORE
  )
}

function round(value: number): number {
  return Math.round(value * 1000) / 1000
}

export function formatScore(value: number): string {
  return value.toFixed(2)
}
