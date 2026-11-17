"use client"

import { useTheme } from "next-themes"
import { AnimatePresence, motion } from "motion/react"
import { MoonIcon, SunIcon } from "lucide-react"

import { Button } from "@/components/ui/button"
import { useHydrated } from "@/hooks/use-hydrated"
import { DURATION, EASE } from "@/lib/motion"

export function ThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme()
  const hydrated = useHydrated()
  const isDark = hydrated && resolvedTheme === "dark"
  const Icon = isDark ? SunIcon : MoonIcon

  return (
    <Button
      variant="ghost"
      size="icon-sm"
      onClick={() => setTheme(isDark ? "light" : "dark")}
      aria-label={isDark ? "Switch to light theme" : "Switch to dark theme"}
      // The icons are absolutely positioned while swapping so the outgoing and
      // incoming one occupy the same spot. Without this the button would
      // briefly hold two icons and change width mid-animation.
      className="relative overflow-hidden"
    >
      <AnimatePresence initial={false} mode="popLayout">
        <motion.span
          key={isDark ? "sun" : "moon"}
          initial={{ opacity: 0, rotate: -70, scale: 0.6 }}
          animate={{ opacity: 1, rotate: 0, scale: 1 }}
          exit={{ opacity: 0, rotate: 70, scale: 0.6 }}
          transition={{ duration: DURATION.base, ease: EASE }}
          className="inline-flex"
        >
          <Icon />
        </motion.span>
      </AnimatePresence>
    </Button>
  )
}
