"use client"

import * as React from "react"
import { usePathname } from "next/navigation"
import { motion } from "motion/react"

import { useHydrated } from "@/hooks/use-hydrated"
import { DURATION, EASE } from "@/lib/motion"

/**
 * Route transition.
 *
 * Enter only, no exit. An exit would hold the old page on screen while the new
 * one is already ready, which makes every navigation slower to feel. The rise
 * is 6px rather than the usual 10 because a whole page moving reads much
 * larger than one card moving.
 *
 * **The first load is deliberately not animated**, and that is a performance
 * fix rather than a taste call. Wrapping the page in `opacity: 0` and fading
 * it up meant Lighthouse saw no painted content until the fade finished:
 * largest-contentful-paint went from 1.1s to 3.9s and the performance score
 * dropped 76 to 67. An element at zero opacity does not count as painted, so
 * an entrance animation on above-the-fold content directly delays LCP.
 *
 * `useHydrated()` is false during SSR and the first client render, so the
 * initial page renders straight at its final state. The element is not
 * remounted when the flag flips — the `key` is unchanged — so nothing animates
 * retroactively. A real navigation changes the key, mounts a new element, and
 * that one animates.
 */
export function PageTransition({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const hydrated = useHydrated()

  return (
    <motion.div
      key={pathname}
      initial={hydrated ? { opacity: 0, y: 6 } : false}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: DURATION.base, ease: EASE }}
    >
      {children}
    </motion.div>
  )
}
