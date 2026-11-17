import Link from "next/link"

import { StaggerGroup, StaggerItem } from "@/components/motion/reveal"
import { CATEGORY_META } from "@/lib/categories"
import { repoHref } from "@/lib/links"
import { formatCount, formatMonthYear } from "@/lib/format"
import type { Repo } from "@/lib/schema"

/** Compact one-line-per-repo list. Deliberately not cards: this is a sidebar-weight list. */
export function RecentlyAdded({ repos }: { repos: Repo[] }) {
  return (
    <StaggerGroup
      as="ul"
      className="divide-y divide-border border-y border-border"
      stagger={0.04}
    >
      {repos.map((repo) => (
        <StaggerItem as="li" key={repo.id}>
          <Link
            href={repoHref(repo)}
            className="group flex flex-wrap items-baseline gap-x-3 gap-y-1 px-1 py-3 transition-colors hover:bg-muted/50 focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
          >
            <span className="font-mono text-sm">
              {repo.owner}/{repo.name}
            </span>
            <span className="text-xs text-muted-foreground">
              {CATEGORY_META[repo.category].label}
            </span>
            {repo.stats ? (
              <span className="ml-auto font-mono text-xs text-muted-foreground">
                {formatCount(repo.stats.stars)} · added{" "}
                {formatMonthYear(repo.addedAt)}
              </span>
            ) : (
              <span className="ml-auto font-mono text-xs text-muted-foreground">
                added {formatMonthYear(repo.addedAt)}
              </span>
            )}
          </Link>
        </StaggerItem>
      ))}
    </StaggerGroup>
  )
}
