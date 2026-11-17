import { readFileSync } from "node:fs"
import path from "node:path"

import { getAllRepos } from "../data"
import { toSearchDoc, type SearchDoc } from "../search"
import { buildBm25, bm25Search, type Bm25Index } from "./bm25"
import { EMBEDDING_DIMS, type EmbeddingFile } from "./embedding-format"
import { getNeed } from "./needs"
import type { Plan, PlanNeed } from "./plan"

/**
 * Server-side retrieval. Never imported by a client component — it reads from
 * disk and holds the whole catalogue in memory.
 *
 * Two signals, blended:
 * - cosine similarity against the MiniLM embedding of the *need*, which is
 *   what makes "improve my ui ux" reach component libraries;
 * - BM25 over name/topics/category/description, which is what makes "oauth2"
 *   reach the repo actually tagged oauth2.
 *
 * Neither alone is good enough. Embeddings alone drift toward whatever is
 * vaguely on-topic and rank a popular adjacent repo above an exact match;
 * BM25 alone is the word-matching behaviour this whole change exists to fix.
 */

const EMBEDDINGS_PATH = path.join(process.cwd(), "data", "embeddings.json")

export type Candidate = {
  doc: SearchDoc
  /** Need key this candidate was retrieved for. */
  needKey: string
  score: number
  cosine: number
  lexical: number
}

type Corpus = {
  docs: SearchDoc[]
  byId: Map<string, number>
  bm25: Bm25Index
  vectors: Int8Array | null
  needVectors: Map<string, Int8Array>
  dims: number
}

let corpus: Corpus | null = null

function decode(base64: string): Int8Array {
  const buffer = Buffer.from(base64, "base64")
  return new Int8Array(buffer.buffer, buffer.byteOffset, buffer.byteLength)
}

export function loadCorpus(): Corpus {
  if (corpus) return corpus

  const docs = getAllRepos().map(toSearchDoc)
  const byId = new Map(docs.map((doc, index) => [doc.id, index]))

  let vectors: Int8Array | null = null
  const needVectors = new Map<string, Int8Array>()
  let dims = EMBEDDING_DIMS

  try {
    const file = JSON.parse(readFileSync(EMBEDDINGS_PATH, "utf8")) as EmbeddingFile
    dims = file.dims

    // The embedding file is keyed by repo id, and the catalogue can change
    // under it between builds. Rather than trust index alignment, re-map by
    // id and drop the file entirely if it no longer covers the corpus.
    const raw = decode(file.vectors)
    const aligned = new Int8Array(docs.length * dims)
    let matched = 0
    for (let i = 0; i < file.ids.length; i += 1) {
      const target = byId.get(file.ids[i])
      if (target === undefined) continue
      aligned.set(raw.subarray(i * dims, (i + 1) * dims), target * dims)
      matched += 1
    }
    if (matched / docs.length > 0.9) vectors = aligned
    else {
      console.warn(
        `[assistant] embeddings cover ${matched}/${docs.length} repos; ` +
          "semantic retrieval is off until `npm run build:embeddings` is rerun"
      )
    }

    if (file.needVectors && file.needKeys) {
      const rawNeeds = decode(file.needVectors)
      file.needKeys.forEach((key, i) => {
        needVectors.set(key, rawNeeds.subarray(i * dims, (i + 1) * dims))
      })
    }
  } catch (error) {
    // No embeddings file (or an unreadable one): retrieval runs on BM25 alone.
    // Worse, but not broken, and `npm run build:embeddings` fixes it. Logged,
    // because a silent fallback here hides a 62% hole in the ranking.
    console.warn(
      "[assistant] embeddings unavailable, retrieval is lexical only: " +
        (error instanceof Error ? error.message : String(error))
    )
  }

  corpus = { docs, byId, bm25: buildBm25(docs), vectors, needVectors, dims }
  return corpus
}

/** Cosine against a quantised stored vector. Both sides are unit length. */
function cosineAll(corpusRef: Corpus, query: Int8Array): Float32Array {
  const { vectors, dims, docs } = corpusRef
  const out = new Float32Array(docs.length)
  if (!vectors) return out

  for (let i = 0; i < docs.length; i += 1) {
    let dot = 0
    const base = i * dims
    for (let d = 0; d < dims; d += 1) dot += vectors[base + d] * query[d]
    // Both were scaled by 127 on the way in.
    out[i] = dot / (127 * 127)
  }
  return out
}

/** Min-max to [0,1] so cosine and BM25 can be blended on one scale. */
function normalise(values: Map<number, number>): Map<number, number> {
  let max = 0
  for (const value of values.values()) if (value > max) max = value
  if (max <= 0) return new Map()
  const out = new Map<number, number>()
  for (const [key, value] of values) out.set(key, value / max)
  return out
}

export const BLEND = {
  /** Weight on embedding similarity. */
  semantic: 0.62,
  /** Weight on BM25. */
  lexical: 0.38,
  /** Weight on BM25 over the reader's own specific words, when there are any. */
  focus: 0.3,
  /** Bonus when the repo sits in a category the need expects. */
  categoryBonus: 0.22,
  /** Bonus for an editor-reviewed entry, per the spec's ranking requirement. */
  reviewedBonus: 0.06,
  /** Maximum contribution from popularity. */
  popularity: 0.07,
} as const

/** Log-scaled, capped. Popularity breaks ties; it must never create one. */
function popularityFactor(stars?: number): number {
  if (!stars || stars <= 0) return 0
  return Math.min(1, Math.log10(stars) / 5)
}

const PER_NEED = 14

/** Stored vector for one repo, or null when embeddings are off. */
export function repoVector(id: string): Int8Array | null {
  const corpusRef = loadCorpus()
  const index = corpusRef.byId.get(id)
  if (index === undefined || !corpusRef.vectors) return null
  const { dims } = corpusRef
  return corpusRef.vectors.subarray(index * dims, (index + 1) * dims)
}

/**
 * Weighted mean of several int8 vectors, renormalised and requantised to the
 * same int8 scale the stored vectors use, so `cosineAll` can take it as is.
 */
function combine(parts: { vector: Int8Array; weight: number }[], dims: number): Int8Array | null {
  if (parts.length === 0) return null
  const sum = new Float64Array(dims)
  for (const { vector, weight } of parts) {
    for (let d = 0; d < dims; d += 1) sum[d] += (vector[d] / 127) * weight
  }
  let length = 0
  for (let d = 0; d < dims; d += 1) length += sum[d] * sum[d]
  length = Math.sqrt(length)
  if (length === 0) return null
  const out = new Int8Array(dims)
  for (let d = 0; d < dims; d += 1) {
    out[d] = Math.max(-127, Math.min(127, Math.round((sum[d] / length) * 127)))
  }
  return out
}

const FEEDBACK_DOCS = 8
const FEEDBACK_FLOOR = 0.5

/**
 * Pseudo-relevance feedback: the centroid of the strongest lexical hits.
 *
 * There is no model at request time — transformers.js is build tooling — so a
 * free-text need cannot be embedded directly. But the repos BM25 is most sure
 * about *are* embedded, and their centroid points at what the need means
 * rather than which words it used. Cosine against that centroid is what
 * reaches "SMTP API" from "transactional email".
 */
function feedbackVector(corpusRef: Corpus, lexical: Map<number, number>): Int8Array | null {
  const { vectors, dims } = corpusRef
  if (!vectors) return null
  const top = [...lexical.entries()]
    .filter(([, score]) => score >= FEEDBACK_FLOOR)
    .sort((a, b) => b[1] - a[1])
    .slice(0, FEEDBACK_DOCS)
  return combine(
    top.map(([index, score]) => ({
      vector: vectors.subarray(index * dims, (index + 1) * dims),
      weight: score,
    })),
    dims
  )
}

/**
 * Retrieve candidates for one need.
 *
 * `queryVector` is the need's prebuilt embedding when the need comes from the
 * taxonomy, or a freshly embedded phrase when the LLM invented one.
 */
export function retrieveForNeed(
  need: PlanNeed,
  queryVector: Int8Array | null,
  limit = PER_NEED
): Candidate[] {
  const corpusRef = loadCorpus()
  const specKey = getNeed(need.key) ? need.key : need.basis
  const spec = specKey ? getNeed(specKey) : undefined

  // BM25 over the need's keywords plus its phrasing. Keywords carry the exact
  // topic tokens; the phrase catches descriptions written in prose.
  const lexicalQuery = [spec?.keywords.join(" ") ?? "", need.query].join(" ")
  const lexical = normalise(bm25Search(corpusRef.bm25, lexicalQuery))
  const focus = need.focus ? normalise(bm25Search(corpusRef.bm25, need.focus)) : new Map<number, number>()

  // Feedback is taken over both lexical signals, so the centroid leans
  // toward the reader's specifics rather than the generic need.
  const combinedLexical = new Map(lexical)
  for (const [index, value] of focus) {
    combinedLexical.set(index, (combinedLexical.get(index) ?? 0) + value)
  }

  // The query vector: whichever of these exist, averaged. A repo's own
  // embedding (for "alternatives to X"), the taxonomy need's vector, and the
  // lexical feedback centroid. Averaging keeps a specific phrase like "auth
  // for nextjs" from being flattened into the generic "authentication" need,
  // and keeps a repo whose README reads as marketing ("self-driving
  // products") from dragging its alternatives toward whatever it mentions.
  const fromRepo = need.vectorFromRepo ? repoVector(need.vectorFromRepo) : null
  const taxonomy = specKey ? corpusRef.needVectors.get(specKey) ?? null : null
  const feedback = feedbackVector(corpusRef, normalise(combinedLexical))
  const vector =
    queryVector ??
    combine(
      [
        ...(fromRepo ? [{ vector: fromRepo, weight: 1 }] : []),
        ...(taxonomy ? [{ vector: taxonomy, weight: 1 }] : []),
        ...(feedback ? [{ vector: feedback, weight: 1 }] : []),
      ],
      corpusRef.dims
    )
  const cosines = vector ? cosineAll(corpusRef, vector) : null
  const excluded = new Set(need.exclude ?? [])

  const expected = new Set(need.categories ?? spec?.categories ?? [])

  // Only score documents that either rank lexically or clear a cosine floor,
  // so one need does not walk all 4,906 rows twice.
  const considered = new Set<number>([...lexical.keys(), ...focus.keys()])
  if (cosines) {
    // Keep the strongest semantic matches even when they share no vocabulary
    // with the query — that is the entire point of the embedding half.
    const indices = Array.from({ length: cosines.length }, (_, i) => i)
    indices.sort((a, b) => cosines[b] - cosines[a])
    for (const index of indices.slice(0, 120)) considered.add(index)
  }

  const scored: Candidate[] = []
  for (const index of considered) {
    const doc = corpusRef.docs[index]
    if (excluded.has(doc.id)) continue
    const cosine = cosines ? Math.max(0, cosines[index]) : 0
    const lex = lexical.get(index) ?? 0

    let score = BLEND.semantic * cosine + BLEND.lexical * lex + BLEND.focus * (focus.get(index) ?? 0)
    if (expected.has(doc.category)) score += BLEND.categoryBonus
    else if (doc.secondaryCategory && expected.has(doc.secondaryCategory)) {
      score += BLEND.categoryBonus * 0.5
    }
    if (doc.reviewed) score += BLEND.reviewedBonus
    score += BLEND.popularity * popularityFactor(doc.stars)

    scored.push({ doc, needKey: need.key, score, cosine, lexical: lex })
  }

  scored.sort((a, b) => b.score - a.score)
  return scored.slice(0, limit)
}

export type RetrievalResult = {
  /** Per need, best first. */
  byNeed: Map<string, Candidate[]>
  /** Flattened, deduplicated, capped — what the reranker is shown. */
  candidates: Candidate[]
}

const MAX_CANDIDATES = 40

/** Applies the plan's constraints as filters, then retrieves per need. */
export function retrieve(
  plan: Plan,
  queryVectors: Map<string, Int8Array> = new Map()
): RetrievalResult {
  const byNeed = new Map<string, Candidate[]>()
  const seen = new Set<string>()
  const flat: Candidate[] = []

  for (const need of plan.needs) {
    let hits = retrieveForNeed(need, queryVectors.get(need.key) ?? null)

    if (plan.constraints.selfHosted) {
      const filtered = hits.filter((hit) => hit.doc.selfHostable)
      if (filtered.length >= 2) hits = filtered
    }
    if (plan.constraints.language) {
      const filtered = hits.filter((hit) => hit.doc.language === plan.constraints.language)
      if (filtered.length >= 2) hits = filtered
    }
    if (plan.constraints.beginnerFriendly) {
      const filtered = hits.filter((hit) => hit.doc.difficulty !== "advanced")
      if (filtered.length >= 2) hits = filtered
    }

    byNeed.set(need.key, hits)

    for (const hit of hits) {
      if (seen.has(hit.doc.id)) continue
      seen.add(hit.doc.id)
      flat.push(hit)
    }
  }

  /**
   * Round-robin across needs, so the candidate list is not dominated by
   * whichever need retrieved most confidently — except on the first pass,
   * where the primary need takes two slots instead of one.
   *
   * That exception is load-bearing. The planner lists needs best-first, and a
   * strict round robin put one result from each need in the top three, so a
   * three-need question showed its *best* answer once and two speculative
   * ones beside it. "background jobs and scheduled tasks" resolved to queue,
   * project management and scheduling, and surfaced a kanban board second.
   */
  const interleaved: Candidate[] = []
  const queues = plan.needs.map((need) => [...(byNeed.get(need.key) ?? [])])
  const taken = new Set<string>()

  if (queues.length > 1) {
    for (const candidate of (queues[0] ?? []).splice(0, 2)) {
      if (taken.has(candidate.doc.id)) continue
      taken.add(candidate.doc.id)
      interleaved.push(candidate)
    }
  }

  let drained = false
  while (!drained && interleaved.length < MAX_CANDIDATES) {
    drained = true
    for (const queue of queues) {
      const next = queue.shift()
      if (!next) continue
      drained = false
      if (taken.has(next.doc.id)) continue
      taken.add(next.doc.id)
      interleaved.push(next)
      if (interleaved.length >= MAX_CANDIDATES) break
    }
  }

  return { byNeed, candidates: interleaved }
}
