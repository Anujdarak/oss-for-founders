"use client"

import * as React from "react"
import { motion } from "motion/react"

import {
  DURATION,
  EASE,
  fadeRise,
  SPRING_LAYOUT,
  staggerContainer,
  VIEWPORT,
} from "@/lib/motion"

/**
 * Motion wrappers that keep their children server-rendered.
 *
 * Only these wrappers are client components; whatever is passed as `children`
 * is rendered on the server and handed through as an already-built React
 * element. That matters here — the catalogue pages are server components over
 * ~4,900 repos, and making them client components to animate a fade would
 * ship the whole catalogue to the browser.
 *
 * None of these branch on `useReducedMotion`. The preference is handled once,
 * globally, by `MotionConfig reducedMotion="user"` in `MotionProvider`; see
 * the note there for why doing it per-component stranded elements mid-animation.
 */

type DivProps = React.ComponentProps<"div">

/** Fades and rises on mount. For content that is present at first paint. */
export function Reveal({
  children,
  delay = 0,
  className,
}: {
  children: React.ReactNode
  delay?: number
  className?: string
}) {
  return (
    <motion.div
      className={className}
      initial="hidden"
      animate="visible"
      variants={fadeRise}
      transition={{ delay }}
    >
      {children}
    </motion.div>
  )
}

/**
 * Fades and rises when scrolled into view, once.
 *
 * `once` is not negotiable: re-animating on every scroll past turns a list
 * into a flicker and makes long pages feel unstable.
 */
export function RevealOnScroll({
  children,
  className,
  ...rest
}: { children: React.ReactNode } & DivProps) {
  return (
    <motion.div
      className={className}
      initial="hidden"
      whileInView="visible"
      viewport={VIEWPORT}
      variants={fadeRise}
      {...(rest as Record<string, unknown>)}
    >
      {children}
    </motion.div>
  )
}

/** Staggers direct children in as the group enters the viewport. */
export function StaggerGroup({
  children,
  className,
  stagger = 0.06,
  delayChildren = 0,
  as: Tag = "div",
}: {
  children: React.ReactNode
  className?: string
  stagger?: number
  delayChildren?: number
  as?: "div" | "ul" | "ol" | "section"
}) {
  const MotionTag = motion[Tag]

  return (
    <MotionTag
      className={className}
      initial="hidden"
      whileInView="visible"
      viewport={VIEWPORT}
      variants={staggerContainer(stagger, delayChildren)}
    >
      {children}
    </MotionTag>
  )
}

export function StaggerItem({
  children,
  className,
  as: Tag = "div",
  layout = false,
}: {
  children: React.ReactNode
  className?: string
  as?: "div" | "li"
  /**
   * Animate this item to its new position when the list reorders.
   *
   * Off by default, and currently off everywhere. Framer's layout animations
   * work by letting the real layout change and then transforming back, which
   * the browser records as a genuine layout shift — measured at CLS 0.43 on a
   * two-column grid. See NOTES.md.
   */
  layout?: boolean
}) {
  const MotionTag = motion[Tag]

  return (
    <MotionTag
      className={className}
      variants={fadeRise}
      layout={layout ? "position" : false}
      transition={layout ? SPRING_LAYOUT : undefined}
    >
      {children}
    </MotionTag>
  )
}

/**
 * The hero sequence: each child one after another, slightly slower than a list
 * because there are only a few of them and they are the first thing read.
 */
export function Sequence({
  children,
  className,
}: {
  children: React.ReactNode
  className?: string
}) {
  return (
    <motion.div
      className={className}
      initial="hidden"
      animate="visible"
      variants={staggerContainer(0.08)}
    >
      {children}
    </motion.div>
  )
}

const sequenceItem = {
  hidden: { opacity: 0, y: 12 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: DURATION.slow, ease: EASE },
  },
}

export function SequenceItem({
  children,
  className,
}: {
  children: React.ReactNode
  className?: string
}) {
  return (
    <motion.div className={className} variants={sequenceItem}>
      {children}
    </motion.div>
  )
}
