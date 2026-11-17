"use client"

import * as React from "react"
import { animate, useInView, useReducedMotion } from "motion/react"

/**
 * Counts a number up the first time it is visible.
 *
 * Two things keep this from causing layout shift, which matters because the
 * number is changing width-by-digit as it runs:
 *
 *  - the final value is rendered on the server and in the initial HTML, so
 *    the element is already its full size before any animation starts;
 *  - the callers are all mono or `tabular-nums`, where every digit is the
 *    same width, so counting cannot reflow the line.
 *
 * Under reduced motion it simply renders the number, with no timer at all.
 */
export function CountUp({
  value,
  format = (n: number) => n.toLocaleString(),
  duration = 0.9,
  className,
}: {
  value: number
  format?: (value: number) => string
  duration?: number
  className?: string
}) {
  const ref = React.useRef<HTMLSpanElement>(null)
  const inView = useInView(ref, { once: true, margin: "0px 0px -40px 0px" })
  const reduced = useReducedMotion() ?? false

  // Seeded with the final value so the server HTML and the first client paint
  // agree. Hydration would otherwise mismatch on every one of these.
  const [display, setDisplay] = React.useState(value)
  const started = React.useRef(false)

  React.useEffect(() => {
    if (reduced || !inView || started.current) return
    started.current = true

    const controls = animate(0, value, {
      duration,
      ease: [0.16, 1, 0.3, 1],
      onUpdate: (latest) => setDisplay(Math.round(latest)),
    })

    return () => controls.stop()
  }, [inView, reduced, value, duration])

  return (
    <span ref={ref} className={className}>
      {format(display)}
    </span>
  )
}
