import type { Category } from "../categories"
import type { SearchDoc } from "../search"

/**
 * The answer contract, in its own module with no server imports.
 *
 * The chat panel is a client component and needs these types. `pipeline.ts`
 * transitively imports `llm.ts`, which throws on sight of `window` — so even
 * though a type-only import is erased at compile time, keeping the shapes
 * here means a future edit that drops the `type` keyword cannot leak the
 * server module into the browser bundle.
 */

export type AnswerItem = {
  doc: SearchDoc
  why: string
}

export type AnswerGroup = {
  key: string
  label: string
  items: AnswerItem[]
  /** Set when nothing in the catalogue covers this need. */
  note?: string
}

export type FollowUp = { id: string; label: string; query: string }

export type Answer = {
  query: string
  summary: string
  groups: AnswerGroup[]
  followUps: FollowUp[]
  empty: boolean
  closestCategories: Category[]
  /** "local", "llm:gemini", "llm:groq+fallback". */
  engine: string
  clarifyingQuestion?: string
  clarifyOptions: string[]
}

/** What the plan event carries while the answer is still being assembled. */
export type PlanPreview = {
  goal: string
  needs: { key: string; label: string }[]
}

/** One line of the NDJSON stream from /api/ask. */
export type AskEvent =
  | { type: "status"; stage: "understanding" | "searching" }
  | ({ type: "plan" } & PlanPreview)
  | { type: "answer"; answer: Answer; cached: boolean }
  | { type: "error"; error: string }
