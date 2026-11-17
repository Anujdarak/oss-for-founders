import * as React from "react"
import { SearchXIcon } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Separator } from "@/components/ui/separator"
import { Skeleton } from "@/components/ui/skeleton"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { CategoryList } from "@/components/category-list"
import { CommandPaletteTrigger } from "@/components/command-palette"
import { EmptyState } from "@/components/empty-state"
import { Pagination } from "@/components/pagination"
import { RepoCard } from "@/components/repo-card"
import { RepoStatsRow } from "@/components/repo-stats"
import { SiteFooter } from "@/components/site-footer"
import { SiteHeader } from "@/components/site-header"
import { Tag } from "@/components/tag"
import { ThemeToggle } from "@/components/theme-toggle"
import { CATEGORY_LABELS } from "@/lib/categories"
import { getAllRepos, getCategoryCounts } from "@/lib/data"
import type { Repo } from "@/lib/schema"

const TOKENS = [
  "background",
  "card",
  "muted",
  "border",
  "foreground",
  "muted-foreground",
  "primary",
  "destructive",
] as const

const SWATCH_CLASS: Record<(typeof TOKENS)[number], string> = {
  background: "bg-background",
  card: "bg-card",
  muted: "bg-muted",
  border: "bg-border",
  foreground: "bg-foreground",
  "muted-foreground": "bg-muted-foreground",
  primary: "bg-primary",
  destructive: "bg-destructive",
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
    <section className="space-y-3 border-t border-border pt-6">
      <div className="space-y-1">
        <h2 className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
          {title}
        </h2>
        {note ? (
          <p className="max-w-prose text-sm text-muted-foreground">{note}</p>
        ) : null}
      </div>
      {children}
    </section>
  )
}

/**
 * A fixture, not catalogue data: no real repo in `repos.json` is 12 months
 * stale, and the badge still needs somewhere to be reviewed. The fictional
 * owner/name keeps it from reading as a claim about a real project.
 */
const STALE_FIXTURE: Repo = {
  id: "example-stale-project",
  name: "stale-project",
  owner: "example",
  url: "https://github.com/example/stale-project",
  category: "developer-tools",
  description:
    "Fixture entry used to review the stale and empty-field states. Not a real repository.",
  tags: ["fixture"],
  source: "auto-discovered",
  reviewed: false,
  addedAt: "2026-11-06",
  isEditorPick: false,
  isHiddenGem: false,
  stats: {
    stars: 412,
    forks: 37,
    language: "Rust",
    pushedAt: "2024-01-09T10:00:00Z",
    fetchedAt: "2026-11-06",
  },
}

const galleryHref = (page: number) =>
  page <= 1 ? "/c/ai-ml" : `/c/ai-ml?page=${page}`

export function Gallery() {
  const repos = getAllRepos()
  const repo = repos.find((entry) => entry.reviewed) ?? repos[0]
  const discovered = repos.find((entry) => !entry.reviewed) ?? repos[0]

  return (
    <div className="space-y-6">
      <Section title="Color tokens">
        <ul className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {TOKENS.map((token) => (
            <li key={token} className="space-y-1.5">
              <div
                className={`h-10 w-full rounded-md border border-border ${SWATCH_CLASS[token]}`}
              />
              <p className="font-mono text-[0.6875rem] text-muted-foreground">
                {token}
              </p>
            </li>
          ))}
        </ul>
      </Section>

      <Section title="Typography" note="One sans for prose, one mono for stats, tags, and commands.">
        <div className="space-y-2">
          <p className="text-2xl font-semibold tracking-tight">
            Scheduling infrastructure
          </p>
          <p className="text-base">
            Booking pages, availability rules, and calendar sync.
          </p>
          <p className="text-sm text-muted-foreground">
            Secondary copy sits at 14px in the muted foreground.
          </p>
          <p className="font-mono text-xs text-muted-foreground">
            docker compose up -d
          </p>
        </div>
      </Section>

      <Section title="Button">
        <div className="space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <Button>Default</Button>
            <Button variant="outline">Outline</Button>
            <Button variant="secondary">Secondary</Button>
            <Button variant="ghost">Ghost</Button>
            <Button variant="destructive">Destructive</Button>
            <Button variant="link">Link</Button>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button size="xs">Extra small</Button>
            <Button size="sm">Small</Button>
            <Button size="default">Default</Button>
            <Button size="lg">Large</Button>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button disabled>Disabled</Button>
            <Button variant="outline" disabled>
              Disabled outline
            </Button>
          </div>
        </div>
      </Section>

      <Section
        title="Badge"
        note="Status and metadata only: editor picks, difficulty, self-hostable."
      >
        <div className="space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <Badge>Default</Badge>
            <Badge variant="secondary">Secondary</Badge>
            <Badge variant="outline">Outline</Badge>
            <Badge variant="destructive">Destructive</Badge>
            <Badge variant="ghost">Ghost</Badge>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Badge>Editor pick</Badge>
            <Badge variant="outline">Intermediate</Badge>
            <Badge variant="secondary">Self-hostable</Badge>
          </div>
        </div>
      </Section>

      <Section
        title="Tag"
        note="Taxonomy keywords, always mono. Becomes a filter control in a later stage."
      >
        <div className="flex flex-wrap items-center gap-1.5">
          {repo.tags.map((tag) => (
            <Tag key={tag}>{tag}</Tag>
          ))}
        </div>
      </Section>

      <Section title="Input">
        <div className="grid max-w-sm gap-2">
          <Input placeholder="Search repositories" />
          <Input defaultValue="analytics" />
          <Input placeholder="Disabled" disabled />
          <Input defaultValue="not-a-url" aria-invalid="true" />
        </div>
      </Section>

      <Section title="Card">
        <div className="grid items-start gap-3 lg:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>Card title</CardTitle>
              <CardDescription>
                One line describing what this card holds.
              </CardDescription>
              <CardAction>
                <Button variant="ghost" size="icon-sm" aria-label="More">
                  <SearchXIcon />
                </Button>
              </CardAction>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground">
              Body content sits here.
            </CardContent>
            <CardFooter>
              <Button variant="outline" size="sm">
                Action
              </Button>
            </CardFooter>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="font-mono text-sm">
                {repo.owner}/{repo.name}
              </CardTitle>
              <CardDescription>{repo.description}</CardDescription>
              {repo.isEditorPick ? (
                <CardAction>
                  <Badge>Editor pick</Badge>
                </CardAction>
              ) : null}
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex flex-wrap items-center gap-1.5">
                {repo.tags.map((tag) => (
                  <Tag key={tag}>{tag}</Tag>
                ))}
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="outline">
                  {CATEGORY_LABELS[repo.category]}
                </Badge>
                {repo.difficulty ? (
                  <Badge variant="secondary">{repo.difficulty}</Badge>
                ) : null}
                {repo.selfHostable ? (
                  <Badge variant="secondary">Self-hostable</Badge>
                ) : null}
              </div>
              {repo.installHint ? (
                <p className="font-mono text-xs text-muted-foreground">
                  {repo.installHint}
                </p>
              ) : null}
            </CardContent>
            <CardFooter>
              <Button size="sm" asChild>
                <a href={repo.url} target="_blank" rel="noreferrer">
                  View repo
                </a>
              </Button>
            </CardFooter>
          </Card>
        </div>
      </Section>

      <Section
        title="Repo stats"
        note="A snapshot, not a live read. Fields GitHub does not report are simply absent."
      >
        <div className="space-y-2">
          <RepoStatsRow stats={repo.stats} />
          <RepoStatsRow stats={discovered.stats} />
          <RepoStatsRow stats={STALE_FIXTURE.stats} />
        </div>
      </Section>

      <Section
        title="Repo card"
        note="Left: editor-reviewed, with difficulty and self-host badges. Middle: auto-discovered, where every editorial field is empty. Right: a fixture showing the stale badge."
      >
        <div className="grid items-start gap-3 lg:grid-cols-2">
          <RepoCard repo={repo} />
          <RepoCard repo={discovered} />
          <RepoCard repo={STALE_FIXTURE} />
        </div>
      </Section>

      <Section
        title="Category list"
        note="Dense rows: icon, name, count, one line. The whole row is the link."
      >
        <CategoryList counts={getCategoryCounts()} />
      </Section>

      <Section
        title="Pagination"
        note="Shown here at three positions. It renders nothing at all when there is only one page, which is the case for every category at the current data size."
      >
        <div className="space-y-4">
          <Pagination hrefFor={galleryHref} page={1} pageCount={7} total={160} />
          <Pagination hrefFor={galleryHref} page={4} pageCount={7} total={160} />
          <Pagination hrefFor={galleryHref} page={7} pageCount={7} total={160} />
        </div>
      </Section>

      <Section title="Tabs">
        <Tabs defaultValue="overview">
          <TabsList>
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="tradeoffs">Tradeoffs</TabsTrigger>
            <TabsTrigger value="install">Install</TabsTrigger>
          </TabsList>
          <TabsContent
            value="overview"
            className="pt-3 text-sm text-muted-foreground"
          >
            {repo.whyFounders ?? "No write-up for this entry yet."}
          </TabsContent>
          <TabsContent value="tradeoffs" className="pt-3">
            <ul className="space-y-1 text-sm text-muted-foreground">
              {repo.cons?.map((con) => <li key={con}>{con}</li>)}
            </ul>
          </TabsContent>
          <TabsContent value="install" className="pt-3">
            <p className="font-mono text-xs text-muted-foreground">
              {repo.installHint ?? "No verified install command."}
            </p>
          </TabsContent>
        </Tabs>
      </Section>

      <Section title="Separator">
        <div className="max-w-sm space-y-3">
          <p className="text-sm text-muted-foreground">Above</p>
          <Separator />
          <p className="text-sm text-muted-foreground">Below</p>
        </div>
      </Section>

      <Section title="Skeleton">
        <div className="max-w-sm space-y-2 rounded-lg border border-border p-4">
          <Skeleton className="h-4 w-32" />
          <Skeleton className="h-3 w-full" />
          <Skeleton className="h-3 w-2/3" />
          <div className="flex gap-1.5 pt-1">
            <Skeleton className="h-4 w-14" />
            <Skeleton className="h-4 w-14" />
          </div>
        </div>
      </Section>

      <Section title="Empty state">
        <EmptyState
          icon={SearchXIcon}
          title="No repositories match those filters"
          description="Clear a filter or widen the category to see more results."
          action={
            <Button variant="outline" size="sm">
              Clear filters
            </Button>
          }
        />
      </Section>

      <Section
        title="Controls"
        note="The palette trigger opens the dialog owned by this document."
      >
        <div className="flex flex-wrap items-center gap-2">
          <CommandPaletteTrigger />
          <ThemeToggle />
        </div>
      </Section>

      <Section title="Top nav">
        <div className="relative overflow-hidden rounded-lg border border-border">
          <SiteHeader />
        </div>
      </Section>

      <Section title="Footer">
        <div className="overflow-hidden rounded-lg border border-border">
          <SiteFooter />
        </div>
      </Section>
    </div>
  )
}
