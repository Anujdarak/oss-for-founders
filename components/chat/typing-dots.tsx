"use client"

import { motion, useReducedMotion } from "motion/react"

/**
 * The "thinking" indicator.
 *
 * This is the one looping animation on the site. The rule against looping
 * motion is about decoration; a loop here is the signal itself — it says work
 * is still in progress, and a static version would be indistinguishable from
 * a stalled request.
 *
 * Under reduced motion it becomes static text, because three pulsing dots are
 * exactly the kind of repetitive movement the preference exists to avoid, and
 * "Searching…" carries the same information.
 */
export function TypingDots({ label = "Searching the catalogue" }: { label?: string }) {
  const reduced = useReducedMotion() ?? false

  if (reduced) {
    return (
      <p className="text-sm text-muted-foreground" role="status" aria-live="polite">
        {label}…
      </p>
    )
  }

  return (
    <div
      className="flex items-center gap-1.5"
      role="status"
      aria-live="polite"
      aria-label={label}
    >
      <span className="sr-only">{label}</span>
      {[0, 1, 2].map((index) => (
        <motion.span
          key={index}
          aria-hidden
          className="size-1.5 rounded-full bg-muted-foreground/60"
          // Opacity and transform only, so the loop stays on the compositor
          // and costs nothing while it runs.
          animate={{ opacity: [0.3, 1, 0.3], y: [0, -2, 0] }}
          transition={{
            duration: 1,
            repeat: Infinity,
            ease: "easeInOut",
            // A small offset per dot is what reads as a wave rather than
            // three things blinking together.
            delay: index * 0.14,
          }}
        />
      ))}
    </div>
  )
}
