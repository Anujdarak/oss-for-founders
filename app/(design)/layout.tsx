import type { Metadata } from "next"
import type { ReactNode } from "react"

import { CommandPalette } from "@/components/command-palette"
import { ThemeProvider } from "@/components/theme-provider"
import { fontVariables } from "@/lib/fonts"
import "../globals.css"

export const metadata: Metadata = {
  title: "Design system",
  robots: { index: false, follow: false },
}

export default function DesignLayout({ children }: { children: ReactNode }) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${fontVariables} h-full antialiased`}
    >
      {/* See the note in (site)/layout.tsx: browser extensions stamp
          attributes onto <body> before hydration. */}
      <body
        suppressHydrationWarning
        className="min-h-full bg-background text-foreground"
      >
        {/* Pinned to light so the page can nest a `.dark` subtree and show both
            themes at once. The dark variant is `&:is(.dark *)`, so a light
            panel inside a dark document would otherwise inherit dark styles. */}
        <ThemeProvider attribute="class" forcedTheme="light">
          {children}
          <CommandPalette />
        </ThemeProvider>
      </body>
    </html>
  )
}
