"use client"

import { AnimatePresence, motion } from "motion/react"
import { BookmarkIcon } from "lucide-react"
import { cn } from "cn"

import { useBookmarks } from "@/hooks/use-local-store"
import { DURATION, EASE, SPRING } from "@/lib/motion"

/**
 * Saved repos live in localStorage, so the button renders in its unsaved state
 * on the server and corrects itself once hydrated. That is handled by the
 * store's server snapshot rather than an effect.
 */
export function BookmarkButton({
  id,
  label,
  className,
}: {
  id: string
  /** Shown next to the icon. Omit for an icon-only button. */
  label?: boolean
  className?: string
}) {
  const { isBookmarked, toggle } = useBookmarks()
  const saved = isBookmarked(id)

  return (
    <motion.button
      type="button"
      onClick={() => toggle(id)}
      aria-pressed={saved}
      aria-label={saved ? "Remove from saved" : "Save this repo"}
      // A small press on tap. Scale rather than size, so neighbouring controls
      // never move.
      whileTap={{ scale: 0.94 }}
      transition={SPRING}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-sm border px-2 py-1 text-xs transition-colors focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none",
        saved
          ? "border-primary text-primary"
          : "border-border text-muted-foreground hover:border-foreground/30 hover:text-foreground",
        className
      )}
    >
      <AnimatePresence initial={false} mode="wait">
        <motion.span
          key={saved ? "saved" : "unsaved"}
          initial={{ opacity: 0, scale: 0.5 }}
          // Scales up to 1 with a spring, which is the "pop". Deliberately the
          // only springy thing on the site: it marks the one action that
          // writes stored state.
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.5 }}
          transition={SPRING}
          className="inline-flex"
        >
          <BookmarkIcon className={cn("size-3.5", saved && "fill-current")} />
        </motion.span>
      </AnimatePresence>

      {label ? (
        <AnimatePresence initial={false} mode="wait">
          <motion.span
            key={saved ? "on" : "off"}
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: DURATION.fast, ease: EASE }}
          >
            {saved ? "Saved" : "Save"}
          </motion.span>
        </AnimatePresence>
      ) : (
        <span className="sr-only">Save</span>
      )}
    </motion.button>
  )
}
