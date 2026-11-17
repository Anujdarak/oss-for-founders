import Link from "next/link"

import { AskTrigger } from "@/components/chat/ask-slideover"
import { CommandPaletteTrigger } from "@/components/command-palette"
import { ThemeToggle } from "@/components/theme-toggle"
import { SITE } from "@/lib/site"

const NAV = [
  { href: "/explore", label: "Explore" },
  { href: "/gems", label: "Gems" },
  { href: "/stacks", label: "Stacks" },
  { href: "/saved", label: "Saved" },
]

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-40 border-b border-border bg-background">
      <div className="mx-auto flex h-14 w-full max-w-5xl items-center gap-3 px-4 sm:gap-6">
        <Link
          href="/"
          className="shrink-0 text-sm font-medium transition-colors hover:text-muted-foreground focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
        >
          {SITE.name}
        </Link>

        {/* Visible at every width on purpose: these were once hidden below the
            sm breakpoint, which left phones with no navigation at all. */}
        <nav className="flex min-w-0 items-center gap-3 overflow-x-auto text-sm text-muted-foreground sm:gap-4">
          {NAV.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="link-underline whitespace-nowrap transition-colors hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
            >
              {item.label}
            </Link>
          ))}
          <AskTrigger />
        </nav>

        <div className="ml-auto flex shrink-0 items-center gap-2">
          <CommandPaletteTrigger />
          <ThemeToggle />
        </div>
      </div>
    </header>
  )
}
