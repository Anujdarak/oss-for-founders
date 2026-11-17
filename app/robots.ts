import type { MetadataRoute } from "next"

import { SITE } from "@/lib/site"

export default function robots(): MetadataRoute.Robots {
  const base = SITE.url.replace(/\/$/, "")

  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        // Per-person and query-only pages. Nothing secret, just nothing worth
        // a crawl budget: /saved is empty without someone's local storage and
        // /compare is infinite query permutations of pages already indexed.
        disallow: ["/saved", "/compare"],
      },
    ],
    sitemap: `${base}/sitemap.xml`,
    host: base,
  }
}
