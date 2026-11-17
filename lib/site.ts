// Placeholder wordmark. Change it here and every surface follows.
export const SITE = {
  name: "OSS for Founders",
  description:
    "A filterable list of open-source tools startup founders can actually run. Free, no login, no paywall.",
  /**
   * owner/name of this project's own repository. Used for the prefilled
   * "suggest a repo" issue links. Update it when the repo is published --
   * `npm run validate` cannot check this one for you.
   */
  repo: "anuj/oss-for-founders",
  /**
   * Absolute base URL, used for sitemap, robots, and canonical metadata.
   *
   * Blank counts as unset. `??` alone was wrong here: a declared-but-empty
   * `NEXT_PUBLIC_SITE_URL=` is a very ordinary deploy state, and it is not
   * null or undefined, so it passed straight through as `""`. That turned
   * every absolute URL relative — `Sitemap: /sitemap.xml` in robots.txt and
   * `<link rel="canonical" href="/r/owner/name">` on every detail page, both
   * of which are invalid and both of which Lighthouse failed.
   */
  url: process.env.NEXT_PUBLIC_SITE_URL?.trim() || "http://localhost:3000",
} as const
