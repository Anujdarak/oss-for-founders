import type { Metadata } from "next"
import Link from "next/link"
import { ExternalLinkIcon } from "lucide-react"

import { Button } from "@/components/ui/button"
import { CATEGORIES, CATEGORY_META } from "@/lib/categories"
import { SITE } from "@/lib/site"

export const metadata: Metadata = {
  title: "Submit a repo",
  description: "Suggest an open-source tool for the catalogue by opening an issue.",
}

/**
 * The submission form is a GitHub issue, prefilled. There is no backend to post
 * to, and an issue is a better home for a suggestion anyway: it is public,
 * someone can discuss it, and it cannot be lost.
 */
function newIssueUrl(): string {
  const body = [
    "**Repository**",
    "",
    "https://github.com/<owner>/<name>",
    "",
    "**Which category?**",
    "",
    `One of: ${CATEGORIES.join(", ")}`,
    "",
    "**What problem does it solve for a founder?**",
    "",
    "",
    "**Can it be self-hosted? Roughly how hard is setup?**",
    "",
    "",
    "**Anything a reviewer should know** (licence quirks, maintenance concerns)",
    "",
    "",
    "---",
    "",
    "Please check before submitting:",
    "",
    "- [ ] It has an open-source licence GitHub can identify",
    "- [ ] It has been pushed to in the last year",
    "- [ ] It is a tool someone can run, not a list, course, template, or SDK",
  ].join("\n")

  const params = new URLSearchParams({
    title: "Suggest a repo: ",
    body,
    labels: "suggestion",
  })

  return `https://github.com/${SITE.repo}/issues/new?${params.toString()}`
}

export default function SubmitPage() {
  return (
    <div className="mx-auto w-full max-w-3xl space-y-8 px-4 py-12">
      <div className="space-y-3">
        <h1 className="text-2xl font-semibold tracking-tight">Submit a repo</h1>
        <p className="max-w-prose text-sm text-muted-foreground">
          Suggestions go to the issue tracker, prefilled with the questions a
          reviewer will ask. There is no form on this site because there is no
          backend behind it — and an issue is public, discussable, and harder to
          lose.
        </p>
      </div>

      <Button asChild>
        <a href={newIssueUrl()} target="_blank" rel="noreferrer">
          Open a prefilled issue
          <ExternalLinkIcon />
        </a>
      </Button>

      <section className="space-y-3">
        <h2 className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
          What gets accepted
        </h2>
        <ul className="max-w-prose space-y-1.5 text-sm text-muted-foreground">
          {[
            "A tool a founder can actually run, self-hosted or embedded in their own product.",
            "An open-source licence GitHub can resolve to a standard SPDX id.",
            "Active enough to have been pushed to within the last year.",
            "A description written by its own maintainers — this catalogue quotes those verbatim and never rewrites them.",
          ].map((line) => (
            <li key={line} className="flex gap-2">
              <span aria-hidden className="text-border">
                —
              </span>
              {line}
            </li>
          ))}
        </ul>
      </section>

      <section className="space-y-3">
        <h2 className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
          What does not
        </h2>
        <ul className="max-w-prose space-y-1.5 text-sm text-muted-foreground">
          {[
            "Awesome-lists, curated link collections, courses, and interview prep.",
            "Boilerplates, starter templates, and example apps with no function of their own.",
            "Language SDKs and API wrappers for a third-party service.",
            "Payments and billing: there is deliberately no category for it, because self-hosting payment processing means inheriting PCI scope.",
          ].map((line) => (
            <li key={line} className="flex gap-2">
              <span aria-hidden className="text-border">
                —
              </span>
              {line}
            </li>
          ))}
        </ul>
      </section>

      <section className="space-y-3">
        <h2 className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
          Categories
        </h2>
        <div className="flex flex-wrap gap-x-4 gap-y-1.5 text-sm">
          {CATEGORIES.map((category) => (
            <Link
              key={category}
              href={`/c/${category}`}
              className="text-muted-foreground transition-colors hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
            >
              {CATEGORY_META[category].label}
            </Link>
          ))}
        </div>
      </section>
    </div>
  )
}
