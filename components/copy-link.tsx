"use client"

import * as React from "react"
import { AnimatePresence, motion } from "motion/react"
import { CheckIcon, LinkIcon } from "lucide-react"
import { cn } from "cn"

import { DURATION, EASE, SPRING } from "@/lib/motion"

/**
 * Copies a link to the clipboard.
 *
 * The URL is resolved in the browser rather than passed in, so it is correct on
 * localhost, on a preview deployment, and in production without the build
 * needing to know its own hostname. `path` narrows it to a specific page.
 */
export function CopyLink({
  path,
  label = "Copy link",
  className,
}: {
  path?: string
  label?: string
  className?: string
}) {
  const [state, setState] = React.useState<"idle" | "copied" | "failed">("idle")
  const timer = React.useRef<ReturnType<typeof setTimeout> | undefined>(undefined)

  React.useEffect(() => () => clearTimeout(timer.current), [])

  async function copy() {
    const url = path ? new URL(path, window.location.origin).toString() : window.location.href

    try {
      await navigator.clipboard.writeText(url)
      setState("copied")
    } catch {
      // Clipboard access is denied in some contexts (no HTTPS, permissions).
      // Say so rather than showing a success state that did not happen.
      setState("failed")
    }

    clearTimeout(timer.current)
    timer.current = setTimeout(() => setState("idle"), 2_000)
  }

  return (
    <motion.button
      type="button"
      onClick={copy}
      whileTap={{ scale: 0.96 }}
      transition={SPRING}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-sm border border-border px-2 py-1 text-xs text-muted-foreground transition-colors hover:border-foreground/30 hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none",
        className
      )}
    >
      {/* The icon springs in on confirmation. The label cross-fades beneath
          it, so the whole control reads as one change rather than two. */}
      <AnimatePresence initial={false} mode="wait">
        <motion.span
          key={state}
          initial={{ opacity: 0, scale: 0.5 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.5 }}
          transition={SPRING}
          className="inline-flex"
        >
          {state === "copied" ? (
            <CheckIcon className="size-3.5" />
          ) : (
            <LinkIcon className="size-3.5" />
          )}
        </motion.span>
      </AnimatePresence>

      <span aria-live="polite">
        <AnimatePresence initial={false} mode="wait">
          <motion.span
            key={state}
            initial={{ opacity: 0, y: 3 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -3 }}
            transition={{ duration: DURATION.fast, ease: EASE }}
            className="inline-block"
          >
            {state === "copied" ? "Copied" : state === "failed" ? "Copy failed" : label}
          </motion.span>
        </AnimatePresence>
      </span>
    </motion.button>
  )
}
