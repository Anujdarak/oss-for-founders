import { CountUp } from "@/components/motion/count-up"
import { getAllRepos } from "@/lib/data"
import { SITE } from "@/lib/site"

export function SiteFooter() {
  const repos = getAllRepos()

  return (
    <footer className="mt-16 border-t border-border">
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-2 px-4 py-6 text-xs text-muted-foreground">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <p>{SITE.name}. Free and open source, no account required.</p>
          <p className="font-mono sm:ml-auto">
            <CountUp value={repos.length} />{" "}
            {repos.length === 1 ? "repository" : "repositories"}
          </p>
        </div>
        {/* The stats disclaimer used to sit here. It still runs on /gems,
            /r/… and /stacks/… — the pages that actually show stars and issue
            counts — which is where a note about where the numbers came from
            belongs. In the footer it was just the last thing on every page. */}
        <p className="max-w-prose border-t border-border pt-2">
          Built to help founders and solo builders find a working tool fast.
          Not everything is here yet, but what is here is genuinely useful —
          and more gets added over time.
        </p>
      </div>
    </footer>
  )
}
