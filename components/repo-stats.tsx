import { GitForkIcon, ScaleIcon, StarIcon } from "lucide-react"
import { cn } from "cn"

import { formatCount, formatMonthYear } from "@/lib/format"
import type { RepoStats } from "@/lib/schema"

/**
 * The snapshot row: stars, forks, language, license, last push. Renders nothing
 * at all when an entry has no stats, which is the normal case for an entry the
 * import has not reached yet. Individual fields drop out the same way — plenty
 * of projects carry a custom licence GitHub reports as NOASSERTION, and that
 * arrives here as simply absent.
 */
export function RepoStatsRow({
  stats,
  className,
}: {
  stats: RepoStats | undefined
  className?: string
}) {
  if (!stats) return null

  return (
    <dl
      className={cn(
        "flex flex-wrap items-center gap-x-3 gap-y-1 font-mono text-xs text-muted-foreground",
        className
      )}
    >
      <div className="flex items-center gap-1">
        <dt className="contents">
          <StarIcon className="size-3.5" aria-hidden />
          <span className="sr-only">Stars</span>
        </dt>
        <dd>{formatCount(stats.stars)}</dd>
      </div>

      <div className="flex items-center gap-1">
        <dt className="contents">
          <GitForkIcon className="size-3.5" aria-hidden />
          <span className="sr-only">Forks</span>
        </dt>
        <dd>{formatCount(stats.forks)}</dd>
      </div>

      {stats.language ? (
        <div className="flex items-center gap-1">
          <dt className="sr-only">Language</dt>
          <dd>{stats.language}</dd>
        </div>
      ) : null}

      {stats.license ? (
        <div className="flex items-center gap-1">
          <dt className="contents">
            <ScaleIcon className="size-3.5" aria-hidden />
            <span className="sr-only">License</span>
          </dt>
          <dd>{stats.license}</dd>
        </div>
      ) : null}

      <div className="flex items-center gap-1">
        <dt className="sr-only">Last commit</dt>
        <dd>updated {formatMonthYear(stats.pushedAt)}</dd>
      </div>
    </dl>
  )
}
