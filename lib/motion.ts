import type { Transition, Variants } from "motion/react"

/**
 * Shared motion vocabulary.
 *
 * Everything here animates `transform` and `opacity` only. Those two are the
 * properties the compositor can handle without touching layout or paint, so
 * nothing here can push the page around or cause a layout shift — which also
 * means none of it can hurt CLS.
 *
 * Durations stay in the 150-400ms band and easing is ease-out or a soft,
 * non-overshooting spring. Motion here is meant to explain where something
 * came from, not to be noticed.
 */

/** Matches Tailwind's default transition duration, which the CSS hovers use. */
export const DURATION = {
  fast: 0.15,
  base: 0.22,
  slow: 0.32,
} as const

/** Ease-out. Quick to start, settles gently — reads as responsive rather than slow. */
export const EASE = [0.16, 1, 0.3, 1] as const

/** A spring with no visible overshoot. Used for panels and the press feedback. */
export const SPRING: Transition = {
  type: "spring",
  stiffness: 380,
  damping: 32,
  mass: 0.8,
}

/** The distance things travel when they rise into place. Deliberately small. */
export const RISE = 10

export const fadeRise: Variants = {
  hidden: { opacity: 0, y: RISE },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: DURATION.slow, ease: EASE },
  },
}

export const fade: Variants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { duration: DURATION.base, ease: EASE } },
}

/**
 * Stagger container. The child delay is small on purpose: at 60ms a twelve-item
 * list finishes in under a second, where 150ms would leave the last card
 * arriving long after the reader has started looking at it.
 */
export function staggerContainer(stagger = 0.06, delayChildren = 0): Variants {
  return {
    hidden: {},
    visible: {
      transition: { staggerChildren: stagger, delayChildren },
    },
  }
}

/**
 * Reordering spring: slower and softer than the interaction one, because
 * many elements move at once and interaction speed reads as a jolt.
 */
export const SPRING_LAYOUT: Transition = {
  type: "spring",
  stiffness: 260,
  damping: 34,
  mass: 0.9,
}

/**
 * There is deliberately no "reduced variants" export.
 *
 * Swapping variants when `useReducedMotion` resolves is a trap: the hook is
 * null on the server, so elements mount with the full variants and then have
 * them replaced, leaving any transform in the old variant unwound. Reduced
 * motion is handled once by `MotionConfig reducedMotion="user"`.
 */

/** Viewport config for reveal-on-scroll: fire once, slightly before the edge. */
export const VIEWPORT = { once: true, margin: "0px 0px -80px 0px" } as const
