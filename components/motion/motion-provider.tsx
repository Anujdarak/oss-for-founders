"use client"

import type { ReactNode } from "react"
import { MotionConfig } from "motion/react"

/**
 * Global motion configuration.
 *
 * `reducedMotion="user"` is what makes the whole site honour the preference,
 * and it replaced a hand-rolled approach that was actively broken. The old
 * code read `useReducedMotion()` in each component and swapped the variants
 * object when it was true — but that hook returns `null` on the server and
 * only resolves after mount, so elements mounted with the full variants
 * (`opacity: 0, y: 12`), then had the variants swapped underneath them. The
 * target variant *name* never changed, so Framer had no reason to re-animate,
 * and the replacement variant had no `y` key to unwind the transform. The
 * result was a hero stuck invisible and 12px low for anyone with the
 * preference set — the exact failure the swap was supposed to prevent.
 *
 * With this, components declare one set of variants and Framer drops the
 * transform half while still running opacity. One code path, no timing hazard.
 */
export function MotionProvider({ children }: { children: ReactNode }) {
  return <MotionConfig reducedMotion="user">{children}</MotionConfig>
}
