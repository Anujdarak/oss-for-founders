import Link from "next/link"
import { ArrowRightIcon, GemIcon } from "lucide-react"

import { AskBox } from "@/components/ask-box"
import { CategoryList } from "@/components/category-list"
import { CountUp } from "@/components/motion/count-up"
import { Sequence, SequenceItem } from "@/components/motion/reveal"
import { RandomGem } from "@/components/random-gem"
import { RecentlyAdded } from "@/components/recently-added"
import {
  getAllRepos,
  getCategoryCounts,
  getHiddenGems,
  getRecentlyAdded,
} from "@/lib/data"
import { repoHref } from "@/lib/links"
import { stacks } from "@/lib/stacks"

function SectionHeading({
  children,
  action,
}: {
  children: React.ReactNode
  action?: React.ReactNode
}) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <h2 className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
        {children}
      </h2>
      {action}
    </div>
  )
}

export default function HomePage() {
  const counts = getCategoryCounts()
  const total = getAllRepos().length
  const recent = getRecentlyAdded(6)
  // Passed as hrefs so the button needs no catalogue data on the client.
  const gemHrefs = getHiddenGems().map(repoHref)

  return (
    <div className="mx-auto w-full max-w-5xl space-y-12 px-4 py-12">
      <Sequence className="space-y-6">
        <SequenceItem className="space-y-3">
          <h1 className="max-w-2xl text-3xl font-semibold tracking-tight">
            Stop building what already exists.
          </h1>
          <p className="max-w-prose text-sm text-muted-foreground">
            <CountUp value={total} className="tabular-nums" /> open-source tools a
            startup can run itself, grouped by the job they do. Free, no login, no
            paywall.
          </p>
        </SequenceItem>

        <SequenceItem>
          <AskBox />
        </SequenceItem>

        <SequenceItem className="flex flex-wrap items-center gap-x-5 gap-y-2 text-sm">
          <Link
            href="#categories"
            className="group/browse inline-flex items-center gap-1.5 font-medium text-primary transition-colors hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
          >
            Browse categories
            <ArrowRightIcon className="size-3.5 transition-transform duration-200 ease-out group-hover/browse:translate-x-1" />
          </Link>
          <Link
            href="/gems"
            className="inline-flex items-center gap-1.5 text-muted-foreground transition-colors hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
          >
            <GemIcon className="size-3.5" />
            Hidden gems
          </Link>
          <RandomGem hrefs={gemHrefs} />
        </SequenceItem>
      </Sequence>

      <section id="categories" className="scroll-mt-20 space-y-3">
        <SectionHeading>Categories</SectionHeading>
        <CategoryList counts={counts} />
      </section>

      <section className="space-y-3">
        <SectionHeading
          action={
            <Link
              href="/stacks"
              className="text-xs text-muted-foreground transition-colors hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
            >
              All stacks
            </Link>
          }
        >
          Stacks
        </SectionHeading>
        <ul className="divide-y divide-border border-y border-border">
          {stacks.map((stack) => (
            <li key={stack.slug}>
              <Link
                href={`/stacks/${stack.slug}`}
                className="block space-y-0.5 px-1 py-3 transition-colors hover:bg-muted/50 focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
              >
                <span className="text-sm font-medium">{stack.title}</span>
                <p className="max-w-prose text-sm text-muted-foreground">
                  {stack.summary}
                </p>
              </Link>
            </li>
          ))}
        </ul>
      </section>

      <section className="space-y-3">
        <SectionHeading>Recently added</SectionHeading>
        <RecentlyAdded repos={recent} />
      </section>
    </div>
  )
}
