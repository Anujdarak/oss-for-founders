import type { MetadataRoute } from "next"

import { CATEGORIES } from "@/lib/categories"
import { getAllRepos } from "@/lib/data"
import { repoHref } from "@/lib/links"
import { SITE } from "@/lib/site"
import { stacks } from "@/lib/stacks"

/**
 * Every indexable URL, including one per repo.
 *
 * `lastModified` comes from each entry's own `stats.pushedAt` rather than the
 * build clock: a clock read here would be a build error under Cache Components,
 * and "everything changed at deploy time" is not information a crawler can use.
 *
 * /saved and /compare are left out on purpose — their content is per-person or
 * entirely query-driven, so there is nothing stable to index.
 */
export default function sitemap(): MetadataRoute.Sitemap {
  const base = SITE.url.replace(/\/$/, "")

  const staticPages: MetadataRoute.Sitemap = [
    { url: `${base}/`, changeFrequency: "weekly", priority: 1 },
    { url: `${base}/explore`, changeFrequency: "weekly", priority: 0.9 },
    { url: `${base}/gems`, changeFrequency: "weekly", priority: 0.8 },
    { url: `${base}/stacks`, changeFrequency: "monthly", priority: 0.7 },
    { url: `${base}/ask`, changeFrequency: "monthly", priority: 0.6 },
    { url: `${base}/submit`, changeFrequency: "yearly", priority: 0.3 },
  ]

  const categoryPages: MetadataRoute.Sitemap = CATEGORIES.map((category) => ({
    url: `${base}/c/${category}`,
    changeFrequency: "weekly",
    priority: 0.8,
  }))

  const stackPages: MetadataRoute.Sitemap = stacks.map((stack) => ({
    url: `${base}/stacks/${stack.slug}`,
    changeFrequency: "monthly",
    priority: 0.6,
  }))

  const repoPages: MetadataRoute.Sitemap = getAllRepos().map((repo) => ({
    url: `${base}${repoHref(repo)}`,
    ...(repo.stats?.pushedAt
      ? { lastModified: new Date(repo.stats.pushedAt) }
      : {}),
    changeFrequency: "monthly",
    // Reviewed entries carry something a crawler cannot get from GitHub.
    priority: repo.reviewed ? 0.7 : 0.5,
  }))

  return [...staticPages, ...categoryPages, ...stackPages, ...repoPages]
}
