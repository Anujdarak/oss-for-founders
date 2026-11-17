"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { ShuffleIcon } from "lucide-react"

import { Button } from "@/components/ui/button"

/**
 * Jumps to a random hidden gem.
 *
 * The pick happens on click, in the browser, for a boring but important reason:
 * `Math.random()` during prerender is a build error under Cache Components, and
 * a "random" repo chosen at build time would be the same one for everybody
 * until the next deploy.
 */
export function RandomGem({
  hrefs,
  label = "Random gem",
}: {
  hrefs: string[]
  label?: string
}) {
  const router = useRouter()
  const [pending, setPending] = React.useState(false)

  if (hrefs.length === 0) return null

  return (
    <Button
      variant="outline"
      size="sm"
      disabled={pending}
      onClick={() => {
        setPending(true)
        router.push(hrefs[Math.floor(Math.random() * hrefs.length)])
      }}
    >
      <ShuffleIcon />
      {label}
    </Button>
  )
}
