"use client"

import { useRecordView } from "@/hooks/use-local-store"

/**
 * Records that this repo was viewed. Renders nothing; it exists so a server
 * detail page can opt into the recently-viewed list without becoming a client
 * component itself.
 */
export function RecordView({ id }: { id: string }) {
  useRecordView(id)
  return null
}
