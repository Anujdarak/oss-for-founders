import type { Metadata } from "next"
import type { ReactNode } from "react"

import { AskSlideOver } from "@/components/chat/ask-slideover"
import { MotionProvider } from "@/components/motion/motion-provider"
import { PageTransition } from "@/components/motion/page-transition"
import { CommandPalette } from "@/components/command-palette"
import { SiteFooter } from "@/components/site-footer"
import { Analytics } from "@/components/analytics"
import { SiteHeader } from "@/components/site-header"
import { ThemeProvider } from "@/components/theme-provider"
import { fontVariables } from "@/lib/fonts"
import { SITE } from "@/lib/site"
import "../globals.css"

export const metadata: Metadata = {
  title: { default: SITE.name, template: `%s · ${SITE.name}` },
  description: SITE.description,
}

export default function SiteLayout({ children }: { children: ReactNode }) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${fontVariables} h-full antialiased`}
    >
      {/* Browser extensions commonly stamp attributes onto <body> before React
          hydrates -- Bitdefender's `bis_skin_checked` is the usual culprit --
          which React reports as a hydration mismatch. Suppressing it here
          covers the body element itself; nothing can cover every nested div an
          extension rewrites, and nothing needs to: it is the visitor's browser
          editing the page, not a defect in it. */}
      <body suppressHydrationWarning className="flex min-h-full flex-col">
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          <MotionProvider>
          {/* Visible only when focused. The header nav scrolls horizontally on
              a phone, so tabbing past it is otherwise slow. */}
          <a
            href="#content"
            className="sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:z-50 focus:rounded-md focus:border focus:border-border focus:bg-background focus:px-3 focus:py-2 focus:text-sm focus:ring-3 focus:ring-ring/50"
          >
            Skip to content
          </a>

          <SiteHeader />
          <main id="content" className="flex-1">
            <PageTransition>{children}</PageTransition>
          </main>
          <SiteFooter />
      <Analytics />
          <CommandPalette />
          <AskSlideOver />
          </MotionProvider>
        </ThemeProvider>
      </body>
    </html>
  )
}
