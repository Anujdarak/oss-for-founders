import {
  formatScore,
  SCORE_EXPLANATIONS,
  SCORE_LABELS,
  SCORE_WEIGHTS,
} from "@/lib/scoring"
import type { RepoScore } from "@/lib/schema"

const COMPONENTS = Object.keys(SCORE_WEIGHTS) as (keyof typeof SCORE_WEIGHTS)[]

/**
 * Shows the whole score, not just the number: each component, what it measures,
 * how much it counts, and what this repo got. A score nobody can audit is worth
 * less than no score, which is the whole reason the breakdown is stored.
 */
export function ScoreBreakdown({ score }: { score: RepoScore }) {
  return (
    <div className="space-y-3">
      <div className="flex items-baseline gap-2">
        <span className="font-mono text-lg">{formatScore(score.total)}</span>
        <span className="text-xs text-muted-foreground">out of 1.00</span>
      </div>

      <dl className="space-y-2">
        {COMPONENTS.map((component) => {
          const value = score[component]
          const weight = SCORE_WEIGHTS[component]

          return (
            /**
             * A `<div>` inside a `<dl>` may contain nothing but `<dt>` and
             * `<dd>`. This previously wrapped the pair in a flex div and put
             * the bar and the explanation alongside it, which made the dt/dd
             * grandchildren of the list and failed both `definition-list` and
             * `dlitem`. The row is a two-column grid instead, and the bar and
             * explanation moved inside a second `<dd>` — one term may have
             * several descriptions, so that stays valid. Layout is unchanged.
             */
            <div
              key={component}
              className="grid grid-cols-[1fr_auto] items-baseline gap-x-3 gap-y-1"
            >
              <dt className="text-sm">
                {SCORE_LABELS[component]}
                <span className="ml-1.5 font-mono text-xs text-muted-foreground">
                  ×{weight.toFixed(2)}
                </span>
              </dt>
              <dd className="font-mono text-xs text-muted-foreground">
                {formatScore(value)}
              </dd>

              <dd className="col-span-2 space-y-1">
                {/* A 1px-bordered track rather than a filled bar chart, to
                    stay inside the design rules. */}
                <div
                  className="h-1 w-full overflow-hidden rounded-sm border border-border"
                  role="img"
                  aria-label={`${SCORE_LABELS[component]}: ${formatScore(value)} out of 1`}
                >
                  <div
                    className="h-full bg-primary"
                    style={{ width: `${Math.round(value * 100)}%` }}
                  />
                </div>

                <p className="text-xs text-muted-foreground">
                  {SCORE_EXPLANATIONS[component]}
                </p>
              </dd>
            </div>
          )
        })}
      </dl>
    </div>
  )
}

/** The collapsed form used in lists: total only, with the detail behind a toggle. */
export function ScoreSummary({ score }: { score: RepoScore }) {
  return (
    <details className="group">
      <summary className="inline-flex cursor-pointer list-none items-center gap-2 text-xs text-muted-foreground transition-colors hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none">
        <span className="font-mono">score {formatScore(score.total)}</span>
        {/* Both inherit `text-muted-foreground` from the summary. Dimming it
            a further 30% measured 2.71:1 at this size, below the AA floor. */}
        <span className="group-open:hidden">show breakdown</span>
        <span className="hidden group-open:inline">hide breakdown</span>
      </summary>
      <div className="mt-3 border-l border-border pl-3">
        <ScoreBreakdown score={score} />
      </div>
    </details>
  )
}
