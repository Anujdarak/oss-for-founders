"use client"

import * as React from "react"
import { SparkleIcon } from "lucide-react"

import { Button } from "@/components/ui/button"
import { openAsk } from "@/components/chat/ask-slideover"
import { SUGGESTED_PROMPTS } from "@/lib/assistant/prompts"

/**
 * The homepage entry point. Submitting hands the question to the slide-over,
 * which answers it against the catalogue index -- so the box does what it looks
 * like it does, rather than being decorative.
 */
export function AskBox() {
  const [value, setValue] = React.useState("")

  return (
    <div className="max-w-xl space-y-2">
      <form
        className="flex items-center gap-2"
        onSubmit={(event) => {
          event.preventDefault()
          openAsk(value)
        }}
      >
        <div className="relative flex h-10 min-w-0 flex-1 origin-left items-center rounded-lg border border-input transition-[border-color,box-shadow,transform] duration-200 ease-out focus-within:scale-[1.01] focus-within:border-ring focus-within:ring-3 focus-within:ring-ring/50 dark:bg-input/30">
          <SparkleIcon
            className="pointer-events-none absolute left-3 size-4 text-muted-foreground"
            aria-hidden
          />
          <input
            value={value}
            onChange={(event) => setValue(event.target.value)}
            placeholder="What are you trying to build?"
            aria-label="Describe what you are trying to build"
            className="h-full w-full bg-transparent pr-3 pl-9 text-sm placeholder:text-muted-foreground focus-visible:outline-none"
          />
        </div>
        <Button type="submit" className="h-10 shrink-0">
          Ask the assistant
        </Button>
      </form>

      <div className="flex flex-wrap items-center gap-1.5">
        {SUGGESTED_PROMPTS.slice(0, 3).map((prompt) => (
          <button
            key={prompt}
            type="button"
            onClick={() => openAsk(prompt)}
            className="rounded-sm border border-border px-2 py-1 text-xs text-muted-foreground transition-colors hover:border-foreground/30 hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
          >
            {prompt}
          </button>
        ))}
      </div>
    </div>
  )
}
