import type { Repo, RepoStats } from "./schema"

/**
 * Nothing in here may read the clock. Under Cache Components, `Date.now()` and
 * `new Date()` throw a build error during prerender, and a relative string like
 * "3 days ago" baked into static HTML would be wrong by the time anyone read it
 * anyway. Every value is derived from the data alone.
 */

const compact = new Intl.NumberFormat("en-US", {
  notation: "compact",
  maximumFractionDigits: 1,
})

/** 186016 -> "186k". Lowercase reads quieter in mono. */
export function formatCount(value: number): string {
  return compact.format(value).replace("K", "k")
}

const monthYear = new Intl.DateTimeFormat("en-US", {
  month: "short",
  year: "numeric",
  timeZone: "UTC",
})

/** "2026-10-14T09:12:00Z" -> "Oct 2026". Absolute, so a cached string cannot rot. */
export function formatMonthYear(iso: string): string {
  return monthYear.format(new Date(iso))
}

const TWELVE_MONTHS_MS = 365 * 24 * 60 * 60 * 1000

/**
 * "No commits in 12+ months" measured against the moment the stats were read,
 * not against now. Both dates live in the data, so the verdict is deterministic
 * and it matches the rest of the stat row, which is also a snapshot.
 */
export function isPossiblyStale(stats: RepoStats | undefined): boolean {
  if (!stats) return false
  return Date.parse(stats.fetchedAt) - Date.parse(stats.pushedAt) > TWELVE_MONTHS_MS
}

export type Maintenance = {
  key: "archived" | "active" | "slowing" | "stale" | "unknown"
  label: string
  detail: string
}

/**
 * Maintenance status, judged from the last push against the date the stats were
 * read -- the same basis as `isPossiblyStale`, and for the same reason: a clock
 * read during prerender is a build error, and a cached relative date rots.
 */
export function maintenanceStatus(stats: RepoStats | undefined): Maintenance {
  if (!stats) {
    return {
      key: "unknown",
      label: "Unknown",
      detail: "No stats have been read for this repo yet.",
    }
  }

  if (stats.archived) {
    return {
      key: "archived",
      label: "Archived",
      detail: "The owner has archived this repository. It is read-only upstream.",
    }
  }

  const days = (Date.parse(stats.fetchedAt) - Date.parse(stats.pushedAt)) / 86_400_000
  const asOf = `as of ${formatDate(stats.fetchedAt)}`

  if (days <= 90) {
    return {
      key: "active",
      label: "Active",
      detail: `Pushed within three months of the last stats read (${asOf}).`,
    }
  }
  if (days <= 365) {
    return {
      key: "slowing",
      label: "Slowing",
      detail: `Last push was ${Math.round(days)} days before the stats read (${asOf}).`,
    }
  }
  return {
    key: "stale",
    label: "Possibly stale",
    detail: `No commits for over a year before the stats read (${asOf}).`,
  }
}

const DIFFICULTY_LABELS = {
  beginner: "Beginner",
  intermediate: "Intermediate",
  advanced: "Advanced",
} as const

export function formatDifficulty(
  difficulty: keyof typeof DIFFICULTY_LABELS
): string {
  return DIFFICULTY_LABELS[difficulty]
}

/**
 * Three honest states, not two. An entry can be hand-picked into the curated
 * file and still have nobody's write-up attached to it, and calling that
 * "Auto-discovered" would be as wrong as calling it "Editor-reviewed".
 */
/**
 * The badge text, or null when there is nothing worth saying.
 *
 * Previously every unreviewed entry carried a "Not reviewed yet" or
 * "Auto-discovered" chip — 4,904 of 4,906 cards. At that ratio the badge
 * stopped distinguishing anything and just added noise to every row.
 *
 * Returning null rather than a neutral label is deliberate: saying nothing
 * claims nothing. "Editor-reviewed" still marks the entries a human actually
 * wrote up, so the positive claim survives and only the near-universal
 * negative one goes. The detail page still explains, in full, why an
 * unreviewed repo has no pros, cons or founder write-up.
 */
export function reviewLabel(repo: Pick<Repo, "reviewed" | "source">): string | null {
  return repo.reviewed ? "Editor-reviewed" : null
}

export function formatDate(iso: string): string {
  return new Intl.DateTimeFormat("en-US", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(iso))
}
