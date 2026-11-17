import type { Metadata } from "next"

import { ChatPanel } from "@/components/chat/chat-panel"

export const metadata: Metadata = {
  title: "Ask",
  description:
    "Describe what you are building and get matching open-source repos from this catalogue.",
}

export default function AskPage() {
  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-4 py-12">
      <div className="space-y-3">
        <h1 className="text-2xl font-semibold tracking-tight">
          Ask what you should use
        </h1>
        {/* Rewritten when retrieval moved server-side. The old line said this
            was "keyword retrieval, not a language model", which stopped being
            true: it now works out which kinds of tool a goal implies and
            searches for each separately. The last clause is unchanged because
            it is the part that still matters and still holds. */}
        <p className="max-w-prose text-sm text-muted-foreground">
          Describe the problem, not the tool. This works out which kinds of tool
          the job needs — a question about your interface means components,
          icons and animation, not the word &ldquo;website&rdquo; — then searches
          for each one separately. It only ever returns repos that are in the
          data files.
        </p>
      </div>

      {/* min-h keeps the pinned input from sitting mid-screen on an empty chat. */}
      <ChatPanel autoFocus className="min-h-[60vh]" />
    </div>
  )
}
