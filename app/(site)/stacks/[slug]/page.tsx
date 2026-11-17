import type { Metadata } from "next"
import Link from "next/link"
import { notFound } from "next/navigation"
import { ExternalLinkIcon, LayersIcon } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { BookmarkButton } from "@/components/bookmark-button"
import { CopyLink } from "@/components/copy-link"
import { RepoStatsRow } from "@/components/repo-stats"
import { StatsDisclaimer } from "@/components/stats-disclaimer"
import { CATEGORY_META } from "@/lib/categories"
import { getStatsUpdatedAt } from "@/lib/data"
import { reviewLabel } from "@/lib/format"
import { repoHref } from "@/lib/links"
import { SITE } from "@/lib/site"
import { getStack, resolveStack, stacks } from "@/lib/stacks"

type StackParams = { slug: string }

export function generateStaticParams(): StackParams[] {
  return stacks.map((stack) => ({ slug: stack.slug }))
}

export async function generateMetadata({
  params,
}: {
  params: Promise<StackParams>
}): Promise<Metadata> {
  "use cache"
  const { slug } = await params
  const stack = getStack(slug)
  if (!stack) return {}

  const url = `${SITE.url}/stacks/${stack.slug}`
  return {
    title: stack.title,
    description: stack.summary,
    alternates: { canonical: url },
    openGraph: {
      type: "article",
      url,
      title: `${stack.title} · ${SITE.name}`,
      description: stack.summary,
      siteName: SITE.name,
    },
  }
}

export default async function StackPage({
  params,
}: {
  params: Promise<StackParams>
}) {
  const { slug } = await params
  const stack = getStack(slug)
  if (!stack) notFound()

  const items = resolveStack(stack)
  const compareIds = items
    .map((item) => item.repo?.id)
    .filter((id): id is string => Boolean(id))
    .slice(0, 3)

  return (
    <div className="mx-auto w-full max-w-3xl space-y-8 px-4 py-12">
      <header className="space-y-3">
        <Link
          href="/stacks"
          className="inline-flex items-center gap-2 text-xs font-medium tracking-wide text-muted-foreground uppercase transition-colors hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
        >
          <LayersIcon className="size-4" />
          Stacks
        </Link>
        <h1 className="text-2xl font-semibold tracking-tight">{stack.title}</h1>
        <p className="max-w-prose text-sm text-muted-foreground">{stack.summary}</p>
        <div className="flex flex-wrap items-center gap-2 pt-1">
          <CopyLink label="Copy link to this stack" />
          {compareIds.length > 1 ? (
            <Button variant="outline" size="sm" asChild>
              <Link href={`/compare?ids=${compareIds.join(",")}`}>
                Compare the first {compareIds.length}
              </Link>
            </Button>
          ) : null}
        </div>
      </header>

      <ol className="space-y-6">
        {items.map((item, index) => (
          <li
            key={item.reference}
            className="space-y-2 border-t border-border pt-5 first:border-t-0 first:pt-0"
          >
            <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
              <span className="font-mono text-xs text-muted-foreground">
                {String(index + 1).padStart(2, "0")}
              </span>
              <span className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
                {item.role}
              </span>
            </div>

            {item.repo ? (
              <>
                <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
                  <Link
                    href={repoHref(item.repo)}
                    className="font-mono text-sm break-all transition-colors hover:text-muted-foreground focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
                  >
                    {item.repo.owner}/{item.repo.name}
                  </Link>
                  {item.repo.reviewed ? (
                    <Badge>{reviewLabel(item.repo)}</Badge>
                  ) : null}
                  <span className="text-xs text-muted-foreground">
                    {CATEGORY_META[item.repo.category].label}
                  </span>
                </div>

                <p className="max-w-prose text-sm">{item.note}</p>

                <p className="max-w-prose text-sm text-muted-foreground">
                  {item.repo.description}
                </p>

                <RepoStatsRow stats={item.repo.stats} />

                <div className="flex flex-wrap items-center gap-2 pt-1">
                  <BookmarkButton id={item.repo.id} label />
                  <Link
                    href={repoHref(item.repo)}
                    className="rounded-sm border border-border px-2 py-1 text-xs text-muted-foreground transition-colors hover:border-foreground/30 hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
                  >
                    Details
                  </Link>
                  <a
                    href={item.repo.url}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 rounded-sm border border-border px-2 py-1 text-xs text-muted-foreground transition-colors hover:border-foreground/30 hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
                  >
                    GitHub
                    <ExternalLinkIcon className="size-3" />
                  </a>
                </div>
              </>
            ) : (
              /* A reference the catalogue no longer has. Said out loud rather
                 than silently shortening the stack. */
              <p className="max-w-prose text-sm text-muted-foreground">
                <span className="font-mono">{item.reference}</span> is referenced
                by this stack but is not in the catalogue right now.
              </p>
            )}
          </li>
        ))}
      </ol>

      <StatsDisclaimer
        updatedAt={getStatsUpdatedAt()}
        className="max-w-prose border-t border-border pt-4"
      />
    </div>
  )
}
