import Link from "next/link"

import { CategoryIcon } from "@/components/category-icon"
import { CountUp } from "@/components/motion/count-up"
import { StaggerGroup, StaggerItem } from "@/components/motion/reveal"
import { CATEGORIES, CATEGORY_META, type Category } from "@/lib/categories"

/**
 * Dense rows rather than cards: icon, name, count, one line. The whole row is
 * the link so the hit target matches what it looks like.
 */
export function CategoryList({
  counts,
}: {
  counts: Record<Category, number>
}) {
  return (
    <StaggerGroup
      as="ul"
      className="divide-y divide-border border-y border-border"
      stagger={0.04}
    >
      {CATEGORIES.map((category) => {
        const meta = CATEGORY_META[category]
        const count = counts[category]

        return (
          // `relative hover:z-10` for the same reason as the repo grid: the
          // item is a motion element, a transform on it makes it a stacking
          // context, and the next row's divider would otherwise paint across
          // the swell.
          <StaggerItem as="li" key={category} className="relative hover:z-10">
            <Link
              href={`/c/${category}`}
              className="group relative isolate flex items-baseline gap-3 px-1 py-3 focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none sm:gap-4"
            >
              {/**
               * The swell is carried by this band, not by the row itself.
               *
               * Scaling the whole row was the obvious approach and it looked
               * wrong: a row is ~990px wide and ~67px tall, so a uniform 1%
               * grows it 9.9px across but 0.67px down — fifteen to one. It
               * reads as a horizontal stretch, and because the scale is from
               * the centre, the label visibly slides ~5px left.
               *
               * A plain rectangle has no text to distort, so this band can
               * scale unevenly — ~1% across against ~10% down — which works
               * out to roughly 4px of growth on every side. The row's surface
               * inflates on all four edges while the label stays exactly
               * where it was.
               */}
              <span
                aria-hidden
                className="pointer-events-none absolute inset-0 -z-10 rounded-sm bg-muted/50 opacity-0 transition-[opacity,transform] duration-200 ease-out group-hover:scale-x-[1.01] group-hover:scale-y-[1.10] group-hover:opacity-100 motion-reduce:group-hover:scale-x-100 motion-reduce:group-hover:scale-y-100"
              />
              <CategoryIcon
                category={category}
                className="size-4 shrink-0 translate-y-0.5 text-muted-foreground transition-[color,transform] duration-200 ease-out group-hover:scale-110 group-hover:text-foreground"
              />

              <div className="min-w-0 flex-1 space-y-0.5">
                <div className="flex items-baseline gap-2">
                  <span className="text-sm font-medium">{meta.label}</span>
                  <span className="font-mono text-xs text-muted-foreground">
                    <CountUp value={count} />
                  </span>
                </div>
                <p className="text-sm text-muted-foreground">{meta.description}</p>
              </div>
            </Link>
          </StaggerItem>
        )
      })}
    </StaggerGroup>
  )
}
