import { Suspense } from "react"
import type { Metadata } from "next"
import Link from "next/link"
import { ExternalLinkIcon, GemIcon } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { EmptyState } from "@/components/empty-state"
import { Pagination } from "@/components/pagination"
import { ScoreSummary } from "@/components/score-breakdown"
import { StatsDisclaimer } from "@/components/stats-disclaimer"
import { Tag } from "@/components/tag"
import { CATEGORY_META } from "@/lib/categories"
import { getHiddenGems, getStatsUpdatedAt, PER_PAGE } from "@/lib/data"
import type { RawSearchParams } from "@/lib/filters"
import { formatCount, formatMonthYear, maintenanceStatus } from "@/lib/format"
import { repoHref } from "@/lib/links"
import { HIDDEN_GEM_MIN_SCORE, HIDDEN_GEM_STARS } from "@/lib/scoring"
import type { Repo } from "@/lib/schema"
import { SITE } from "@/lib/site"

export const metadata: Metadata = {
  title: "Hidden gems",
  description:
    "Well-maintained open-source projects that sit well below the best-known option in their category, with the scoring shown.",
  openGraph: {
    title: `Hidden gems · ${SITE.name}`,
    description:
      "Well-maintained open-source projects that sit below the best-known option in their category.",
    url: `${SITE.url}/gems`,
    siteName: SITE.name,
  },
}

export default function GemsPage({
  searchParams,
}: {
  searchParams: Promise<RawSearchParams>
}) {
  const gems = getHiddenGems()

  // Reviewed entries are separated from unreviewed candidates, because the two
  // carry very different amounts of human judgment and should not be mixed.
  const reviewed = gems.filter((repo) => repo.reviewed)
  const candidates = gems.filter((repo) => !repo.reviewed)

  return (
    <div className="mx-auto w-full max-w-5xl space-y-8 px-4 py-12">
      <header className="space-y-3">
        <div className="flex items-center gap-2 text-muted-foreground">
          <GemIcon className="size-4" aria-hidden />
          <span className="text-xs font-medium tracking-wide uppercase">
            Hidden gems
          </span>
        </div>
        <h1 className="text-2xl font-semibold tracking-tight">
          Worth a look, rarely the first result
        </h1>
        <p className="max-w-prose text-sm text-muted-foreground">
          Projects that do a real job but sit well below the best-known option in
          their category.
        </p>
      </header>

      <section className="space-y-3 rounded-lg border border-border px-4 py-4">
        <h2 className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
          How this is decided
        </h2>
        <p className="max-w-prose text-sm text-muted-foreground">
          Two different routes land a repo here, and they are not the same claim.
          Each row says which one applied.
        </p>
        <dl className="max-w-prose space-y-2 text-sm text-muted-foreground">
          <div>
            <dt className="text-foreground">Met the thresholds</dt>
            <dd>
              Flagged mechanically by the discovery import: a score of at least{" "}
              <span className="font-mono">
                {HIDDEN_GEM_MIN_SCORE.toFixed(2)}
              </span>{" "}
              on maintenance, licence clarity, documentation, and
              self-description, and between{" "}
              <span className="font-mono">{HIDDEN_GEM_STARS.min}</span> and{" "}
              <span className="font-mono">
                {formatCount(HIDDEN_GEM_STARS.max)}
              </span>{" "}
              stars. The score is applied first and the star band last, so a
              low star count never qualifies anything on its own.
            </dd>
          </div>
          <div>
            <dt className="text-foreground">Editorial pick</dt>
            <dd>
              A judgment call, and{" "}
              <span className="text-foreground">the star band does not apply</span>
              . These sit below the best-known option in their own category
              rather than being small in absolute terms — Dokku has tens of
              thousands of stars, and still almost nobody reaches for it before
              Heroku or Vercel. Relative obscurity, not absolute.
            </dd>
          </div>
        </dl>
        <p className="max-w-prose text-sm text-muted-foreground">
          Founder relevance is the one dimension no formula produces: it is an
          editorial call, present only on entries someone has actually reviewed.
          Every row shows its full score breakdown either way.
        </p>
      </section>

      <section className="space-y-4">
        <div className="space-y-1">
          <h2 className="text-sm font-medium">Editor-reviewed</h2>
          <p className="text-sm text-muted-foreground">
            Someone has used or read through these and written them up.
          </p>
        </div>

        {reviewed.length > 0 ? (
          <ul className="divide-y divide-border border-y border-border">
            {reviewed.map((repo) => (
              <GemRow key={repo.id} repo={repo} />
            ))}
          </ul>
        ) : (
          <EmptyState
            icon={GemIcon}
            title="No reviewed gems yet"
            description="Nothing flagged as a hidden gem has been written up so far. The candidates below are hand-picked but unreviewed."
          />
        )}
      </section>

      <section className="space-y-4">
        <div className="space-y-1">
          <h2 className="text-sm font-medium">
            Candidates{" "}
            <span className="font-normal text-muted-foreground">
              — not reviewed
            </span>
          </h2>
          <p className="max-w-prose text-sm text-muted-foreground">
            Flagged, but nobody has written them up. Treat them as leads, not
            recommendations.
          </p>
        </div>

        {candidates.length > 0 ? (
          /* Paginated, unlike the reviewed list above: a full import can flag
             hundreds of candidates, and each row carries a score breakdown, so
             rendering them all is how this page turns into megabytes. */
          <Suspense fallback={<CandidatesSkeleton />}>
            <Candidates candidates={candidates} searchParams={searchParams} />
          </Suspense>
        ) : (
          <EmptyState
            icon={GemIcon}
            title="No candidates"
            description="Nothing in the catalogue currently carries the hidden-gem flag without a review."
          />
        )}
      </section>

      <StatsDisclaimer
        updatedAt={getStatsUpdatedAt()}
        className="max-w-prose border-t border-border pt-4"
      />
    </div>
  )
}

async function Candidates({
  candidates,
  searchParams,
}: {
  candidates: Repo[]
  searchParams: Promise<RawSearchParams>
}) {
  const params = await searchParams
  const requested = Number.parseInt(
    (Array.isArray(params.page) ? params.page[0] : params.page) ?? "1",
    10
  )

  const pageCount = Math.max(1, Math.ceil(candidates.length / PER_PAGE))
  const page = Math.min(
    Math.max(1, Number.isFinite(requested) ? requested : 1),
    pageCount
  )
  const items = candidates.slice((page - 1) * PER_PAGE, page * PER_PAGE)

  return (
    <div className="space-y-6">
      <ul className="divide-y divide-border border-y border-border">
        {items.map((repo) => (
          <GemRow key={repo.id} repo={repo} />
        ))}
      </ul>
      <Pagination
        hrefFor={(target) => (target <= 1 ? "/gems" : `/gems?page=${target}`)}
        page={page}
        pageCount={pageCount}
        total={candidates.length}
      />
    </div>
  )
}

function CandidatesSkeleton() {
  return (
    <div className="space-y-4 border-y border-border py-4">
      {Array.from({ length: 4 }).map((_, index) => (
        <div key={index} className="space-y-2">
          <Skeleton className="h-4 w-56" />
          <Skeleton className="h-3 w-full max-w-prose" />
          <Skeleton className="h-3 w-40" />
        </div>
      ))}
    </div>
  )
}

/**
 * Which route flagged this repo. The import only ever flags inside the star
 * band, so anything outside it is an editorial call — and saying so matters,
 * because otherwise the page advertises a threshold its own rows do not meet.
 */
function gemBasis(repo: Repo): "threshold" | "editorial" {
  const stars = repo.stats?.stars
  const withinBand =
    stars !== undefined &&
    stars >= HIDDEN_GEM_STARS.min &&
    stars <= HIDDEN_GEM_STARS.max

  return repo.source === "auto-discovered" && withinBand ? "threshold" : "editorial"
}

function GemRow({ repo }: { repo: Repo }) {
  const maintenance = maintenanceStatus(repo.stats)

  return (
    <li className="space-y-2 py-4">
      <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
        <Link
          href={repoHref(repo)}
          className="font-mono text-sm transition-colors hover:text-muted-foreground focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
        >
          {repo.owner}/{repo.name}
        </Link>
        {repo.reviewed ? <Badge>Editor-reviewed</Badge> : null}
        <Badge variant="outline">{maintenance.label}</Badge>
        <span className="text-xs text-muted-foreground">
          {CATEGORY_META[repo.category].label}
        </span>
      </div>

      {/* Which of the two routes flagged this repo. Without it the page states
          a star threshold that the editorial picks visibly do not meet. */}
      <p className="text-xs text-muted-foreground">
        {gemBasis(repo) === "threshold"
          ? "Flagged by the import: met the score and star thresholds."
          : "Editorial pick: sits below the best-known option in its category."}
      </p>

      <p className="max-w-prose text-sm text-muted-foreground">
        {repo.description}
      </p>

      {repo.whyFounders ? (
        <p className="max-w-prose text-sm">{repo.whyFounders}</p>
      ) : null}

      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 font-mono text-xs text-muted-foreground">
        {repo.stats ? <span>{formatCount(repo.stats.stars)} stars</span> : null}
        {repo.stats?.language ? <span>{repo.stats.language}</span> : null}
        {repo.stats?.license ? <span>{repo.stats.license}</span> : null}
        {repo.stats ? (
          <span>updated {formatMonthYear(repo.stats.pushedAt)}</span>
        ) : null}
      </div>

      {repo.tags.length > 0 ? (
        <div className="flex flex-wrap items-center gap-1.5">
          {repo.tags.slice(0, 6).map((tag) => (
            <Tag key={tag}>{tag}</Tag>
          ))}
        </div>
      ) : null}

      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <Link
          href={repoHref(repo)}
          className="text-xs text-primary transition-colors hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
        >
          Details
        </Link>
        <a
          href={repo.url}
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-1 text-xs text-muted-foreground transition-colors hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
        >
          GitHub
          <ExternalLinkIcon className="size-3" />
        </a>
      </div>

      {repo.score ? <ScoreSummary score={repo.score} /> : null}
    </li>
  )
}
