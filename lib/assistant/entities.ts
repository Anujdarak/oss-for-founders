import { CATEGORY_META } from "../categories"
import { NEEDS } from "./needs"
import { contentWords, isStopword } from "./plan"
import { loadCorpus } from "./retrieve"

/**
 * Repos the reader named.
 *
 * The planner turns a message into *kinds* of tool, which is right for "I
 * need auth" and exactly wrong for "ollama": the model rewrote it as "run
 * LLMs locally", BM25 searched that, and ollama itself — in the catalogue,
 * 186k stars — did not make the top six. A name is the most specific thing a
 * message can contain, so it is looked up directly, before any searching.
 *
 * Two outcomes:
 * - `direct`: the reader asked about the repo ("ollama", "qdrant vs milvus").
 *   It is shown first, verbatim from the catalogue.
 * - `alternativesTo`: the reader wants something *like* it ("supabase
 *   alternative"). Its own embedding becomes the search vector, and it is
 *   excluded from the results, since it is the one thing they did not ask for.
 *
 * Every match is an index into the corpus, so nothing here can invent a repo.
 */

export type NamedRepos = {
  direct: string[]
  alternativesTo: string[]
  /** The message is nothing but the name(s): "ollama", "is qdrant good". */
  onlyNames?: boolean
}

/** Compact form: "Next-Auth", "next auth" and "nextauth" all become "nextauth". */
function compact(text: string): string {
  return text.toLowerCase().replace(/[^a-z0-9]/g, "")
}

/**
 * Words that are vocabulary, not names. A repo literally called "docs",
 * "chat" or "analytics" must not be pinned whenever someone uses the word.
 */
function genericWords(): Set<string> {
  const out = new Set<string>()
  const add = (text: string) => {
    for (const word of text.toLowerCase().split(/[^a-z0-9]+/)) if (word) out.add(compact(word))
  }
  // Labels and query prose only. The keyword lists are deliberately left out:
  // they name products ("ollama", "supabase"), which are exactly the names
  // this module exists to catch.
  for (const need of NEEDS) {
    add(need.label)
    add(need.query)
  }
  for (const meta of Object.values(CATEGORY_META)) add(meta.label)
  // Constraint phrases, which `detectConstraints` already owns.
  for (const phrase of CONSTRAINT_PHRASES) out.add(phrase)
  return out
}

const CONSTRAINT_PHRASES = [
  "selfhosted", "selfhost", "selfhosting", "onprem", "onpremise", "opensource", "nocode",
  "lowcode", "beginnerfriendly", "free", "alternative", "alternatives",
]

type NameIndex = {
  /** compact name -> repo id, only for names that are safe to match bare. */
  byName: Map<string, string>
  /** "owner/name" lowercased -> repo id. Always safe: nobody types that by accident. */
  byFullName: Map<string, string>
}

/** A word in at least this many other repos counts as vocabulary, not a name. */
const COMMON_WORD_DOCS = 5

let nameIndex: NameIndex | null = null

function loadNames(): NameIndex {
  if (nameIndex) return nameIndex
  const { docs } = loadCorpus()
  const generic = genericWords()

  const counts = new Map<string, number>()
  for (const doc of docs) {
    const key = compact(doc.name)
    counts.set(key, (counts.get(key) ?? 0) + 1)
  }

  // For every word used in other repos' descriptions and topics: how many use
  // it, and the most stars among them. This separates a product name from an
  // English word that a repo happens to be called. Plenty of repos mention
  // "ollama", and ollama is the biggest of them; plenty mention "audio", and
  // the repo named "audio" is not.
  const usage = new Map<string, { count: number; topStars: number }>()
  for (const doc of docs) {
    const words = new Set(
      `${doc.description} ${doc.tags.join(" ")}`.toLowerCase().split(/[^a-z0-9]+/).map(compact)
    )
    for (const word of words) {
      if (!word) continue
      const entry = usage.get(word) ?? { count: 0, topStars: 0 }
      entry.count += 1
      entry.topStars = Math.max(entry.topStars, doc.stars ?? 0)
      usage.set(word, entry)
    }
  }

  const byName = new Map<string, string>()
  const byFullName = new Map<string, string>()
  for (const doc of docs) {
    byFullName.set(`${doc.owner}/${doc.name}`.toLowerCase(), doc.id)
    const key = compact(doc.name)
    if (key.length < 3 || /^\d+$/.test(key)) continue
    // Ambiguous: several repos share the name, so naming it picks none of them.
    if ((counts.get(key) ?? 0) > 1) continue
    if (generic.has(key) || isStopword(key)) continue
    const used = usage.get(key)
    if (used && used.count >= COMMON_WORD_DOCS && (doc.stars ?? 0) < used.topStars) continue
    byName.set(key, doc.id)
  }

  nameIndex = { byName, byFullName }
  return nameIndex
}

const ALT_BEFORE =
  /(alternatives? (to|for)|instead of|similar to|replacement (to|for)|replace|like|such as|clone of)$/
const ALT_AFTER = /^(alternatives?|clone|replacement|but)\b/
const VS_BEFORE = /(^| )(vs|versus|or|and)$/
const VS_AFTER = /^(vs|versus)\b/

/**
 * Other content words that do not change what is being asked about.
 * "is ollama good", "ollama review", "ollama repo" are all still about ollama.
 */
const INQUIRY = new Set([
  "about", "compare", "comparison", "difference", "explain", "github", "repo", "repository",
  "review", "worth", "pros", "cons", "vs", "versus", "alternative", "alternatives", "clone",
  "replacement", "instead",
])

export function detectNamedRepos(message: string): NamedRepos {
  const { byName, byFullName } = loadNames()
  const lower = message.toLowerCase()
  const direct: string[] = []
  const alternativesTo: string[] = []
  const add = (list: string[], id: string) => {
    if (!direct.includes(id) && !alternativesTo.includes(id)) list.push(id)
  }

  // owner/name is unambiguous wherever it appears.
  for (const match of lower.matchAll(/([a-z0-9][a-z0-9-]*)\/([a-z0-9][a-z0-9._-]*)/g)) {
    const id = byFullName.get(`${match[1]}/${match[2].replace(/\.+$/, "")}`)
    if (id) add(direct, id)
  }

  const tokens = [...lower.matchAll(/[a-z0-9][a-z0-9._+#-]*/g)].map((m) => m[0].replace(/\.+$/, ""))
  const matches: { id: string; start: number; end: number }[] = []
  for (let i = 0; i < tokens.length; i += 1) {
    // Longest window first, so "better auth" wins over a repo called "better".
    for (let length = Math.min(3, tokens.length - i); length >= 1; length -= 1) {
      const id = byName.get(compact(tokens.slice(i, i + length).join("")))
      if (!id) continue
      matches.push({ id, start: i, end: i + length })
      i += length - 1
      break
    }
  }
  if (matches.length === 0) return { direct, alternativesTo }

  // Words left once the names themselves are removed. When nothing (or only
  // inquiry words) remains, the message *is* the name.
  const nameWords = new Set(
    matches.flatMap((m) => tokens.slice(m.start, m.end).flatMap((t) => t.split(/[-.]+/)))
  )
  const rest = contentWords(message)
    .flatMap((word) => word.split(/[-.]+/))
    .filter((word) => word && !nameWords.has(word) && !INQUIRY.has(word))
  const aboutTheName = rest.length === 0
  const comparing = /\b(compare|comparison|difference between)\b/.test(lower)

  for (const match of matches) {
    const before = tokens.slice(Math.max(0, match.start - 3), match.start).join(" ")
    const after = tokens.slice(match.end, match.end + 3).join(" ")

    if (ALT_BEFORE.test(before) || ALT_AFTER.test(after)) add(alternativesTo, match.id)
    else if (aboutTheName || comparing || VS_BEFORE.test(before) || VS_AFTER.test(after)) {
      // "or"/"and" only count between two names, or "auth and redis caching"
      // would pin redis.
      if (/(^| )(or|and)$/.test(before) && !matches.some((other) => other.end === match.start - 1)) {
        if (!aboutTheName && !comparing) continue
      }
      add(direct, match.id)
    }
  }

  return {
    direct: direct.slice(0, 3),
    alternativesTo: alternativesTo.slice(0, 2),
    ...(aboutTheName ? { onlyNames: true } : {}),
  }
}
