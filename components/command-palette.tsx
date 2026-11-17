"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import {
  BookmarkIcon,
  CompassIcon,
  GemIcon,
  GitCompareIcon,
  LayersIcon,
  PlusIcon,
  LayoutGridIcon,
  PaletteIcon,
  SearchIcon,
  SparkleIcon,
} from "lucide-react"

import {
  Command,
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command"
import { useHydrated } from "@/hooks/use-hydrated"

const OPEN_EVENT = "command-palette:open"

const PAGES = [
  { label: "Home", href: "/", icon: LayoutGridIcon },
  { label: "Explore all repositories", href: "/explore", icon: CompassIcon },
  { label: "Ask the assistant", href: "/ask", icon: SparkleIcon },
  { label: "Hidden gems", href: "/gems", icon: GemIcon },
  { label: "Stacks", href: "/stacks", icon: LayersIcon },
  { label: "Saved", href: "/saved", icon: BookmarkIcon },
  { label: "Compare repos", href: "/compare", icon: GitCompareIcon },
  { label: "Submit a repo", href: "/submit", icon: PlusIcon },
  { label: "Design system", href: "/design", icon: PaletteIcon },
]

/**
 * The trigger is separate from the dialog so it can appear in several places
 * (header, design gallery) without each copy registering its own global
 * shortcut and opening a second dialog.
 */
export function CommandPaletteTrigger() {
  // Guarded by `hydrated`, so `navigator` is only read on the client.
  const isMac =
    useHydrated() && /mac|iphone|ipad/i.test(navigator.userAgent)

  return (
    <button
      type="button"
      onClick={() => window.dispatchEvent(new Event(OPEN_EVENT))}
      /**
       * The visible label is `hidden sm:inline`, so under 640px this is an
       * icon-only button with no accessible name at all — it was failing
       * axe's button-name check on every page of the site at mobile widths.
       * The label stays on at every width for screen readers.
       */
      aria-label="Search repositories"
      className="flex h-7 items-center gap-2 rounded-md border border-border bg-background px-2 text-xs text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
    >
      <SearchIcon className="size-3.5" />
      <span className="hidden sm:inline">Search</span>
      <kbd className="hidden font-mono text-[0.6875rem] text-muted-foreground sm:inline">
        {isMac ? "⌘" : "Ctrl "}K
      </kbd>
    </button>
  )
}

/** Mount exactly once per document. Owns the shortcut and the dialog. */
export function CommandPalette() {
  const [open, setOpen] = useState(false)
  const router = useRouter()

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key.toLowerCase() === "k" && (event.metaKey || event.ctrlKey)) {
        event.preventDefault()
        setOpen((previous) => !previous)
      }
    }
    function onOpen() {
      setOpen(true)
    }

    document.addEventListener("keydown", onKeyDown)
    window.addEventListener(OPEN_EVENT, onOpen)
    return () => {
      document.removeEventListener("keydown", onKeyDown)
      window.removeEventListener(OPEN_EVENT, onOpen)
    }
  }, [])

  return (
    <CommandDialog open={open} onOpenChange={setOpen}>
      {/* CommandDialog does not provide the cmdk root context itself, so the
          Command wrapper is required or CommandInput throws. */}
      <Command>
        <CommandInput placeholder="Go to a page..." />
        <CommandList>
          <CommandEmpty>
            No matching page. For repository search, try Explore or Ask.
          </CommandEmpty>
          <CommandGroup heading="Pages">
            {PAGES.map((page) => (
              <CommandItem
                key={page.href}
                value={page.label}
                onSelect={() => {
                  setOpen(false)
                  router.push(page.href)
                }}
              >
                <page.icon />
                {page.label}
              </CommandItem>
            ))}
          </CommandGroup>
        </CommandList>
      </Command>
    </CommandDialog>
  )
}
