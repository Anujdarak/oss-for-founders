"use client"

import * as React from "react"
import Link from "next/link"
import { BookmarkIcon, ClockIcon } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { EmptyState } from "@/components/empty-state"
import { RepoResult } from "@/components/repo-result"
import { useHydrated } from "@/hooks/use-hydrated"
import { useBookmarks, useRecentlyViewed } from "@/hooks/use-local-store"
import { clearRecent } from "@/lib/local-store"
import type { SearchDoc } from "@/lib/search"

/**
 * Both lists are ids in localStorage, so the repo data behind them is resolved
 * from the same prebuilt index the assistant uses. Keeps this page from
 * embedding the whole catalogue just to render a handful of rows.
 */
export function SavedLists() {
  const [docs, setDocs] = React.useState<SearchDoc[] | null>(null)
  const [failed, setFailed] = React.useState(false)
  const { bookmarks, toggle } = useBookmarks()
  const recent = useRecentlyViewed()
  const hydrated = useHydrated()

  React.useEffect(() => {
    let cancelled = false
    fetch("/search-index.json")
      .then((response) => {
        if (!response.ok) throw new Error(String(response.status))
        return response.json() as Promise<SearchDoc[]>
      })
      .then((loaded) => !cancelled && setDocs(loaded))
      .catch(() => !cancelled && setFailed(true))
    return () => {
      cancelled = true
    }
  }, [])

  const byId = React.useMemo(
    () => new Map((docs ?? []).map((doc) => [doc.id, doc])),
    [docs]
  )

  const savedDocs = bookmarks
    .map((id) => byId.get(id))
    .filter((doc): doc is SearchDoc => Boolean(doc))

  const recentDocs = recent
    .map((entry) => byId.get(entry.id))
    .filter((doc): doc is SearchDoc => Boolean(doc))

  // An id with no matching repo means the catalogue changed under a saved link.
  const missingSaved = bookmarks.length - savedDocs.length

  if (failed) {
    return (
      <p className="text-sm text-destructive">
        The catalogue index failed to load, so saved repos cannot be shown.
        Reload the page to try again.
      </p>
    )
  }

  const loading = !hydrated || docs === null

  return (
    <div className="space-y-10">
      <section className="space-y-4">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="flex items-center gap-2 text-sm font-medium">
            <BookmarkIcon className="size-4 text-muted-foreground" aria-hidden />
            Saved
            {!loading ? (
              <span className="font-mono text-xs text-muted-foreground">
                {savedDocs.length}
              </span>
            ) : null}
          </h2>
          {savedDocs.length > 1 ? (
            <Button variant="outline" size="xs" asChild>
              <Link href={`/compare?ids=${savedDocs.slice(0, 3).map((d) => d.id).join(",")}`}>
                Compare first {Math.min(3, savedDocs.length)}
              </Link>
            </Button>
          ) : null}
        </div>

        {loading ? (
          <ListSkeleton />
        ) : savedDocs.length > 0 ? (
          <>
            <ul className="border-t border-border">
              {savedDocs.map((doc) => (
                <RepoResult key={doc.id} doc={doc} />
              ))}
            </ul>
            {missingSaved > 0 ? (
              <p className="text-xs text-muted-foreground">
                {missingSaved} saved{" "}
                {missingSaved === 1 ? "entry is" : "entries are"} no longer in the
                catalogue and cannot be shown.
              </p>
            ) : null}
            <div className="flex flex-wrap gap-2">
              {savedDocs.map((doc) => (
                <button
                  key={doc.id}
                  type="button"
                  onClick={() => toggle(doc.id)}
                  className="rounded-sm border border-border px-2 py-1 font-mono text-xs text-muted-foreground transition-colors hover:border-destructive/50 hover:text-destructive focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
                >
                  Remove {doc.owner}/{doc.name}
                </button>
              ))}
            </div>
          </>
        ) : (
          <EmptyState
            icon={BookmarkIcon}
            title="Nothing saved yet"
            description="The Save button on any repo adds it here. Saved repos live in this browser only — there is no account and nothing is sent anywhere."
            action={
              <Button variant="outline" size="sm" asChild>
                <Link href="/explore">Browse the catalogue</Link>
              </Button>
            }
          />
        )}
      </section>

      <section className="space-y-4">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="flex items-center gap-2 text-sm font-medium">
            <ClockIcon className="size-4 text-muted-foreground" aria-hidden />
            Recently viewed
          </h2>
          {recentDocs.length > 0 ? (
            <Button
              variant="ghost"
              size="xs"
              onClick={() => clearRecent()}
            >
              Clear
            </Button>
          ) : null}
        </div>

        {loading ? (
          <ListSkeleton />
        ) : recentDocs.length > 0 ? (
          <ul className="border-t border-border">
            {recentDocs.map((doc) => (
              <RepoResult key={doc.id} doc={doc} />
            ))}
          </ul>
        ) : (
          <EmptyState
            icon={ClockIcon}
            title="No history yet"
            description="Repos you open show up here, most recent first."
          />
        )}
      </section>
    </div>
  )
}

function ListSkeleton() {
  return (
    <div className="space-y-3 border-t border-border pt-3">
      {Array.from({ length: 3 }).map((_, index) => (
        <div key={index} className="space-y-2">
          <Skeleton className="h-4 w-48" />
          <Skeleton className="h-3 w-full max-w-prose" />
        </div>
      ))}
    </div>
  )
}
