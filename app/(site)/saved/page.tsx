import type { Metadata } from "next"

import { SavedLists } from "@/components/saved-lists"

export const metadata: Metadata = {
  title: "Saved",
  description: "Repos you have saved in this browser, plus what you looked at recently.",
  // Nothing here is the same for two people, so there is nothing to index.
  robots: { index: false },
}

export default function SavedPage() {
  return (
    <div className="mx-auto w-full max-w-3xl space-y-6 px-4 py-12">
      <div className="space-y-3">
        <h1 className="text-2xl font-semibold tracking-tight">Saved</h1>
        <p className="max-w-prose text-sm text-muted-foreground">
          Kept in this browser&apos;s local storage. There is no account and no
          server involved, which means the list does not follow you to another
          device and clearing site data clears it.
        </p>
      </div>

      <SavedLists />
    </div>
  )
}
