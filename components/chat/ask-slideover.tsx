"use client"

import * as React from "react"
import Link from "next/link"
import { Dialog as DialogPrimitive } from "radix-ui"
import { SparkleIcon, XIcon } from "lucide-react"

import { Button } from "@/components/ui/button"
import { ChatPanel } from "@/components/chat/chat-panel"

const OPEN_EVENT = "ask:open"

/**
 * Opens the assistant from anywhere without each trigger owning a dialog.
 * Same pattern as the command palette: triggers dispatch an event, one mounted
 * slide-over listens.
 */
export function openAsk(query?: string) {
  window.dispatchEvent(new CustomEvent(OPEN_EVENT, { detail: { query } }))
}

/**
 * Built on the Radix dialog primitives rather than the shared `DialogContent`,
 * which hard-codes centre positioning. A slide-over needs the right edge and
 * full height.
 */
export function AskSlideOver() {
  const [open, setOpen] = React.useState(false)
  const [query, setQuery] = React.useState<string | undefined>(undefined)

  React.useEffect(() => {
    function onOpen(event: Event) {
      const detail = (event as CustomEvent<{ query?: string }>).detail
      setQuery(detail?.query?.trim() || undefined)
      setOpen(true)
    }
    window.addEventListener(OPEN_EVENT, onOpen)
    return () => window.removeEventListener(OPEN_EVENT, onOpen)
  }, [])

  return (
    <DialogPrimitive.Root open={open} onOpenChange={setOpen}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-black/10 duration-100 supports-backdrop-filter:backdrop-blur-xs data-open:animate-in data-open:fade-in-0 data-closed:animate-out data-closed:fade-out-0" />
        <DialogPrimitive.Content
          // Full width on a phone, a panel on larger screens.
          className="fixed inset-y-0 right-0 z-50 flex w-full flex-col gap-3 border-l border-border bg-background p-4 outline-none data-open:animate-in data-open:duration-300 data-open:ease-[cubic-bezier(0.16,1,0.3,1)] data-open:slide-in-from-right data-closed:animate-out data-closed:duration-200 data-closed:slide-out-to-right sm:max-w-xl"
        >
          <div className="flex items-start justify-between gap-3">
            <div className="space-y-0.5">
              <DialogPrimitive.Title className="flex items-center gap-2 text-sm font-medium">
                <SparkleIcon className="size-4 text-muted-foreground" aria-hidden />
                Ask the assistant
              </DialogPrimitive.Title>
              {/* "No model, nothing sent anywhere" stopped being true when
                  retrieval moved to the server and an optional LLM was added.
                  What is still true, in every configuration, is that the
                  answer can only contain repos from the data files. */}
              <DialogPrimitive.Description className="text-xs text-muted-foreground">
                Searches this catalogue only. No account, and every result is a
                repo from the data files.
              </DialogPrimitive.Description>
            </div>
            <div className="flex items-center gap-1">
              <Button variant="ghost" size="xs" asChild>
                <Link href="/ask" onClick={() => setOpen(false)}>
                  Open full page
                </Link>
              </Button>
              <DialogPrimitive.Close asChild>
                <Button variant="ghost" size="icon-sm" aria-label="Close">
                  <XIcon />
                </Button>
              </DialogPrimitive.Close>
            </div>
          </div>

          <ChatPanel autoFocus initialQuery={query} className="min-h-0 flex-1" />
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  )
}

/** Header trigger. */
export function AskTrigger() {
  return (
    <button
      type="button"
      onClick={() => openAsk()}
      className="transition-colors hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
    >
      Ask
    </button>
  )
}
