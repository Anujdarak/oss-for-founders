import Fuse, { type FuseResultMatch, type IFuseOptions } from "fuse.js"

import type { Repo } from "./schema"

/**
 * The shape the search index stores. Trimmed deliberately: the client fetches
 * this for /ask, and shipping the full entries would mean sending editorial
 * prose and score breakdowns nobody searches over.
 */
export type SearchDoc = {
  id: string
  name: string
  owner: string
  category: Repo["category"]
  secondaryCategory?: Repo["category"]
  description: string
  tags: string[]
  whyFounders?: string
  language?: string
  license?: string
  stars?: number
  pushedAt?: string
  selfHostable?: boolean
  difficulty?: Repo["difficulty"]
  reviewed: boolean
  isHiddenGem: boolean
  isEditorPick: boolean
}

/**
 * Rebuilt rather than stored. The GitHub URL is always owner/name, and keeping
 * a copy of it on every document cost 232 KB of the search index for nothing.
 */
export function docRepoUrl(doc: Pick<SearchDoc, "owner" | "name">): string {
  return `https://github.com/${doc.owner}/${doc.name}`
}

export function toSearchDoc(repo: Repo): SearchDoc {
  return {
    id: repo.id,
    name: repo.name,
    owner: repo.owner,
    category: repo.category,
    ...(repo.secondaryCategory ? { secondaryCategory: repo.secondaryCategory } : {}),
    description: repo.description,
    tags: repo.tags,
    ...(repo.whyFounders ? { whyFounders: repo.whyFounders } : {}),
    ...(repo.stats?.language ? { language: repo.stats.language } : {}),
    ...(repo.stats?.license ? { license: repo.stats.license } : {}),
    ...(repo.stats ? { stars: repo.stats.stars, pushedAt: repo.stats.pushedAt } : {}),
    ...(repo.selfHostable !== undefined ? { selfHostable: repo.selfHostable } : {}),
    ...(repo.difficulty ? { difficulty: repo.difficulty } : {}),
    reviewed: repo.reviewed,
    isHiddenGem: repo.isHiddenGem,
    isEditorPick: repo.isEditorPick,
  }
}

/**
 * Weighted so a repo whose *name* matches beats one that merely mentions the
 * word in prose. `whyFounders` is weighted lowest because only reviewed entries
 * have it, and it must not let the handful of reviewed repos crowd out
 * everything else on a term they happen to mention in passing.
 */
export const FUSE_KEYS = [
  { name: "name", weight: 0.3 },
  { name: "tags", weight: 0.25 },
  { name: "description", weight: 0.2 },
  { name: "owner", weight: 0.15 },
  { name: "whyFounders", weight: 0.1 },
] as const

export const FUSE_OPTIONS: IFuseOptions<SearchDoc> = {
  keys: FUSE_KEYS.map((key) => ({ name: key.name, weight: key.weight })),
  includeScore: true,
  includeMatches: true,
  // Position within the field should not matter: "self-hosted analytics" is as
  // good a match at the end of a description as at the start.
  ignoreLocation: true,
  // Tightened from 0.4/2 after testing: at the looser setting "SaaS" matched
  // the "aaS" inside "PaaS" and "Auth" matched the "aut" in "mautic", which put
  // genuinely unrelated repos in the results.
  threshold: 0.32,
  minMatchCharLength: 3,
}

export function createIndex(docs: SearchDoc[]): Fuse<SearchDoc> {
  return new Fuse(docs, FUSE_OPTIONS)
}

/**
 * One index per document set, reused for the life of the process.
 *
 * Building a Fuse index is linear in the corpus, and /explore was rebuilding it
 * from scratch on every request with a `?q=`. At a few dozen repos that is
 * invisible; at several thousand it is the slowest thing on the page, repeated
 * for every visitor. The catalogue is static JSON, so the index can simply be
 * built once.
 *
 * Keyed by the array identity rather than contents: callers pass the same
 * module-level array each time, and hashing thousands of docs to confirm they
 * have not changed would cost more than it saves.
 */
const indexCache = new WeakMap<SearchDoc[], Fuse<SearchDoc>>()

export function getIndex(docs: SearchDoc[]): Fuse<SearchDoc> {
  const cached = indexCache.get(docs)
  if (cached) return cached

  const index = createIndex(docs)
  indexCache.set(docs, index)
  return index
}

export type SearchHit = {
  doc: SearchDoc
  score: number
  /** Match tier: 0 is an exact `owner/name`, 5 is a match somewhere in the text. */
  tier: number
  matchedFields: string[]
  matchedTerms: string[]
}

/** Reviewed entries are ranked ahead of unreviewed ones at equal relevance. */
const REVIEWED_BOOST = 0.8
const EDITOR_PICK_BOOST = 0.9

/**
 * Match tiers, applied before the Fuse score.
 *
 * A multiplier cannot do this job, which is not obvious until you look at the
 * numbers. Searching "supabase" scores `supabase/supabase-kt` at 0.00000004
 * and `supabase/supabase` at 0.00000007 -- both are perfect matches, and the
 * canonical repo ranks *worse* only because it matched fewer fields. Scaling
 * numbers that are already effectively zero changes nothing; the ordering is
 * noise in the eighth decimal.
 *
 * So exactness decides the tier and the Fuse score only orders within it.
 * Naming a project is the least ambiguous thing someone can type, and it
 * should win outright.
 */
const TIER = {
  fullName: 0, // "supabase/supabase" typed in full
  exactName: 1, // "chatwoot" -> chatwoot/chatwoot
  exactOwner: 2, // "supabase" -> supabase/supabase-kt
  namePrefix: 3, // "chatwoot" -> chatwoot-mobile-app
  nameContains: 4,
  text: 5, // matched somewhere in prose or topics
} as const

/**
 * One word is a name; a phrase is a description.
 *
 * Name tiers are only applied to single-token queries, because applied to a
 * phrase they actively hurt: "kanban board" put `kanban.bash` (959 stars)
 * above every real kanban tool, and "email newsletter tool" put an email
 * spell-checker above listmonk. A repo whose *name* contains one of your words
 * is not thereby the best answer to a described need -- but it almost always
 * is when that word is the only thing you typed.
 *
 * `owner/name` is still honoured with a slash in it, since that is
 * unambiguously a name even though it tokenises as one.
 */
function matchTier(doc: SearchDoc, query: string): number {
  const q = query.trim().toLowerCase()
  if (q.length < 2) return TIER.text

  const name = doc.name.toLowerCase()
  const owner = doc.owner.toLowerCase()

  if (`${owner}/${name}` === q) return TIER.fullName

  // Anything with whitespace is a described need, not a name lookup.
  if (/\s/.test(q)) return TIER.text

  if (name === q) return TIER.exactName
  if (owner === q) return TIER.exactOwner
  if (name.startsWith(q)) return TIER.namePrefix
  if (name.includes(q) || owner.includes(q)) return TIER.nameContains
  return TIER.text
}

/**
 * Adoption as a tie-breaker only.
 *
 * Without it a 400-star near-namesake outranks the canonical 200,000-star
 * project, because Fuse sees two equally good string matches. Log-scaled and
 * capped at a 25% improvement so it nudges ties rather than turning the search
 * into a popularity chart -- a well-matched small project still beats a badly
 * matched large one.
 */
function popularityFactor(stars: number | undefined): number {
  if (!stars || stars <= 0) return 1
  const scaled = Math.min(1, Math.log10(stars) / Math.log10(200_000))
  return 1 - scaled * 0.25
}

export function search(
  index: Fuse<SearchDoc>,
  query: string,
  limit = 50
): SearchHit[] {
  const trimmed = query.trim()
  if (trimmed.length < 2) return []

  return index
    .search(trimmed)
    .map((result) => {
      // Fuse scores are distances: lower is better, so a boost multiplies down.
      let score = result.score ?? 1
      score *= popularityFactor(result.item.stars)
      if (result.item.reviewed) score *= REVIEWED_BOOST
      if (result.item.isEditorPick) score *= EDITOR_PICK_BOOST

      return {
        doc: result.item,
        score,
        tier: matchTier(result.item, trimmed),
        matchedFields: fieldsFrom(result.matches),
        matchedTerms: termsFrom(result.matches),
      }
    })
    .sort(
      (a, b) =>
        // Tier first, then relevance, then adoption as the final tie-break --
        // the three near-identical Fuse scores need something to separate them.
        a.tier - b.tier ||
        a.score - b.score ||
        (b.doc.stars ?? 0) - (a.doc.stars ?? 0)
    )
    .slice(0, limit)
}

function fieldsFrom(matches: readonly FuseResultMatch[] | undefined): string[] {
  if (!matches) return []
  return [...new Set(matches.map((match) => match.key).filter(Boolean))] as string[]
}

/**
 * The terms quoted back in "Why this matches". Only whole-word-ish fragments of
 * four characters or more survive: Fuse happily reports that "ing" or "aaS"
 * matched, and quoting that at someone makes the explanation look broken even
 * when the hit itself is fine.
 */
function termsFrom(matches: readonly FuseResultMatch[] | undefined): string[] {
  if (!matches) return []
  const terms: string[] = []

  for (const match of matches) {
    const value = match.value
    if (!value) continue

    for (const [start, end] of match.indices) {
      if (end - start + 1 < 4) continue
      // Whole words only, both ends. Guarding just the start still let "port"
      // through from "customer-portal", which reads as a typo rather than a
      // reason.
      if (start > 0 && /[a-z0-9]/i.test(value[start - 1])) continue
      if (end + 1 < value.length && /[a-z0-9]/i.test(value[end + 1])) continue
      const term = value.slice(start, end + 1).trim()
      if (term.length >= 4) terms.push(term)
    }
  }

  return [...new Set(terms)].slice(0, 4)
}

const FIELD_LABELS: Record<string, string> = {
  name: "the name",
  owner: "the owner",
  tags: "its topics",
  description: "the description",
  whyFounders: "the review",
}

/**
 * The "Why this matches" line. Built from which fields Fuse actually matched,
 * so it describes the real reason for the hit rather than asserting a rationale.
 */
export function explainMatch(hit: SearchHit): string {
  const fields = hit.matchedFields
    .map((field) => FIELD_LABELS[field])
    .filter(Boolean)

  if (fields.length === 0) return "Matched this entry."

  const terms = hit.matchedTerms.slice(0, 3)
  const where =
    fields.length === 1
      ? fields[0]
      : `${fields.slice(0, -1).join(", ")} and ${fields[fields.length - 1]}`

  return terms.length > 0
    ? `Matched ${terms.map((t) => `"${t}"`).join(", ")} in ${where}.`
    : `Matched ${where}.`
}
