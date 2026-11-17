import { CATEGORY_META } from "../categories"
import { isStopword } from "./plan"
import { stem } from "./stem"
import type { SearchDoc } from "../search"

/**
 * BM25 over the fields that actually identify what a repo *is*.
 *
 * This is the lexical half of retrieval. Embeddings are good at "improve my
 * ui ux" meaning component libraries; they are noticeably worse at exact
 * tokens like `oauth2`, `wireguard` or `k8s`, where the right answer is the
 * repo literally tagged with that word. BM25 is excellent at those and
 * terrible at the former, which is why both run and the scores are blended.
 *
 * Fields are repeated rather than separately weighted — repeating a term in
 * the document is how you weight a field in a single-field BM25, and it keeps
 * the length normalisation honest.
 */
const K1 = 1.4
const B = 0.72

const FIELD_REPEATS = {
  name: 3,
  tags: 3,
  category: 2,
  description: 1,
} as const

export type Bm25Index = {
  /** term -> [docIndex, termFrequency][] */
  postings: Map<string, [number, number][]>
  lengths: Float64Array
  averageLength: number
  docCount: number
}

export function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9+#]+/g, " ")
    .split(" ")
    .filter((token) => token.length > 1 && !isStopword(token))
    .map(stem)
}

function docTokens(doc: SearchDoc): string[] {
  const out: string[] = []
  const add = (text: string, repeats: number) => {
    const tokens = tokenize(text)
    for (let i = 0; i < repeats; i += 1) out.push(...tokens)
  }

  // Split owner/name on separators too: "next-auth" should match "auth".
  add(`${doc.name} ${doc.owner}`, FIELD_REPEATS.name)
  add(doc.tags.join(" "), FIELD_REPEATS.tags)
  add(CATEGORY_META[doc.category].label, FIELD_REPEATS.category)
  if (doc.secondaryCategory) add(CATEGORY_META[doc.secondaryCategory].label, 1)
  add(doc.description, FIELD_REPEATS.description)
  return out
}

export function buildBm25(docs: SearchDoc[]): Bm25Index {
  const postings = new Map<string, [number, number][]>()
  const lengths = new Float64Array(docs.length)
  let total = 0

  for (let i = 0; i < docs.length; i += 1) {
    const tokens = docTokens(docs[i])
    lengths[i] = tokens.length
    total += tokens.length

    const counts = new Map<string, number>()
    for (const token of tokens) counts.set(token, (counts.get(token) ?? 0) + 1)
    for (const [term, count] of counts) {
      let list = postings.get(term)
      if (!list) {
        list = []
        postings.set(term, list)
      }
      list.push([i, count])
    }
  }

  return {
    postings,
    lengths,
    averageLength: docs.length > 0 ? total / docs.length : 0,
    docCount: docs.length,
  }
}

/**
 * Scores only the documents that contain at least one query term, which is
 * what keeps this fast over 4,900 docs without an inverted-index library.
 */
export function bm25Search(index: Bm25Index, query: string): Map<number, number> {
  const terms = tokenize(query)
  const scores = new Map<number, number>()
  if (terms.length === 0) return scores

  for (const term of terms) {
    const postings = index.postings.get(term)
    if (!postings) continue

    // Standard BM25 idf, floored at zero so a term in almost every document
    // can never push a score negative.
    const idf = Math.max(
      0,
      Math.log(1 + (index.docCount - postings.length + 0.5) / (postings.length + 0.5))
    )
    if (idf === 0) continue

    for (const [docIndex, frequency] of postings) {
      const norm = 1 - B + (B * index.lengths[docIndex]) / (index.averageLength || 1)
      const contribution = (idf * (frequency * (K1 + 1))) / (frequency + K1 * norm)
      scores.set(docIndex, (scores.get(docIndex) ?? 0) + contribution)
    }
  }

  return scores
}
