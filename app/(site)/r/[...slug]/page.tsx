import type { Metadata } from "next"
import Link from "next/link"
import { notFound, permanentRedirect } from "next/navigation"
import {
  BookOpenIcon,
  CircleAlertIcon,
  ExternalLinkIcon,
  GlobeIcon,
} from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"
import { BookmarkButton } from "@/components/bookmark-button"
import { CategoryIcon } from "@/components/category-icon"
import { CopyLink } from "@/components/copy-link"
import { RecordView } from "@/components/record-view"
import { ScrollProgress } from "@/components/motion/scroll-progress"
import { RepoResult } from "@/components/repo-result"
import { RepoStatsRow } from "@/components/repo-stats"
import { ScoreBreakdown } from "@/components/score-breakdown"
import { StatsDisclaimer } from "@/components/stats-disclaimer"
import { Tag } from "@/components/tag"
import { CATEGORY_META } from "@/lib/categories"
import {
  getAllRepos,
  getRepoById,
  getRepoByOwnerName,
  getSimilarRepos,
} from "@/lib/data"
import { formatDifficulty, maintenanceStatus, reviewLabel } from "@/lib/format"
import { repoHref } from "@/lib/links"
import { safeHref, serializeJsonLd } from "@/lib/safe-url"
import { toSearchDoc } from "@/lib/search"
import type { Repo } from "@/lib/schema"
import { SITE } from "@/lib/site"

/**
 * This route awaits `params` at the top level rather than inside a
 * `<Suspense>` boundary, so `notFound()` can set a real 404 status before the
 * response starts streaming. Next's instant-navigation check flags that as a
 * blocking read, so the check is switched off here deliberately rather than
 * left as permanent dev-overlay noise that teaches everyone to ignore it.
 *
 * It costs nothing in practice: every valid param is enumerated in
 * `generateStaticParams`, so real navigations are served from a prerendered
 * page. The only params that take the blocking path are the ones that 404.
 */
export const instant = false

type RepoParams = { slug: string[] }

/**
 * How many repo pages to prerender at build time.
 *
 * Measured, not guessed: prerendering all of them took over ten minutes at
 * 3,000 entries, and the import is capped at 3,000. Params not listed here are
 * rendered on first request and written to disk afterwards, so every repo still
 * has a page — the build just stops being the place that pays for all of them.
 */
const PRERENDER_LIMIT = 300

/**
 * One catch-all rather than separate `[id]` and `[owner]/[name]` routes: Next
 * rejects two different slug names at the same path position. A single segment
 * is treated as a legacy id and redirected to the canonical owner/name URL.
 *
 * Reviewed entries and hidden gems come first because they are the pages with
 * something a visitor cannot get from GitHub, then the most-starred of the rest.
 */
export function generateStaticParams(): RepoParams[] {
  const all = getAllRepos()

  const priority = all.filter((repo) => repo.reviewed || repo.isHiddenGem)
  const rest = all
    .filter((repo) => !repo.reviewed && !repo.isHiddenGem)
    .sort((a, b) => (b.stats?.stars ?? 0) - (a.stats?.stars ?? 0))

  return [...priority, ...rest]
    .slice(0, PRERENDER_LIMIT)
    .map((repo) => ({ slug: [repo.owner, repo.name] }))
}

function resolve(slug: string[]): Repo | undefined {
  if (slug.length === 2) return getRepoByOwnerName(slug[0], slug[1])
  return undefined
}

export async function generateMetadata({
  params,
}: {
  params: Promise<RepoParams>
}): Promise<Metadata> {
  "use cache"
  const { slug } = await params
  const repo = resolve(slug)
  if (!repo) return {}

  const title = `${repo.owner}/${repo.name}`
  const url = `${SITE.url}${repoHref(repo)}`

  return {
    title,
    description: repo.description,
    alternates: { canonical: url },
    openGraph: {
      type: "article",
      url,
      title: `${title} · ${SITE.name}`,
      description: repo.description,
      siteName: SITE.name,
    },
    twitter: {
      card: "summary",
      title: `${title} · ${SITE.name}`,
      description: repo.description,
    },
  }
}

export default async function RepoPage({
  params,
}: {
  params: Promise<RepoParams>
}) {
  const { slug } = await params

  // Legacy `/r/<id>` links.
  if (slug.length === 1) {
    const byId = getRepoById(slug[0])
    if (byId) permanentRedirect(repoHref(byId))
    notFound()
  }

  const repo = resolve(slug)
  if (!repo) notFound()

  const category = CATEGORY_META[repo.category]
  const maintenance = maintenanceStatus(repo.stats)
  const similar = getSimilarRepos(repo)

  return (
    <div className="mx-auto w-full max-w-3xl space-y-8 px-4 py-12">
      {/* Structured data describes the software, not the page, and every field
          is copied from the data rather than asserted. */}
      {/* serializeJsonLd, not JSON.stringify. Descriptions are written by
          repo owners and imported automatically, and JSON.stringify does not
          escape "<" — a description containing a closing script tag ended
          this element early and everything after it parsed as HTML. */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: serializeJsonLd(jsonLd(repo)) }}
      />

      {/* Adds this repo to the reader's own recently-viewed list. */}
      <RecordView id={repo.id} />
      <ScrollProgress />

      <header className="space-y-4">
        <Link
          href={`/c/${repo.category}`}
          className="inline-flex items-center gap-2 text-xs font-medium tracking-wide text-muted-foreground uppercase transition-colors hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
        >
          <CategoryIcon category={repo.category} className="size-4" />
          {category.label}
        </Link>

        <div className="flex flex-wrap items-start justify-between gap-3">
          <h1 className="font-mono text-xl font-medium break-all">
            {repo.owner}/{repo.name}
          </h1>
          {repo.reviewed ? <Badge>{reviewLabel(repo)}</Badge> : null}
        </div>

        <p className="max-w-prose text-sm text-muted-foreground">
          {repo.description}
        </p>

        <RepoStatsRow stats={repo.stats} />

        <div className="flex flex-wrap items-center gap-2">
          {repo.isEditorPick ? <Badge variant="secondary">Editor&apos;s Pick</Badge> : null}
          {repo.isHiddenGem ? <Badge variant="secondary">Hidden gem</Badge> : null}
          {repo.difficulty ? (
            <Badge variant="outline">{formatDifficulty(repo.difficulty)}</Badge>
          ) : null}
          {repo.selfHostable ? <Badge variant="secondary">Self-hostable</Badge> : null}
          <Badge
            variant={
              maintenance.key === "stale" || maintenance.key === "archived"
                ? "destructive"
                : "outline"
            }
          >
            {maintenance.key === "stale" || maintenance.key === "archived" ? (
              <CircleAlertIcon />
            ) : null}
            {maintenance.label}
          </Badge>
        </div>

        {repo.tags.length > 0 ? (
          <div className="flex flex-wrap items-center gap-1.5">
            {repo.tags.map((tag) => (
              <Tag key={tag}>{tag}</Tag>
            ))}
          </div>
        ) : null}

        <div className="flex flex-wrap items-center gap-2">
          <Button size="sm" asChild>
            <a href={repo.url} target="_blank" rel="noreferrer">
              View on GitHub
              <ExternalLinkIcon />
            </a>
          </Button>
          {safeHref(repo.docsUrl) ? (
            <Button size="sm" variant="outline" asChild>
              <a href={safeHref(repo.docsUrl)} target="_blank" rel="noreferrer">
                <BookOpenIcon />
                Docs
              </a>
            </Button>
          ) : null}
          {/* safeHref even though the schema now constrains the scheme: this
              is the sink, and defence here does not depend on every row
              having been re-validated since the constraint was added. */}
          {safeHref(repo.homepage) ? (
            <Button size="sm" variant="outline" asChild>
              <a href={safeHref(repo.homepage)} target="_blank" rel="noreferrer">
                <GlobeIcon />
                Website
              </a>
            </Button>
          ) : null}
          <BookmarkButton id={repo.id} label />
          <CopyLink />
        </div>
      </header>

      <Separator />

      {/* --- editorial, only when a human wrote it --- */}
      {repo.reviewed ? (
        <div className="space-y-6">
          {repo.whyFounders ? (
            <Section title="Why founders care">
              <p className="max-w-prose text-sm">{repo.whyFounders}</p>
            </Section>
          ) : null}

          {repo.problemSolved ? (
            <Section title="Problem it solves">
              <p className="max-w-prose text-sm">{repo.problemSolved}</p>
            </Section>
          ) : null}

          {repo.features?.length ? (
            <Section title="Features">
              <Bullets items={repo.features} />
            </Section>
          ) : null}

          {repo.useCases?.length ? (
            <Section title="Use cases">
              <Bullets items={repo.useCases} />
            </Section>
          ) : null}

          {repo.pros?.length || repo.cons?.length ? (
            <div className="grid gap-6 sm:grid-cols-2">
              {repo.pros?.length ? (
                <Section title="Pros">
                  <Bullets items={repo.pros} />
                </Section>
              ) : null}
              {repo.cons?.length ? (
                <Section title="Cons">
                  <Bullets items={repo.cons} />
                </Section>
              ) : null}
            </div>
          ) : null}

          {repo.alternatives?.length ? (
            <Section title="Alternatives">
              <p className="text-sm text-muted-foreground">
                {repo.alternatives.join(", ")}
              </p>
            </Section>
          ) : null}
        </div>
      ) : (
        <NotReviewed />
      )}

      {/* --- facts, available for every entry --- */}
      <div className="grid gap-6 sm:grid-cols-2">
        <Section title="Maintenance">
          <p className="text-sm text-muted-foreground">{maintenance.detail}</p>
        </Section>

        <Section title="Licence">
          {repo.stats?.license ? (
            <p className="font-mono text-sm">{repo.stats.license}</p>
          ) : (
            <p className="text-sm text-muted-foreground">
              GitHub does not resolve this repo to a standard SPDX licence, which
              usually means a custom or dual licence. Read it in the repository
              before relying on it.
            </p>
          )}
        </Section>

        <Section title="Tech stack">
          {repo.techStack?.length ? (
            <div className="flex flex-wrap gap-1.5">
              {repo.techStack.map((item) => (
                <Tag key={item}>{item}</Tag>
              ))}
            </div>
          ) : repo.stats?.language ? (
            <p className="text-sm text-muted-foreground">
              Primary language: <span className="font-mono">{repo.stats.language}</span>.
              GitHub reports only the dominant language, so this is not the whole
              stack.
            </p>
          ) : (
            <p className="text-sm text-muted-foreground">Not recorded.</p>
          )}
        </Section>

        <Section title="Install">
          {repo.installHint ? (
            <p className="font-mono text-xs break-words text-muted-foreground">
              {repo.installHint}
            </p>
          ) : (
            <p className="text-sm text-muted-foreground">
              No install command has been verified for this repo. Follow the
              README rather than a guess.
            </p>
          )}
        </Section>
      </div>

      {repo.score ? (
        <Section
          title="Quality score"
          note={
            repo.source === "curated"
              ? "Computed with the same formula the discovery import uses, so this entry can be compared with imported ones."
              : "Computed by the discovery import when this entry was added."
          }
        >
          <ScoreBreakdown score={repo.score} />
        </Section>
      ) : null}

      {similar.length > 0 ? (
        <Section
          title="Similar repos"
          note="Same category, ranked by shared topics."
        >
          <ul className="border-t border-border">
            {similar.map((other) => (
              <RepoResult key={other.id} doc={toSearchDoc(other)} />
            ))}
          </ul>
        </Section>
      ) : null}

      <StatsDisclaimer
        updatedAt={repo.stats?.fetchedAt}
        className="max-w-prose border-t border-border pt-4"
      />
    </div>
  )
}

function Section({
  title,
  note,
  children,
}: {
  title: string
  note?: string
  children: React.ReactNode
}) {
  return (
    <section className="space-y-2">
      <h2 className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
        {title}
      </h2>
      {note ? (
        <p className="max-w-prose text-xs text-muted-foreground">{note}</p>
      ) : null}
      {children}
    </section>
  )
}

function Bullets({ items }: { items: string[] }) {
  return (
    <ul className="max-w-prose space-y-1 text-sm text-muted-foreground">
      {items.map((item) => (
        <li key={item} className="flex gap-2">
          <span aria-hidden className="text-border">
            —
          </span>
          {item}
        </li>
      ))}
    </ul>
  )
}

/**
 * The honest empty state for an unreviewed entry. It does not hide the sections
 * and it does not fill them in: it says which ones are missing and why.
 *
 * The heading used to read "Not reviewed yet", which was removed everywhere
 * else as noise — it appeared on 4,904 of 4,906 entries. It stays here in
 * substance because this block explains an *absence* the reader can see:
 * without it, the page just has no tradeoffs section and no reason given.
 */
function NotReviewed() {
  return (
    <section className="space-y-2 rounded-lg border border-border px-4 py-4">
      <h2 className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
        Straight from GitHub
      </h2>
      <p className="max-w-prose text-sm text-muted-foreground">
        Nobody has written up this repo. Everything on this page comes straight
        from the GitHub API, so there is no founder write-up, no pros and cons,
        and no difficulty rating — rather than a generated guess at them.
      </p>
    </section>
  )
}

/**
 * SoftwareApplication is the closest schema.org type for a self-hostable tool.
 * Only fields backed by real data are emitted; no rating or price is claimed.
 */
function jsonLd(repo: Repo) {
  const sameAs = [repo.homepage, repo.docsUrl].filter(Boolean)

  return {
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    name: `${repo.owner}/${repo.name}`,
    description: repo.description,
    applicationCategory: CATEGORY_META[repo.category].label,
    url: `${SITE.url}${repoHref(repo)}`,
    codeRepository: repo.url,
    ...(sameAs.length > 0 ? { sameAs } : {}),
    ...(repo.stats?.license ? { license: repo.stats.license } : {}),
    ...(repo.stats?.language ? { programmingLanguage: repo.stats.language } : {}),
    ...(repo.stats?.createdAt ? { dateCreated: repo.stats.createdAt } : {}),
    ...(repo.stats?.pushedAt ? { dateModified: repo.stats.pushedAt } : {}),
    ...(repo.tags.length > 0 ? { keywords: repo.tags.join(", ") } : {}),
    isAccessibleForFree: true,
  }
}
