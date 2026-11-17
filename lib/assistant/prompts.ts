/**
 * The two small pieces the client genuinely needs.
 *
 * Split out of `lib/assistant/index.ts` when retrieval moved server-side. The
 * index module pulls in Fuse.js and the whole keyword engine; importing it
 * from the chat panel for two constants shipped that entire engine to the
 * browser for code that no longer runs there.
 */
export const SUGGESTED_PROMPTS = [
  "Open-source alternative to Intercom",
  "Auth for a SaaS",
  "Self-hosted analytics",
  "I want to improve my UI/UX",
  "Users keep leaving my site",
] as const

/** A prefilled GitHub issue for a repo the catalogue is missing. */
export function suggestRepoUrl(repoSlug: string, query: string): string {
  const title = `Suggest a repo: ${query}`.slice(0, 120)
  const body = [
    `Someone searched for **${query}** and found nothing in the catalogue.`,
    "",
    "- Repository: <owner/name>",
    "- Why it belongs here: ",
  ].join("\n")

  return (
    `https://github.com/${repoSlug}/issues/new` +
    `?title=${encodeURIComponent(title)}&body=${encodeURIComponent(body)}`
  )
}
