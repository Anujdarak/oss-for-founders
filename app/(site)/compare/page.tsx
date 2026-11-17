import { Suspense } from "react"
import type { Metadata } from "next"
import Link from "next/link"
import { ExternalLinkIcon, GitCompareIcon } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { CopyLink } from "@/components/copy-link"
import { EmptyState } from "@/components/empty-state"
import { CATEGORY_META } from "@/lib/categories"
import { getRepoById, getRepoByOwnerName } from "@/lib/data"
import {
  formatCount,
  formatDifficulty,
  formatMonthYear,
  maintenanceStatus,
  reviewLabel,
} from "@/lib/format"
import { repoHref } from "@/lib/links"
import type { RawSearchParams } from "@/lib/filters"
import type { Repo } from "@/lib/schema"

const MAX_COMPARE = 3

/**
 * How many `ids` tokens are even looked at. Generous next to MAX_COMPARE so
 * the "some of these were dropped" message still works when someone pastes a
 * long list, but small enough that the response size cannot be driven by the
 * query string.
 */
const MAX_TOKENS = 24

export const metadata: Metadata = {
  title: "Compare",
  description: "Put up to three repos side by side on stats, licence, and maintenance.",
}

export default function ComparePage({
  searchParams,
}: {
  searchParams: Promise<RawSearchParams>
}) {
  return (
    <div className="mx-auto w-full max-w-5xl space-y-6 px-4 py-12">
      <div className="space-y-3">
        <div className="flex items-center gap-2 text-muted-foreground">
          <GitCompareIcon className="size-4" aria-hidden />
          <span className="text-xs font-medium tracking-wide uppercase">Compare</span>
        </div>
        <h1 className="text-2xl font-semibold tracking-tight">
          Up to three, side by side
        </h1>
      </div>

      <Suspense fallback={<CompareSkeleton />}>
        <CompareTable searchParams={searchParams} />
      </Suspense>
    </div>
  )
}

/**
 * Accepts either an internal id or an `owner/name` pair in `ids`, because the
 * useful thing to paste is whatever you were already looking at.
 */
function resolveOne(token: string): Repo | undefined {
  const trimmed = token.trim()
  if (!trimmed) return undefined
  if (trimmed.includes("/")) {
    const [owner, name] = trimmed.split("/")
    return getRepoByOwnerName(owner, name)
  }
  return getRepoById(trimmed)
}

async function CompareTable({
  searchParams,
}: {
  searchParams: Promise<RawSearchParams>
}) {
  const params = await searchParams
  const raw = Array.isArray(params.ids) ? params.ids.join(",") : (params.ids ?? "")
  /**
   * Cap the tokens before doing any work with them.
   *
   * Every token was resolved and every unmatched one rendered, so the page
   * grew with the query string: 500 ids produced an 83KB response. Node's own
   * URL-length limit answers 431 somewhere past a thousand, which bounded it
   * in practice — but that is an incidental protection from the runtime, not
   * a decision this page made. Comparing more than a handful is meaningless
   * anyway; `MAX_COMPARE` is 3.
   */
  const tokens = raw
    .split(",")
    .map((token) => token.trim())
    .filter(Boolean)
    .slice(0, MAX_TOKENS)

  const resolved = tokens.map((token) => ({ token, repo: resolveOne(token) }))
  const repos = resolved
    .map((entry) => entry.repo)
    .filter((repo): repo is Repo => Boolean(repo))
    .slice(0, MAX_COMPARE)

  const unknown = resolved.filter((entry) => !entry.repo).map((entry) => entry.token)
  const dropped = tokens.length - unknown.length - repos.length

  if (repos.length === 0) {
    return (
      <EmptyState
        icon={GitCompareIcon}
        title="Nothing to compare"
        description="Add repos with ?ids=owner/name,owner/name — or save a few and use the Compare button on the Saved page."
        action={
          <Button variant="outline" size="sm" asChild>
            <Link href="/explore">Browse the catalogue</Link>
          </Button>
        }
      />
    )
  }

  const rows: { label: string; render: (repo: Repo) => React.ReactNode }[] = [
    {
      label: "Category",
      render: (repo) => CATEGORY_META[repo.category].label,
    },
    {
      label: "Stars",
      render: (repo) =>
        repo.stats ? <Mono>{formatCount(repo.stats.stars)}</Mono> : <Unknown />,
    },
    {
      label: "Forks",
      render: (repo) =>
        repo.stats ? <Mono>{formatCount(repo.stats.forks)}</Mono> : <Unknown />,
    },
    {
      label: "Open issues",
      render: (repo) =>
        repo.stats?.openIssues !== undefined ? (
          <Mono>{formatCount(repo.stats.openIssues)}</Mono>
        ) : (
          <Unknown />
        ),
    },
    {
      label: "Language",
      render: (repo) =>
        repo.stats?.language ? <Mono>{repo.stats.language}</Mono> : <Unknown />,
    },
    {
      label: "Licence",
      render: (repo) =>
        repo.stats?.license ? (
          <Mono>{repo.stats.license}</Mono>
        ) : (
          <span className="text-muted-foreground">Not a standard SPDX licence</span>
        ),
    },
    {
      label: "Last push",
      render: (repo) =>
        repo.stats ? <Mono>{formatMonthYear(repo.stats.pushedAt)}</Mono> : <Unknown />,
    },
    {
      label: "Maintenance",
      render: (repo) => maintenanceStatus(repo.stats).label,
    },
    {
      label: "Self-hostable",
      render: (repo) =>
        repo.selfHostable === undefined ? (
          <Unknown />
        ) : repo.selfHostable ? (
          "Yes"
        ) : (
          "No"
        ),
    },
    {
      label: "Difficulty",
      render: (repo) =>
        repo.difficulty ? formatDifficulty(repo.difficulty) : <Unknown />,
    },
    {
      label: "Review",
      // reviewLabel is null for unreviewed entries now, which would leave an
      // unexplained blank cell in a comparison table. The dash is the same
      // "no value" marker the other rows use.
      render: (repo) => reviewLabel(repo) ?? <Unknown />,
    },
    {
      label: "Score",
      render: (repo) =>
        repo.score ? <Mono>{repo.score.total.toFixed(2)}</Mono> : <Unknown />,
    },
  ]

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <CopyLink label="Copy comparison link" />
        {repos.length >= MAX_COMPARE ? (
          <p className="text-xs text-muted-foreground">
            Showing the first {MAX_COMPARE}.
          </p>
        ) : null}
      </div>

      {unknown.length > 0 ? (
        <p className="text-xs text-muted-foreground">
          Not in the catalogue, so skipped:{" "}
          <span className="font-mono">{unknown.join(", ")}</span>
        </p>
      ) : null}
      {dropped > 0 ? (
        <p className="text-xs text-muted-foreground">
          {dropped} more beyond the {MAX_COMPARE}-repo limit were left out.
        </p>
      ) : null}

      {/* Wide tables scroll inside their own container rather than pushing the
          page sideways on a phone. */}
      <div className="overflow-x-auto">
        <table className="w-full min-w-[32rem] border-collapse text-sm">
          <caption className="sr-only">
            Comparison of {repos.map((r) => `${r.owner}/${r.name}`).join(", ")}
          </caption>
          <thead>
            <tr className="border-b border-border">
              <th scope="col" className="w-32 px-2 py-3 text-left text-xs font-medium tracking-wide text-muted-foreground uppercase">
                Field
              </th>
              {repos.map((repo) => (
                <th key={repo.id} scope="col" className="px-2 py-3 text-left align-top">
                  <div className="space-y-1.5">
                    <Link
                      href={repoHref(repo)}
                      className="block font-mono text-sm break-all transition-colors hover:text-muted-foreground focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
                    >
                      {repo.owner}/{repo.name}
                    </Link>
                    {repo.isHiddenGem ? (
                      <Badge variant="secondary">Hidden gem</Badge>
                    ) : null}
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.label} className="border-b border-border">
                <th
                  scope="row"
                  className="px-2 py-2.5 text-left align-top text-xs font-medium tracking-wide text-muted-foreground uppercase"
                >
                  {row.label}
                </th>
                {repos.map((repo) => (
                  <td key={repo.id} className="px-2 py-2.5 align-top">
                    {row.render(repo)}
                  </td>
                ))}
              </tr>
            ))}
            <tr>
              <th scope="row" className="px-2 py-3 text-left align-top text-xs font-medium tracking-wide text-muted-foreground uppercase">
                Links
              </th>
              {repos.map((repo) => (
                <td key={repo.id} className="px-2 py-3 align-top">
                  <div className="flex flex-col items-start gap-1.5">
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
                </td>
              ))}
            </tr>
          </tbody>
        </table>
      </div>

      <p className="max-w-prose text-xs text-muted-foreground">
        Blank cells are fields nobody has filled in for that repo, not zeros.
        Difficulty and self-hostability are editorial and only present on
        reviewed entries.
      </p>
    </div>
  )
}

function Mono({ children }: { children: React.ReactNode }) {
  return <span className="font-mono text-xs">{children}</span>
}

function Unknown() {
  return (
    <span className="text-muted-foreground/60" title="Not recorded">
      —
    </span>
  )
}

function CompareSkeleton() {
  return (
    <div className="space-y-3">
      <Skeleton className="h-8 w-40" />
      {Array.from({ length: 8 }).map((_, index) => (
        <Skeleton key={index} className="h-6 w-full" />
      ))}
    </div>
  )
}
