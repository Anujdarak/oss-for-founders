import Link from "next/link"
import { CircleAlertIcon, ExternalLinkIcon } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardAction,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { BookmarkButton } from "@/components/bookmark-button"
import { StaggerGroup, StaggerItem } from "@/components/motion/reveal"
import { RepoStatsRow } from "@/components/repo-stats"
import { Tag } from "@/components/tag"
import { formatDifficulty, isPossiblyStale, reviewLabel } from "@/lib/format"
import { repoHref } from "@/lib/links"
import type { Repo } from "@/lib/schema"

const VISIBLE_TAGS = 5

/**
 * Most entries arrive from the import with facts but no editorial content, so
 * every optional field here is written as "render it if it exists" rather than
 * assumed present. An entry with only a description and stats still produces a
 * complete-looking card.
 */
export function RepoCard({ repo }: { repo: Repo }) {
  const stale = isPossiblyStale(repo.stats)
  const hiddenTags = repo.tags.length - VISIBLE_TAGS

  return (
    <Card
      size="sm"
      /**
       * Hover: lift 2px and swell ~1.5%, with a stronger ring.
       *
       * `relative` + `hover:z-10` matter more than they look. Cards sit in a
       * grid with a 12px gap, so a swelling card grows ~3px into that gap on
       * each side; without raising it, the neighbour's edge paints over the
       * growth and the card looks clipped rather than lifted.
       *
       * Scale is a transform, so this costs no layout and cannot nudge any
       * other card. `motion-reduce:` pins both back to rest: the global CSS
       * guard collapses the *duration*, which without this would make the card
       * snap to its hovered size instantly rather than not move at all.
       */
      className="relative h-full transition-[transform,box-shadow] duration-200 ease-out hover:z-10 hover:-translate-y-0.5 hover:scale-[1.015] hover:ring-foreground/20 motion-reduce:hover:translate-y-0 motion-reduce:hover:scale-100"
    >
      <CardHeader>
        <CardTitle className="font-mono text-sm">
          {repo.owner}/{repo.name}
        </CardTitle>
        {/* Only reviewed entries are badged now. Saying nothing on the rest
            claims nothing, and the badge distinguished nothing when 4,904 of
            4,906 cards carried it. */}
        {repo.reviewed ? (
          <CardAction>
            <Badge>{reviewLabel(repo)}</Badge>
          </CardAction>
        ) : null}
      </CardHeader>

      <CardContent className="flex flex-col gap-3">
        <p className="line-clamp-2 text-sm text-muted-foreground">
          {repo.description}
        </p>

        <RepoStatsRow stats={repo.stats} />

        {repo.tags.length > 0 ? (
          <div className="flex flex-wrap items-center gap-1.5">
            {repo.tags.slice(0, VISIBLE_TAGS).map((tag) => (
              <Tag key={tag}>{tag}</Tag>
            ))}
            {hiddenTags > 0 ? <Tag>+{hiddenTags}</Tag> : null}
          </div>
        ) : null}

        <div className="flex flex-wrap items-center gap-2">
          {repo.isEditorPick ? <Badge variant="secondary">Editor&apos;s Pick</Badge> : null}
          {repo.difficulty ? (
            <Badge variant="outline">{formatDifficulty(repo.difficulty)}</Badge>
          ) : null}
          {repo.selfHostable ? <Badge variant="secondary">Self-hostable</Badge> : null}
          {stale ? (
            <Badge variant="destructive">
              <CircleAlertIcon />
              Possibly stale
            </Badge>
          ) : null}
        </div>
      </CardContent>

      <CardFooter className="gap-2">
        <Button size="sm" variant="outline" asChild>
          <a href={repo.url} target="_blank" rel="noreferrer">
            GitHub
            <ExternalLinkIcon className="transition-transform duration-200 ease-out group-hover/button:-translate-y-px group-hover/button:translate-x-px" />
          </a>
        </Button>
        <Button size="sm" asChild>
          <Link href={repoHref(repo)}>Details</Link>
        </Button>
        <BookmarkButton id={repo.id} className="ml-auto" />
      </CardFooter>
    </Card>
  )
}

export function RepoCardGrid({ repos }: { repos: Repo[] }) {
  return (
    <StaggerGroup
      as="ul"
      className="grid items-stretch gap-3 lg:grid-cols-2"
      stagger={0.04}
    >
      {/* `relative hover:z-10` on the item, not only on the card. A motion
          element can hold a transform, which makes the list item a stacking
          context and traps the card's own z-index inside it — the next card in
          DOM order would then paint over the swell. */}
      {repos.map((repo) => (
        <StaggerItem as="li" key={repo.id} className="relative flex hover:z-10">
          <RepoCard repo={repo} />
        </StaggerItem>
      ))}
    </StaggerGroup>
  )
}
