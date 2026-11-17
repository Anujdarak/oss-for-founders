"use client"

import { motion, useScroll, useSpring } from "motion/react"

/**
 * A 2px reading-progress bar, pinned under the header.
 *
 * Driven by `scaleX` on a full-width element rather than by animating
 * `width`, so it never triggers layout — the browser composites it and
 * nothing else on the page is touched as it moves.
 *
 * Hidden under reduced motion by CSS, not by returning null. Returning null
 * from a hook that resolves differently on the server and the client is a
 * hydration mismatch -- it threw React #418 on every detail page for anyone
 * with the preference set. `motion-reduce:hidden` reaches the same result
 * with markup that is identical on both sides.
 */
export function ScrollProgress() {
  const { scrollYProgress } = useScroll()

  // The raw value is jumpy on a trackpad; the spring smooths it without
  // adding noticeable lag.
  const scaleX = useSpring(scrollYProgress, {
    stiffness: 180,
    damping: 30,
    restDelta: 0.001,
  })

  return (
    <motion.div
      aria-hidden
      style={{ scaleX }}
      className="fixed inset-x-0 top-14 z-30 h-0.5 origin-left bg-primary/60 motion-reduce:hidden"
    />
  )
}
