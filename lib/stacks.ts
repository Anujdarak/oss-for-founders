import { z } from "zod"

import stacksData from "@/data/stacks.json"

import { getRepoByOwnerName } from "./data"
import type { Repo } from "./schema"

/**
 * Curated stacks: editorial groupings of repos that are already in the
 * catalogue. The `repo` field is an `owner/name` reference rather than a copy,
 * so a stack can never drift from the entry it points at — and the validator
 * fails the build if it points at something that does not exist.
 */
export const stackSchema = z.strictObject({
  slug: z.string().regex(/^[a-z0-9][a-z0-9-]*$/),
  title: z.string().trim().min(1),
  summary: z.string().trim().min(1).max(400),
  items: z
    .array(
      z.strictObject({
        /** `owner/name`, exactly as the catalogue records it. */
        repo: z.string().regex(/^[^/\s]+\/[^/\s]+$/),
        role: z.string().trim().min(1),
        note: z.string().trim().min(1).max(400),
      })
    )
    .min(2),
})

export const stacksSchema = z.array(stackSchema)

export type Stack = z.infer<typeof stackSchema>

export const stacks = stacksData as Stack[]

export function getStack(slug: string): Stack | undefined {
  return stacks.find((stack) => stack.slug === slug)
}

export type ResolvedStackItem = {
  role: string
  note: string
  reference: string
  repo: Repo | undefined
}

/**
 * Resolves each reference against the catalogue. A missing repo comes back as
 * `undefined` rather than being dropped, so the page can say a stack entry is
 * unavailable instead of quietly rendering a shorter list.
 */
export function resolveStack(stack: Stack): ResolvedStackItem[] {
  return stack.items.map((item) => {
    const [owner, name] = item.repo.split("/")
    return {
      role: item.role,
      note: item.note,
      reference: item.repo,
      repo: getRepoByOwnerName(owner, name),
    }
  })
}
