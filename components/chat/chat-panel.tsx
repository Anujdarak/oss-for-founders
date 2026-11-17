"use client"

import * as React from "react"
import Link from "next/link"
import { AnimatePresence, motion, useReducedMotion } from "motion/react"
import { ArrowUpIcon, PlusIcon, SearchXIcon } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { RepoResult } from "@/components/repo-result"
import { TypingDots } from "@/components/chat/typing-dots"
import { CATEGORY_META } from "@/lib/categories"
import { SUGGESTED_PROMPTS } from "@/lib/assistant/prompts"
import type { Answer, AskEvent, PlanPreview } from "@/lib/assistant/answer-types"
import { DURATION, EASE, fadeRise, staggerContainer } from "@/lib/motion"

type Turn =
  | { kind: "user"; id: string; text: string }
  | { kind: "assistant"; id: string; answer: Answer }
  | { kind: "pending"; id: string; plan?: PlanPreview }
  | { kind: "error"; id: string; text: string }

/**
 * The assistant.
 *
 * Retrieval moved to `/api/ask`. It used to run in the browser over the
 * search index, which is why it could only ever match words: the index is the
 * trimmed documents, and matching "improve my ui ux of my website" against
 * them found whatever mentioned "website". The server route understands the
 * message first, searches once per need, and verifies every id it returns
 * against the data files — so this component still cannot be shown a repo
 * that does not exist, for the same reason as before.
 */
export function ChatPanel({
  autoFocus = false,
  initialQuery,
  className,
}: {
  autoFocus?: boolean
  initialQuery?: string
  className?: string
}) {
  const [turns, setTurns] = React.useState<Turn[]>([])
  const [input, setInput] = React.useState("")
  const [busy, setBusy] = React.useState(false)

  const inputRef = React.useRef<HTMLInputElement>(null)
  const endRef = React.useRef<HTMLDivElement>(null)
  const submittedInitial = React.useRef(false)
  const turnsRef = React.useRef<Turn[]>([])
  turnsRef.current = turns

  const ask = React.useCallback((text: string) => {
    const query = text.trim()
    if (!query) return

    // Built from the ref so a rapid second question still sees the first.
    const history = turnsRef.current
      .filter((turn): turn is Extract<Turn, { kind: "user" }> => turn.kind === "user")
      .map((turn) => turn.text)

    const pendingId = crypto.randomUUID()
    setTurns((previous) => [
      ...previous,
      { kind: "user", id: crypto.randomUUID(), text: query },
      { kind: "pending", id: pendingId },
    ])
    setInput("")
    setBusy(true)

    const replace = (turn: Turn) =>
      setTurns((previous) =>
        previous.map((existing) => (existing.id === pendingId ? turn : existing))
      )

    void (async () => {
      try {
        const response = await fetch("/api/ask", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ message: query, history }),
        })

        if (!response.ok || !response.body) {
          const payload = (await response.json().catch(() => null)) as { error?: string } | null
          throw new Error(payload?.error ?? `The assistant is unavailable (${response.status}).`)
        }

        // NDJSON: the plan arrives before the results, so the needs can be
        // shown while the search is still running.
        const reader = response.body.getReader()
        const decoder = new TextDecoder()
        let buffer = ""
        let answered = false

        for (;;) {
          const { done, value } = await reader.read()
          if (done) break
          buffer += decoder.decode(value, { stream: true })

          const lines = buffer.split("\n")
          buffer = lines.pop() ?? ""

          for (const line of lines) {
            if (!line.trim()) continue
            const event = JSON.parse(line) as AskEvent
            if (event.type === "plan") {
              replace({ kind: "pending", id: pendingId, plan: { goal: event.goal, needs: event.needs } })
            } else if (event.type === "answer") {
              answered = true
              replace({ kind: "assistant", id: pendingId, answer: event.answer })
            } else if (event.type === "error") {
              answered = true
              replace({ kind: "error", id: pendingId, text: event.error })
            }
          }
        }

        if (!answered) replace({ kind: "error", id: pendingId, text: "The assistant stopped early." })
      } catch (error) {
        replace({
          kind: "error",
          id: pendingId,
          text: error instanceof Error ? error.message : "The assistant failed.",
        })
      } finally {
        setBusy(false)
      }
    })()
  }, [])

  React.useEffect(() => {
    if (!initialQuery || submittedInitial.current) return
    submittedInitial.current = true
    ask(initialQuery)
  }, [initialQuery, ask])

  const reduced = useReducedMotion() ?? false

  React.useEffect(() => {
    if (turns.length === 0) return
    endRef.current?.scrollIntoView({ block: "end", behavior: reduced ? "auto" : "smooth" })
  }, [turns, reduced])

  React.useEffect(() => {
    if (autoFocus) inputRef.current?.focus()
  }, [autoFocus])

  return (
    <div className={className}>
      <div className="flex h-full flex-col">
        <div className="flex-1 space-y-6 overflow-y-auto px-1 pb-4">
          {turns.length === 0 ? (
            <Welcome onPick={(prompt) => ask(prompt)} />
          ) : (
            <AnimatePresence initial={false} mode="popLayout">
              {turns.map((turn) => (
                <TurnView key={turn.id} turn={turn} onAsk={ask} />
              ))}
            </AnimatePresence>
          )}
          <div ref={endRef} />
        </div>

        <form
          className="sticky bottom-0 flex items-center gap-2 border-t border-border bg-background pt-3"
          onSubmit={(event) => {
            event.preventDefault()
            ask(input)
          }}
        >
          <input
            ref={inputRef}
            value={input}
            onChange={(event) => setInput(event.target.value)}
            placeholder="What are you trying to build?"
            aria-label="Ask the assistant"
            className="h-9 min-w-0 flex-1 rounded-md border border-input bg-transparent px-3 text-sm transition-colors placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none disabled:opacity-50 dark:bg-input/30"
          />
          <Button type="submit" size="sm" disabled={busy || !input.trim()}>
            <ArrowUpIcon />
            <span className="sr-only sm:not-sr-only">Ask</span>
          </Button>
          {turns.length > 0 ? (
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => {
                setTurns([])
                setInput("")
                inputRef.current?.focus()
              }}
            >
              <PlusIcon />
              <span className="sr-only sm:not-sr-only">New chat</span>
            </Button>
          ) : null}
        </form>
      </div>
    </div>
  )
}

function Welcome({ onPick }: { onPick: (prompt: string) => void }) {
  return (
    <div className="space-y-4 pt-1">
      <div className="space-y-1.5">
        <p className="text-sm font-medium">Describe what you need to build.</p>
        <p className="max-w-prose text-sm text-muted-foreground">
          Describe the problem rather than the tool. This works out which kinds
          of tool the job needs, searches for each one separately, and only
          ever answers with repos from this catalogue.
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        {SUGGESTED_PROMPTS.map((prompt) => (
          <button
            key={prompt}
            type="button"
            onClick={() => onPick(prompt)}
            className="rounded-md border border-border px-2.5 py-1.5 text-left text-xs text-muted-foreground transition-colors hover:border-foreground/30 hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
          >
            {prompt}
          </button>
        ))}
      </div>
    </div>
  )
}

/**
 * Every turn arrives the same way: up and in. One definition, no
 * reduced-motion branch — MotionConfig drops the y and keeps the fade.
 */
const turnAnim = {
  initial: { opacity: 0, y: 12 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -8 },
  transition: { duration: DURATION.slow, ease: EASE },
}

/** The chip style shared by follow-ups and clarifying answers. */
const CHIP =
  "rounded-sm border border-border px-2 py-1 text-xs text-muted-foreground transition-colors hover:border-foreground/30 hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"

function TurnView({ turn, onAsk }: { turn: Turn; onAsk: (text: string) => void }) {
  const anim = turnAnim

  if (turn.kind === "user") {
    return (
      <motion.div layout="position" {...anim} className="flex justify-end">
        <p className="max-w-[85%] rounded-md border border-border bg-muted/50 px-3 py-2 text-sm">
          {turn.text}
        </p>
      </motion.div>
    )
  }

  if (turn.kind === "pending") {
    return (
      <motion.div layout="position" {...anim} className="space-y-2 py-1" aria-busy="true">
        <TypingDots />
        {/* The needs appear as soon as the plan does, which is the part that
            shows the question was read rather than keyword-matched. */}
        {turn.plan && turn.plan.needs.length > 0 ? (
          <p className="max-w-prose text-xs text-muted-foreground">
            Looking for {turn.plan.needs.map((need) => need.label.toLowerCase()).join(", ")}.
          </p>
        ) : null}
      </motion.div>
    )
  }

  if (turn.kind === "error") {
    return (
      <motion.div layout="position" {...anim}>
        <p className="max-w-prose text-sm text-destructive">{turn.text}</p>
      </motion.div>
    )
  }

  const { answer } = turn

  // Too vague to search: ask one question and offer the shelves as chips.
  if (answer.clarifyingQuestion) {
    return (
      <motion.div layout="position" {...anim} className="space-y-3" aria-live="polite">
        <p className="max-w-prose text-sm">{answer.clarifyingQuestion}</p>
        <div className="flex flex-wrap items-center gap-1.5">
          {answer.clarifyOptions.map((option) => (
            <button key={option} type="button" onClick={() => onAsk(option)} className={CHIP}>
              {option}
            </button>
          ))}
        </div>
      </motion.div>
    )
  }

  return (
    <motion.div layout="position" {...anim} className="space-y-4" aria-live="polite">
      <p className="max-w-prose text-sm">{answer.summary}</p>

      {answer.groups.map((group) => (
        <section key={group.key} className="space-y-1">
          <h3 className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
            {group.label}
          </h3>

          {group.items.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              {group.note ?? "Nothing in the catalogue covers this one."}
            </p>
          ) : (
            /* Results arrive one after another rather than all at once, so the
               eye has somewhere to start. 50ms apart: a six-item list finishes
               well before anyone has finished reading the summary above it. */
            <motion.ul
              className="border-t border-border"
              initial="hidden"
              animate="visible"
              variants={staggerContainer(0.05)}
            >
              {group.items.map((item) => (
                <motion.div key={item.doc.id} variants={fadeRise}>
                  <RepoResult doc={item.doc} why={item.why} />
                </motion.div>
              ))}
            </motion.ul>
          )}
        </section>
      ))}

      {answer.empty ? <NoMatch answer={answer} /> : null}

      {answer.followUps.length > 0 && !answer.empty ? (
        <div className="flex flex-wrap items-center gap-1.5">
          {answer.followUps.map((followUp) => (
            <button
              key={followUp.id}
              type="button"
              onClick={() => onAsk(followUp.query)}
              className={CHIP}
            >
              {followUp.label}
            </button>
          ))}
        </div>
      ) : null}
    </motion.div>
  )
}

/** Nothing matched. Say so, point at the nearest shelves, offer a way to fix it. */
function NoMatch({ answer }: { answer: Answer }) {
  return (
    <div className="space-y-3 rounded-lg border border-border px-4 py-4">
      <div className="flex items-center gap-2 text-muted-foreground">
        <SearchXIcon className="size-4" aria-hidden />
        <span className="text-xs font-medium tracking-wide uppercase">No match</span>
      </div>

      {answer.closestCategories.length > 0 ? (
        <div className="space-y-1.5">
          <p className="text-sm text-muted-foreground">Closest categories:</p>
          <div className="flex flex-wrap gap-1.5">
            {answer.closestCategories.map((category) => (
              <Link key={category} href={`/c/${category}`}>
                <Badge variant="outline">{CATEGORY_META[category].label}</Badge>
              </Link>
            ))}
          </div>
        </div>
      ) : null}

      {/* This used to be a "Suggest this repo" button opening a prefilled
          GitHub issue. It pointed at a repository that does not exist, so
          every visitor who clicked it landed on a GitHub 404. Saying what is
          actually true is better than a dead link. */}
      <p className="max-w-prose text-sm text-muted-foreground">
        Nothing in the catalogue covers that yet. More repos are added over
        time, so it may well show up here later.
      </p>

      <div className="flex flex-wrap items-center gap-3">
        <Button variant="ghost" size="sm" asChild>
          <Link href="/explore">Browse everything</Link>
        </Button>
      </div>
    </div>
  )
}
